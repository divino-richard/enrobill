<?php

namespace App\Http\Controllers\Admin;

use App\Actions\FreebieEligibility;
use App\Actions\GenerateBillForEnrollment;
use App\Http\Controllers\Controller;
use App\Http\Resources\BillResource;
use App\Http\Resources\FreebieResource;
use App\Models\Bill;
use App\Models\Enrollment;
use App\Models\SchoolYear;
use App\Models\Student;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class BillController extends Controller
{
    private const STATUSES = ['unpaid', 'partial', 'paid'];

    private const TRACKING_STATES = ['with_balance', 'due_now', 'pending_payment'];

    private const SORTABLE = [
        'status' => 'status',
        'createdAt' => 'created_at',
    ];

    /**
     * All bills — paginated, searchable by student, filterable by status,
     * school year and tracking state, and sortable. Restricted to admins/cashiers
     * by route middleware.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $direction = $request->string('dir')->lower()->value() === 'desc' ? 'desc' : 'asc';
        $perPage = min(max($request->integer('per_page', 15), 1), 100);
        $sortKey = $request->string('sort')->value();
        $requestedTrackingState = $request->string('tracking_state')->value();
        $trackingState = in_array($requestedTrackingState, self::TRACKING_STATES, true)
            ? $requestedTrackingState
            : null;

        $query = Bill::query()
            ->when(
                $request->filled('school_year_id'),
                fn ($q) => $q->where('school_year_id', $request->integer('school_year_id')),
            )
            ->when(
                in_array($request->string('status')->value(), self::STATUSES, true),
                fn ($q) => $q->where('status', $request->string('status')->value()),
            )
            ->when($trackingState === 'with_balance', fn ($q) => $q->where('status', '!=', 'paid'))
            ->when(
                $trackingState === 'due_now',
                fn ($q) => $q
                    ->where('status', '!=', 'paid')
                    ->whereHas('installments', fn ($i) => $i->whereDate('due_date', '<=', now()->toDateString())),
            )
            ->when(
                $trackingState === 'pending_payment',
                fn ($q) => $q->whereHas('payments', fn ($p) => $p->where('status', 'pending')),
            )
            ->when($request->filled('search'), function ($q) use ($request) {
                $needle = '%'.$request->string('search')->value().'%';
                $q->whereHas('student', function ($s) use ($needle) {
                    $s->where('first_name', 'like', $needle)
                        ->orWhere('last_name', 'like', $needle)
                        ->orWhere('student_number', 'like', $needle);
                });
            })
            ->with(['student', 'schoolYear', 'items', 'adjustments', 'installments']);

        if ($sortKey === 'student') {
            $query->orderBy(
                Student::select('last_name')->whereColumn('students.id', 'bills.student_id'),
                $direction,
            );
        } elseif (isset(self::SORTABLE[$sortKey])) {
            $query->orderBy(self::SORTABLE[$sortKey], $direction);
        } else {
            $query->latest();
        }

        $query->orderBy('id', $direction);

        return BillResource::collection($query->paginate($perPage)->withQueryString());
    }

    /**
     * The freebies (promos) a pending enrollment qualifies for — shown to the
     * cashier once a voucher is selected at generation.
     */
    public function eligibleFreebies(Enrollment $enrollment, FreebieEligibility $eligibility): AnonymousResourceCollection
    {
        return FreebieResource::collection($eligibility->for($enrollment));
    }

    /**
     * Generate the bill for a pending enrollment. Takes no input: the voucher comes
     * from the enrollment (granted by the admin on acceptance) and the freebies from
     * the student's eligibility, so there is nothing for the cashier to choose.
     */
    public function generate(Enrollment $enrollment, GenerateBillForEnrollment $generate): BillResource
    {
        $bill = $generate($enrollment);

        return new BillResource(
            $bill->load(['student', 'schoolYear', 'enrollment', 'items', 'adjustments', 'installments', 'payments.recorder', 'payments.submitter']),
        );
    }

    /**
     * Void (delete) a bill that has no payments, returning its enrollment to the
     * pending queue so the cashier can re-generate it. Deleting cascades the bill's
     * items, credits, installments and (rejected-only) payments.
     */
    public function destroy(Bill $bill): Response
    {
        abort_unless($bill->isVoidable(), 422, 'This bill has payments and cannot be voided.');

        $bill->delete();

        return response()->noContent();
    }

    /**
     * A single bill with its items, credits, installment plan and payments.
     */
    public function show(Bill $bill): BillResource
    {
        return new BillResource(
            $bill->load(['student', 'schoolYear', 'enrollment', 'items', 'adjustments', 'installments', 'payments.recorder', 'payments.submitter']),
        );
    }

    /**
     * A single student's bill for the active school year. 404 if there's no active
     * year or the student hasn't been billed yet.
     */
    public function showForStudent(Student $student): BillResource
    {
        $schoolYear = SchoolYear::active();
        abort_if($schoolYear === null, 404, 'No school year is currently active.');

        $bill = $student->bills()
            ->where('school_year_id', $schoolYear->id)
            ->with(['items', 'schoolYear', 'enrollment', 'adjustments', 'installments', 'payments.recorder', 'payments.submitter'])
            ->first();

        abort_if($bill === null, 404, 'This student has not been billed yet.');

        return new BillResource($bill);
    }
}
