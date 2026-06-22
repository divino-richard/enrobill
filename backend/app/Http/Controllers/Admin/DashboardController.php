<?php

namespace App\Http\Controllers\Admin;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\Bill;
use App\Models\BillAdjustment;
use App\Models\Payment;
use App\Models\SchoolYear;
use App\Models\Student;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    /**
     * Aggregate stats for the staff dashboard. Finance figures (for the open
     * term) are returned to admins and cashiers; enrollment figures are
     * admin-only.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $schoolYear = SchoolYear::active();

        $data = [
            'role' => $user->role->value,
            'openTerm' => $schoolYear ? [
                'schoolYear' => $schoolYear->school_year,
                'semester' => $schoolYear->current_semester,
            ] : null,
            'finance' => $this->finance($schoolYear?->id),
        ];

        if ($user->role === Role::Admin) {
            $data['enrollment'] = $this->enrollment();
        }

        return response()->json(['data' => $data]);
    }

    /**
     * Billing totals for the active school year.
     *
     * @return array<string, mixed>
     */
    private function finance(?int $schoolYearId): array
    {
        $bills = Bill::query()->where('school_year_id', $schoolYearId);

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
     * Student and application counts.
     *
     * @return array<string, mixed>
     */
    private function enrollment(): array
    {
        return [
            'students' => [
                'total' => Student::query()->count(),
                'enrolled' => Student::query()->where('status', 'enrolled')->count(),
                'admitted' => Student::query()->where('status', 'admitted')->count(),
            ],
            'applications' => [
                'pending' => Application::query()
                    ->whereIn('status', ['submitted', 'under_review', 'returned'])
                    ->count(),
                'total' => Application::query()->count(),
            ],
        ];
    }
}
