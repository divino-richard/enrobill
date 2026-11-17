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
use App\Models\Section;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

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
     * whole selected school year and enrollment cohort.
     */
    public function index(Request $request): JsonResponse
    {
        $schoolYearId = $request->integer('school_year_id') ?: null;
        $schoolYear = $schoolYearId !== null
            ? SchoolYear::query()->find($schoolYearId)
            : SchoolYear::active();
        $id = $schoolYear?->id;

        $filters = $request->validate([
            'year_level' => ['nullable', Rule::in(SchoolYear::YEAR_LEVELS)],
            'program' => ['nullable', 'string', 'max:255'],
            'section_id' => $request->input('section_id') === 'unassigned'
                ? ['nullable', Rule::in(['unassigned'])]
                : ['nullable', 'integer', Rule::exists('sections', 'id')->where('school_year_id', $id)],
            'enrollment_status' => ['nullable', Rule::in(self::ENROLLMENT_STATUSES)],
            'billing_status' => ['nullable', Rule::in([...self::BILL_STATUSES, 'unbilled'])],
        ]);

        $period = in_array($request->string('period')->value(), ['month', 'quarter', 'year'], true)
            ? $request->string('period')->value()
            : 'year';

        $since = match ($period) {
            'month' => now()->subDays(30),
            'quarter' => now()->subDays(90),
            default => null,
        };

        $enrollments = $this->enrollmentQuery($id, $filters);
        $bills = $this->billQuery($id, $filters, $enrollments);

        return response()->json(['data' => [
            'updatedAt' => now()->toIso8601String(),
            'filterOptions' => [
                'sections' => Section::query()
                    ->when(
                        $id !== null,
                        fn ($q) => $q->where('school_year_id', $id),
                        fn ($q) => $q->whereRaw('1 = 0'),
                    )
                    ->orderBy('program')->orderBy('year_level')->orderBy('name')
                    ->get(['id', 'name', 'program', 'year_level'])
                    ->map(fn (Section $section) => [
                        'id' => $section->id,
                        'name' => $section->name,
                        'program' => $section->program,
                        'yearLevel' => $section->year_level,
                    ])->all(),
            ],
            'summary' => $this->summary($bills, $enrollments),
            'billStatuses' => $this->billStatuses($bills),
            'paymentMethods' => $this->paymentMethods($bills),
            'topBalances' => $this->topBalances($bills),
            'enrollmentStatuses' => $this->enrollmentStatuses($enrollments),
            'programMix' => $this->programMix($enrollments),
            'enrollmentActivity' => $this->enrollmentActivity($enrollments, $since),
            'vouchers' => $this->vouchers($bills, $enrollments),
            'creditActivity' => $this->creditActivity($bills, $since),
            'channelAudits' => $this->channelAudits($bills),
        ]]);
    }

    private function enrollmentQuery(?int $schoolYearId, array $filters): Builder
    {
        $query = Enrollment::query()->when(
            $schoolYearId !== null,
            fn ($q) => $q->where('school_year_id', $schoolYearId),
            fn ($q) => $q->whereRaw('1 = 0'),
        );

        foreach (['year_level' => 'year_level', 'program' => 'track', 'enrollment_status' => 'status'] as $filter => $column) {
            if (isset($filters[$filter])) {
                $query->where($column, $filters[$filter]);
            }
        }

        if (isset($filters['section_id'])) {
            $filters['section_id'] === 'unassigned'
                ? $query->whereNull('section_id')
                : $query->where('section_id', $filters['section_id']);
        }

        if (isset($filters['billing_status'])) {
            $filters['billing_status'] === 'unbilled'
                ? $query->whereDoesntHave('bill')
                : $query->whereHas('bill', fn ($q) => $q->where('status', $filters['billing_status']));
        }

        return $query;
    }

    private function billQuery(?int $schoolYearId, array $filters, Builder $enrollments): Builder
    {
        $query = Bill::query()->when(
            $schoolYearId !== null,
            fn ($q) => $q->where('school_year_id', $schoolYearId),
            fn ($q) => $q->whereRaw('1 = 0'),
        );

        if (isset($filters['year_level']) || isset($filters['program'])
            || isset($filters['section_id']) || isset($filters['enrollment_status'])) {
            $query->whereIn('enrollment_id', (clone $enrollments)->select('id'));
        }

        if (isset($filters['billing_status'])) {
            $filters['billing_status'] === 'unbilled'
                ? $query->whereRaw('1 = 0')
                : $query->where('status', $filters['billing_status']);
        }

        return $query;
    }

    /**
     * @return array<string, mixed>
     */
    private function summary(Builder $bills, Builder $enrollments): array
    {
        $records = (clone $bills)->with(['adjustments', 'droppingAssessment', 'creditAllocations'])->get();
        $collected = round($records->sum('amount_paid'), 2);
        $voucherCredits = (float) BillAdjustment::query()
            ->whereIn('bill_id', (clone $bills)->select('id'))
            ->whereHas('discount', fn ($q) => $q->where('category', 'voucher'))
            ->sum('amount');
        $incentiveCredits = (float) BillAdjustment::query()
            ->whereIn('bill_id', (clone $bills)->select('id'))
            ->whereNotNull('incentive_key')
            ->sum('amount');

        $billed = round($records->sum(fn (Bill $bill) => $bill->netTotal()), 2);
        $outstanding = round($records->sum(fn (Bill $bill) => $bill->balance()), 2);

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
            'activeStudents' => (int) (clone $enrollments)
                ->where('status', 'enrolled')
                ->count(),
            'voucherCredits' => round($voucherCredits, 2),
            'incentiveCredits' => round($incentiveCredits, 2),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function billStatuses(Builder $bills): array
    {
        $byStatus = (clone $bills)->with(['adjustments', 'droppingAssessment'])->get()->groupBy('status');

        return collect(self::BILL_STATUSES)->map(function (string $status) use ($byStatus) {
            $rows = $byStatus->get($status, collect());

            return [
                'status' => $status,
                'count' => $rows->count(),
                'total' => round($rows->sum(fn (Bill $bill) => $bill->netTotal()), 2),
                'note' => self::BILL_STATUS_NOTES[$status],
            ];
        })->values()->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function paymentMethods(Builder $bills): array
    {
        $billIds = (clone $bills)->select('id');

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
    private function topBalances(Builder $bills): array
    {
        return (clone $bills)
            ->where('status', '!=', 'paid')
            ->with(['student', 'enrollment', 'schoolYear', 'adjustments', 'installments', 'payments'])
            ->get()
            ->map(function (Bill $bill) {
                $netTotal = $bill->netTotal();
                $paid = (float) $bill->amount_paid;
                $latestPayment = $bill->payments->sortByDesc('paid_at')->first();

                return [
                    'id' => $bill->id,
                    'studentName' => trim($bill->student->first_name.' '.$bill->student->last_name),
                    'studentNumber' => $bill->student->student_number,
                    'program' => $bill->enrollment?->track ?? $bill->student->track_or_strand,
                    'yearLevel' => $bill->enrollment?->year_level ?? $bill->student->year_level,
                    'schoolYear' => $bill->schoolYear?->school_year,
                    'status' => $bill->status,
                    'paymentStatus' => $latestPayment?->status,
                    'netTotal' => $netTotal,
                    'amountPaid' => $paid,
                    'balance' => $bill->balance(),
                    'amountDue' => $bill->amountDue(),
                    'collectionState' => $bill->collectionState(),
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
    private function enrollmentStatuses(Builder $enrollments): array
    {
        $byStatus = (clone $enrollments)
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
    private function programMix(Builder $enrollments): array
    {
        $all = (clone $enrollments)
            ->selectRaw('track, year_level, count(*) as students, sum(no_downpayment) as no_downpayment')
            ->groupBy('track', 'year_level')
            ->get();

        $billed = (clone $enrollments)
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
    private function enrollmentActivity(Builder $enrollments, ?Carbon $since): array
    {
        return (clone $enrollments)
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
    private function vouchers(Builder $bills, Builder $enrollments): array
    {
        $billIds = (clone $bills)->select('id');

        return Discount::withTrashed()
            ->where('category', 'voucher')
            ->get()
            ->map(function (Discount $discount) use ($billIds, $enrollments) {
                $adjustments = BillAdjustment::query()
                    ->where('discount_id', $discount->id)
                    ->whereIn('bill_id', $billIds);

                $recipients = (clone $adjustments)->distinct()->count('bill_id');
                $amountApplied = round((float) (clone $adjustments)->sum('amount'), 2);

                $granted = (clone $enrollments)
                    ->where('discount_id', $discount->id)
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
    private function creditActivity(Builder $bills, ?Carbon $since): array
    {
        $billIds = (clone $bills)->select('id');

        return BillAdjustment::query()
            ->whereIn('bill_id', $billIds)
            ->when($since !== null, fn ($q) => $q->where('created_at', '>=', $since))
            ->with(['bill.student', 'discount', 'incentiveAwards.freebie'])
            ->latest()
            ->limit(10)
            ->get()
            ->filter(fn (BillAdjustment $adjustment) => $adjustment->bill?->student !== null)
            ->map(function (BillAdjustment $adjustment) {
                $reasons = $adjustment->incentiveAwards
                    ->map(fn ($award) => match ($award->type) {
                        'early_enrollment' => 'Early enrollment',
                        'referral' => 'Referral',
                        default => (string) str($award->type)->replace('_', ' ')->title(),
                    })
                    ->unique()
                    ->values()
                    ->all();
                $name = $adjustment->discount?->name ?? $adjustment->label;

                return [
                    'id' => $adjustment->id,
                    'studentName' => trim($adjustment->bill->student->first_name.' '.$adjustment->bill->student->last_name),
                    'studentNumber' => $adjustment->bill->student->student_number,
                    // Keep voucherName for older clients while the broader fields
                    // identify shared incentive credits and all earned reasons.
                    'voucherName' => $name,
                    'creditName' => $name,
                    'creditType' => $adjustment->incentive_key !== null
                        ? 'incentive'
                        : ($adjustment->discount?->category ?? 'adjustment'),
                    'reasons' => $reasons,
                    'amountApplied' => (float) $adjustment->amount,
                    'billStatus' => $adjustment->bill->status,
                    'postedAt' => $adjustment->created_at?->toIso8601String(),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function channelAudits(Builder $bills): array
    {
        $billIds = (clone $bills)->select('id');

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
