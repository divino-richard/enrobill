<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\PaymentChannelResource;
use App\Models\Bill;
use App\Models\BillAdjustment;
use App\Models\Discount;
use App\Models\Enrollment;
use App\Models\Payment;
use App\Models\PaymentChannel;
use App\Models\SchoolYear;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class ReportsController extends Controller
{
    private const BILL_STATUSES = ['unpaid', 'partial', 'paid'];

    private const PAYMENT_METHODS = ['cash', 'gcash', 'maya', 'bank'];

    private const ENROLLMENT_STATUSES = ['pending', 'enrolled', 'completed', 'withdrawn', 'dropped'];

    private const BILL_STATUS_NOTES = [
        'paid' => 'Accounts fully settled for the term.',
        'partial' => 'Installment plans with active balances.',
        'unpaid' => 'Bills awaiting first confirmed payment.',
    ];

    private const ENROLLMENT_STATUS_NOTES = [
        'enrolled' => 'Marked enrolled after downpayment or full settlement.',
        'pending' => 'Still waiting on billing or payment confirmation.',
        'completed' => 'Prior-term students retained for historical totals.',
        'withdrawn' => 'Initiated withdrawal before completion.',
        'dropped' => 'Dropped after enrollment was posted.',
    ];

    /**
     * Finance and enrollment snapshot for a school year. `school_year_id`
     * defaults to the active year; `period` (month|quarter|year) only narrows
     * the two recent-activity tables — everything else stays scoped to the
     * whole selected school year, same as the staff dashboard.
     */
    public function index(Request $request): JsonResponse
    {
        $schoolYearId = $request->integer('school_year_id') ?: null;
        $schoolYear = $schoolYearId !== null
            ? SchoolYear::query()->find($schoolYearId)
            : SchoolYear::active();

        $period = in_array($request->string('period')->value(), ['month', 'quarter', 'year'], true)
            ? $request->string('period')->value()
            : 'year';

        $since = match ($period) {
            'month' => now()->subDays(30),
            'quarter' => now()->subDays(90),
            default => null,
        };

        $id = $schoolYear?->id;

        return response()->json(['data' => [
            'updatedAt' => now()->toIso8601String(),
            'summary' => $this->summary($id),
            'billStatuses' => $this->billStatuses($id),
            'paymentMethods' => $this->paymentMethods($id),
            'topBalances' => $this->topBalances($id),
            'enrollmentStatuses' => $this->enrollmentStatuses($id),
            'programMix' => $this->programMix($id),
            'enrollmentActivity' => $this->enrollmentActivity($id, $since),
            'vouchers' => $this->vouchers($id),
            'creditActivity' => $this->creditActivity($id, $since),
            'channelAudits' => $this->channelAudits($id),
        ]]);
    }

    /**
     * @return array<string, mixed>
     */
    private function summary(?int $schoolYearId): array
    {
        $bills = Bill::query()->when(
            $schoolYearId !== null,
            fn ($q) => $q->where('school_year_id', $schoolYearId),
            fn ($q) => $q->whereRaw('1 = 0'),
        );

        $gross = (float) (clone $bills)->sum('total');
        $collected = round((float) (clone $bills)->sum('amount_paid'), 2);
        $discounts = (float) BillAdjustment::query()
            ->whereIn('bill_id', (clone $bills)->select('id'))
            ->sum('amount');
        $voucherCredits = (float) BillAdjustment::query()
            ->whereIn('bill_id', (clone $bills)->select('id'))
            ->whereHas('discount', fn ($q) => $q->where('category', 'voucher'))
            ->sum('amount');

        $billed = round(max($gross - $discounts, 0), 2);
        $outstanding = round(max($billed - $collected, 0), 2);

        $pendingPayments = Payment::query()
            ->where('status', 'pending')
            ->whereIn('bill_id', (clone $bills)->select('id'))
            ->count();

        return [
            'totalBilled' => $billed,
            'totalCollected' => $collected,
            'totalOutstanding' => $outstanding,
            'pendingPayments' => $pendingPayments,
            'collectionRate' => $billed > 0 ? round($collected / $billed * 100, 1) : 0,
            'billsGenerated' => (int) (clone $bills)->count(),
            'activeStudents' => (int) Enrollment::query()
                ->when(
                    $schoolYearId !== null,
                    fn ($q) => $q->where('school_year_id', $schoolYearId),
                    fn ($q) => $q->whereRaw('1 = 0'),
                )
                ->where('status', 'enrolled')
                ->count(),
            'voucherCredits' => round($voucherCredits, 2),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function billStatuses(?int $schoolYearId): array
    {
        $bills = Bill::query()->when(
            $schoolYearId !== null,
            fn ($q) => $q->where('school_year_id', $schoolYearId),
            fn ($q) => $q->whereRaw('1 = 0'),
        );

        $byStatus = (clone $bills)
            ->selectRaw('status, count(*) as count, sum(total) as gross')
            ->groupBy('status')
            ->get()
            ->keyBy('status');

        $discountsByStatus = BillAdjustment::query()
            ->join('bills', 'bills.id', '=', 'bill_adjustments.bill_id')
            ->whereIn('bills.id', (clone $bills)->select('id'))
            ->selectRaw('bills.status as status, sum(bill_adjustments.amount) as discounts')
            ->groupBy('bills.status')
            ->pluck('discounts', 'status');

        return collect(self::BILL_STATUSES)->map(function (string $status) use ($byStatus, $discountsByStatus) {
            $row = $byStatus->get($status);
            $gross = (float) ($row->gross ?? 0);
            $discounts = (float) ($discountsByStatus[$status] ?? 0);

            return [
                'status' => $status,
                'count' => (int) ($row->count ?? 0),
                'total' => round(max($gross - $discounts, 0), 2),
                'note' => self::BILL_STATUS_NOTES[$status],
            ];
        })->values()->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function paymentMethods(?int $schoolYearId): array
    {
        $billIds = Bill::query()
            ->when(
                $schoolYearId !== null,
                fn ($q) => $q->where('school_year_id', $schoolYearId),
                fn ($q) => $q->whereRaw('1 = 0'),
            )
            ->select('id');

        $byMethod = Payment::query()
            ->whereIn('bill_id', $billIds)
            ->selectRaw(
                "method,
                count(*) as transactions,
                sum(case when status = 'verified' then amount else 0 end) as verified_amount,
                sum(case when status = 'pending' then 1 else 0 end) as pending_count",
            )
            ->groupBy('method')
            ->get()
            ->keyBy('method');

        return collect(self::PAYMENT_METHODS)->map(function (string $method) use ($byMethod) {
            $row = $byMethod->get($method);

            return [
                'method' => $method,
                'transactions' => (int) ($row->transactions ?? 0),
                'verifiedAmount' => round((float) ($row->verified_amount ?? 0), 2),
                'pendingCount' => (int) ($row->pending_count ?? 0),
            ];
        })->values()->all();
    }

    /**
     * The 10 largest open balances, using Bill's own netTotal()/amountDue() so
     * installment allocation stays correct rather than reimplemented in SQL.
     *
     * @return array<int, array<string, mixed>>
     */
    private function topBalances(?int $schoolYearId): array
    {
        if ($schoolYearId === null) {
            return [];
        }

        return Bill::query()
            ->where('school_year_id', $schoolYearId)
            ->where('status', '!=', 'paid')
            ->with(['student', 'schoolYear', 'adjustments', 'installments', 'payments'])
            ->get()
            ->map(function (Bill $bill) {
                $netTotal = $bill->netTotal();
                $paid = (float) $bill->amount_paid;
                $latestPayment = $bill->payments->sortByDesc('paid_at')->first();

                return [
                    'id' => $bill->id,
                    'studentName' => trim($bill->student->first_name.' '.$bill->student->last_name),
                    'studentNumber' => $bill->student->student_number,
                    'program' => $bill->student->track_or_strand,
                    'yearLevel' => $bill->student->year_level,
                    'schoolYear' => $bill->schoolYear?->school_year,
                    'status' => $bill->status,
                    'paymentStatus' => $latestPayment?->status,
                    'netTotal' => $netTotal,
                    'amountPaid' => $paid,
                    'balance' => round(max($netTotal - $paid, 0), 2),
                    'amountDue' => $bill->amountDue(),
                ];
            })
            ->sortByDesc('balance')
            ->take(10)
            ->values()
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function enrollmentStatuses(?int $schoolYearId): array
    {
        $byStatus = Enrollment::query()
            ->when(
                $schoolYearId !== null,
                fn ($q) => $q->where('school_year_id', $schoolYearId),
                fn ($q) => $q->whereRaw('1 = 0'),
            )
            ->selectRaw('status, count(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status');

        return collect(self::ENROLLMENT_STATUSES)
            ->filter(fn (string $status) => ($byStatus[$status] ?? 0) > 0)
            ->map(fn (string $status) => [
                'status' => $status,
                'count' => (int) $byStatus[$status],
                'note' => self::ENROLLMENT_STATUS_NOTES[$status],
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function programMix(?int $schoolYearId): array
    {
        if ($schoolYearId === null) {
            return [];
        }

        $all = Enrollment::query()
            ->where('school_year_id', $schoolYearId)
            ->selectRaw('track, year_level, count(*) as students, sum(no_downpayment) as no_downpayment')
            ->groupBy('track', 'year_level')
            ->get();

        $billed = Enrollment::query()
            ->where('school_year_id', $schoolYearId)
            ->whereHas('bill')
            ->selectRaw('track, year_level, count(*) as billed')
            ->groupBy('track', 'year_level')
            ->get()
            ->keyBy(fn ($row) => $row->track.'|'.$row->year_level);

        return $all->map(function ($row) use ($billed) {
            $key = $row->track.'|'.$row->year_level;

            return [
                'program' => $row->track,
                'yearLevel' => $row->year_level,
                'students' => (int) $row->students,
                'billed' => (int) ($billed[$key]->billed ?? 0),
                'noDownpayment' => (int) $row->no_downpayment,
            ];
        })->sortByDesc('students')->values()->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function enrollmentActivity(?int $schoolYearId, ?Carbon $since): array
    {
        if ($schoolYearId === null) {
            return [];
        }

        return Enrollment::query()
            ->where('school_year_id', $schoolYearId)
            ->when($since !== null, fn ($q) => $q->where('created_at', '>=', $since))
            ->with(['student', 'bill'])
            ->latest()
            ->limit(10)
            ->get()
            ->map(fn (Enrollment $enrollment) => [
                'id' => $enrollment->id,
                'studentName' => trim($enrollment->student->first_name.' '.$enrollment->student->last_name),
                'studentNumber' => $enrollment->student->student_number,
                'program' => $enrollment->track,
                'yearLevel' => $enrollment->year_level,
                'status' => $enrollment->status,
                'noDownpayment' => (bool) $enrollment->no_downpayment,
                'hasBill' => $enrollment->bill !== null,
                'enrolledAt' => $enrollment->enrolled_at?->toIso8601String()
                    ?? $enrollment->created_at?->toIso8601String(),
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function vouchers(?int $schoolYearId): array
    {
        $billIds = Bill::query()
            ->when(
                $schoolYearId !== null,
                fn ($q) => $q->where('school_year_id', $schoolYearId),
                fn ($q) => $q->whereRaw('1 = 0'),
            )
            ->select('id');

        return Discount::query()
            ->where('category', 'voucher')
            ->get()
            ->map(function (Discount $discount) use ($billIds, $schoolYearId) {
                $adjustments = BillAdjustment::query()
                    ->where('discount_id', $discount->id)
                    ->whereIn('bill_id', $billIds);

                $recipients = (clone $adjustments)->distinct()->count('bill_id');
                $amountApplied = round((float) (clone $adjustments)->sum('amount'), 2);

                $granted = Enrollment::query()
                    ->where('discount_id', $discount->id)
                    ->when(
                        $schoolYearId !== null,
                        fn ($q) => $q->where('school_year_id', $schoolYearId),
                        fn ($q) => $q->whereRaw('1 = 0'),
                    )
                    ->count();

                return [
                    'discount' => [
                        'id' => $discount->id,
                        'name' => $discount->name,
                        'category' => $discount->category,
                        'type' => $discount->type,
                        'value' => (float) $discount->value,
                        'isActive' => (bool) $discount->is_active,
                        'createdAt' => $discount->created_at?->toIso8601String(),
                    ],
                    'recipients' => $recipients,
                    'amountApplied' => $amountApplied,
                    'utilizationRate' => (int) round($recipients / max($granted, 1) * 100),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function creditActivity(?int $schoolYearId, ?Carbon $since): array
    {
        $billIds = Bill::query()
            ->when(
                $schoolYearId !== null,
                fn ($q) => $q->where('school_year_id', $schoolYearId),
                fn ($q) => $q->whereRaw('1 = 0'),
            )
            ->select('id');

        return BillAdjustment::query()
            ->whereIn('bill_id', $billIds)
            ->whereNotNull('discount_id')
            ->when($since !== null, fn ($q) => $q->where('created_at', '>=', $since))
            ->with(['bill.student', 'discount'])
            ->latest()
            ->limit(10)
            ->get()
            ->filter(fn (BillAdjustment $adjustment) => $adjustment->bill?->student !== null)
            ->map(fn (BillAdjustment $adjustment) => [
                'id' => $adjustment->id,
                'studentName' => trim($adjustment->bill->student->first_name.' '.$adjustment->bill->student->last_name),
                'studentNumber' => $adjustment->bill->student->student_number,
                'voucherName' => $adjustment->discount?->name ?? $adjustment->label,
                'amountApplied' => (float) $adjustment->amount,
                'billStatus' => $adjustment->bill->status,
                'postedAt' => $adjustment->created_at?->toIso8601String(),
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function channelAudits(?int $schoolYearId): array
    {
        $billIds = Bill::query()
            ->when(
                $schoolYearId !== null,
                fn ($q) => $q->where('school_year_id', $schoolYearId),
                fn ($q) => $q->whereRaw('1 = 0'),
            )
            ->select('id');

        return PaymentChannel::query()
            ->orderBy('id')
            ->get()
            ->map(function (PaymentChannel $channel) use ($billIds) {
                $payments = Payment::query()
                    ->where('method', $channel->code)
                    ->whereIn('bill_id', $billIds);

                $base = (new PaymentChannelResource($channel))->toArray(request());

                return array_merge($base, [
                    'pendingProofs' => (clone $payments)->where('status', 'pending')->count(),
                    'verifiedAmount' => round((float) (clone $payments)->where('status', 'verified')->sum('amount'), 2),
                    'lastReviewed' => (clone $payments)->max('updated_at'),
                ]);
            })
            ->values()
            ->all();
    }
}
