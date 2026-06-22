<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\BillResource;
use App\Models\Bill;
use App\Models\SchoolYear;
use App\Models\Student;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class BillController extends Controller
{
    private const STATUSES = ['unpaid', 'partial', 'paid'];

    private const SORTABLE = [
        'status' => 'status',
        'createdAt' => 'created_at',
    ];

    /**
     * Bills for the active school year — paginated, searchable by student,
     * filterable by status, and sortable. Restricted to admins/cashiers by route
     * middleware.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $schoolYear = SchoolYear::active();
        $direction = $request->string('dir')->lower()->value() === 'desc' ? 'desc' : 'asc';
        $perPage = min(max($request->integer('per_page', 15), 1), 100);
        $sortKey = $request->string('sort')->value();

        $query = Bill::query()
            ->when($schoolYear !== null, fn ($q) => $q->where('school_year_id', $schoolYear->id))
            ->when($schoolYear === null, fn ($q) => $q->whereRaw('1 = 0'))
            ->when(
                in_array($request->string('status')->value(), self::STATUSES, true),
                fn ($q) => $q->where('status', $request->string('status')->value()),
            )
            ->when($request->filled('search'), function ($q) use ($request) {
                $needle = '%'.$request->string('search')->value().'%';
                $q->whereHas('student', function ($s) use ($needle) {
                    $s->where('first_name', 'like', $needle)
                        ->orWhere('last_name', 'like', $needle)
                        ->orWhere('student_number', 'like', $needle);
                });
            })
            ->with(['student', 'schoolYear', 'items', 'adjustments']);

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
