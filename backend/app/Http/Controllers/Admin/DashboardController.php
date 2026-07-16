<?php

namespace App\Http\Controllers\Admin;

use App\Actions\YearEndCloseout;
use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\Bill;
use App\Models\BillAdjustment;
use App\Models\Enrollment;
use App\Models\Payment;
use App\Models\SchoolYear;
use App\Models\Student;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __construct(private YearEndCloseout $closeout) {}

    /**
     * Aggregate the operational dashboard for staff. The dashboard should show
     * the live state of admissions, enrollment, billing, and term readiness
     * using the same models that power the rest of the workspace.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $schoolYear = SchoolYear::active();

        $data = [
            'role' => $user->role->value,
            'openTerm' => $this->openTerm($schoolYear),
            'finance' => $this->finance($schoolYear?->id),
            'operations' => $this->operations($schoolYear?->id),
            'trend' => $this->trend($schoolYear),
        ];

        if ($user->role === Role::Admin) {
            $data['enrollment'] = $this->enrollment($schoolYear);
        }

        return response()->json(['data' => $data]);
    }

    /**
     * @return array<string, mixed>|null
     */
    private function openTerm(?SchoolYear $schoolYear): ?array
    {
        if ($schoolYear === null) {
            return null;
        }

        return [
            'schoolYear' => $schoolYear->school_year,
            'admissionOpen' => (bool) $schoolYear->admission_open,
            'progressionOpen' => $schoolYear->isProgressionOpen(),
        ];
    }

    /**
     * Billing totals for the active school year.
     *
     * @return array<string, mixed>
     */
    private function finance(?int $schoolYearId): array
    {
        $bills = Bill::query()->when(
            $schoolYearId !== null,
            fn ($query) => $query->where('school_year_id', $schoolYearId),
            fn ($query) => $query->whereRaw('1 = 0'),
        );

        $gross = (float) (clone $bills)->sum('total');
        $collected = round((float) (clone $bills)->sum('amount_paid'), 2);
        $discounts = (float) BillAdjustment::query()
            ->whereIn('bill_id', (clone $bills)->select('id'))
            ->sum('amount');

        $billed = round(max($gross - $discounts, 0), 2);
        $outstanding = round(max($billed - $collected, 0), 2);

        $byStatus = (clone $bills)
            ->selectRaw('status, count(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status');

        $pendingPayments = Payment::query()
            ->where('status', 'pending')
            ->whereIn('bill_id', (clone $bills)->select('id'))
            ->count();

        return [
            'billed' => $billed,
            'collected' => $collected,
            'outstanding' => $outstanding,
            'collectionRate' => $billed > 0 ? (int) round($collected / $billed * 100) : 0,
            'pendingPayments' => $pendingPayments,
            'bills' => [
                'total' => (int) (clone $bills)->count(),
                'unpaid' => (int) ($byStatus['unpaid'] ?? 0),
                'partial' => (int) ($byStatus['partial'] ?? 0),
                'paid' => (int) ($byStatus['paid'] ?? 0),
            ],
        ];
    }

    /**
     * Shared operational counts that both admins and cashiers act on.
     *
     * @return array<string, int>
     */
    private function operations(?int $schoolYearId): array
    {
        $currentEnrollments = Enrollment::query()
            ->when(
                $schoolYearId !== null,
                fn ($query) => $query->where('school_year_id', $schoolYearId),
                fn ($query) => $query->whereRaw('1 = 0'),
            );

        return [
            'pendingEnrollments' => (int) (clone $currentEnrollments)
                ->where('status', 'pending')
                ->count(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function trend(?SchoolYear $schoolYear): array
    {
        return [
            'admissions' => $this->admissionsTrend($schoolYear),
            'finance' => $this->financeTrend($schoolYear?->id),
        ];
    }

    /**
     * Admin-only enrollment and admissions context.
     *
     * @return array<string, mixed>
     */
    private function enrollment(?SchoolYear $schoolYear): array
    {
        $applicationStatuses = Application::query()
            ->selectRaw('status, count(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status');

        return [
            'applications' => [
                'pending' => (int) (($applicationStatuses['submitted'] ?? 0)
                    + ($applicationStatuses['under_review'] ?? 0)
                    + ($applicationStatuses['returned'] ?? 0)),
                'submitted' => (int) ($applicationStatuses['submitted'] ?? 0),
                'underReview' => (int) ($applicationStatuses['under_review'] ?? 0),
                'returned' => (int) ($applicationStatuses['returned'] ?? 0),
                'total' => (int) Application::query()->count(),
            ],
            'sections' => [
                'unsectioned' => (int) Enrollment::query()
                    ->when(
                        $schoolYear !== null,
                        fn ($query) => $query->where('school_year_id', $schoolYear->id),
                        fn ($query) => $query->whereRaw('1 = 0'),
                    )
                    ->where('status', 'enrolled')
                    ->whereNull('section_id')
                    ->count(),
            ],
            'progression' => $this->progression($schoolYear),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function progression(?SchoolYear $schoolYear): array
    {
        if ($schoolYear === null || ! $schoolYear->isProgressionOpen()) {
            return [
                'open' => false,
                'pendingDecisions' => 0,
                'nextYearReady' => false,
            ];
        }

        return [
            'open' => true,
            'pendingDecisions' => $this->closeout->pendingStudents($schoolYear)->count(),
            'nextYearReady' => $this->closeout->nextYear($schoolYear) !== null,
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function admissionsTrend(?SchoolYear $schoolYear): array
    {
        return $this->recentMonths(6)->map(function (CarbonImmutable $start) use ($schoolYear) {
            $end = $start->endOfMonth();
            $schoolYearKey = $schoolYear?->school_year;

            $applications = Application::query()
                ->when(
                    $schoolYearKey !== null,
                    fn ($query) => $query->where('school_year', $schoolYearKey),
                    fn ($query) => $query->whereRaw('1 = 0'),
                )
                ->whereBetween('submitted_at', [$start, $end]);

            $students = Student::query()
                ->when(
                    $schoolYearKey !== null,
                    fn ($query) => $query->where('school_year', $schoolYearKey),
                    fn ($query) => $query->whereRaw('1 = 0'),
                )
                ->whereBetween('created_at', [$start, $end]);

            $enrollments = Enrollment::query()
                ->when(
                    $schoolYear !== null,
                    fn ($query) => $query->where('school_year_id', $schoolYear->id),
                    fn ($query) => $query->whereRaw('1 = 0'),
                )
                ->whereNotNull('enrolled_at')
                ->whereBetween('enrolled_at', [$start, $end]);

            return [
                'month' => $start->format('M'),
                'submitted' => (int) (clone $applications)->count(),
                'admitted' => (int) (clone $students)->count(),
                'enrolled' => (int) (clone $enrollments)->count(),
            ];
        })->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function financeTrend(?int $schoolYearId): array
    {
        return $this->recentMonths(12)->map(function (CarbonImmutable $start) use ($schoolYearId) {
            $end = $start->endOfMonth();

            $bills = Bill::query()
                ->when(
                    $schoolYearId !== null,
                    fn ($query) => $query->where('school_year_id', $schoolYearId),
                    fn ($query) => $query->whereRaw('1 = 0'),
                )
                ->whereBetween('created_at', [$start, $end]);

            $gross = (float) (clone $bills)->sum('total');
            $discounts = (float) BillAdjustment::query()
                ->whereIn('bill_id', (clone $bills)->select('id'))
                ->sum('amount');

            $collected = round((float) Payment::query()
                ->where('status', 'verified')
                ->whereIn('bill_id', Bill::query()
                    ->when(
                        $schoolYearId !== null,
                        fn ($query) => $query->where('school_year_id', $schoolYearId),
                        fn ($query) => $query->whereRaw('1 = 0'),
                    )
                    ->select('id'))
                ->whereBetween('paid_at', [$start, $end])
                ->sum('amount'), 2);

            return [
                'month' => $start->format('M'),
                'billed' => round(max($gross - $discounts, 0), 2),
                'collected' => $collected,
            ];
        })->all();
    }

    /**
     * The last $months months, oldest first, ending with the current one.
     *
     * @return \Illuminate\Support\Collection<int, CarbonImmutable>
     */
    private function recentMonths(int $months)
    {
        $current = CarbonImmutable::now()->startOfMonth();

        return collect(range($months - 1, 0))
            ->map(fn (int $offset) => $current->subMonths($offset));
    }
}
