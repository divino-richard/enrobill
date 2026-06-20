<?php

namespace App\Http\Controllers\Admin;

use App\Actions\GenerateTermBills;
use App\Http\Controllers\Controller;
use App\Http\Resources\BillResource;
use App\Models\Bill;
use App\Models\Student;
use App\Models\Term;
use Illuminate\Http\JsonResponse;
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
     * Bills for the currently open term — paginated, searchable by student,
     * filterable by status, and sortable. Restricted to admins by route
     * middleware.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $term = Term::open();
        $direction = $request->string('dir')->lower()->value() === 'desc' ? 'desc' : 'asc';
        $perPage = min(max($request->integer('per_page', 15), 1), 100);
        $sortKey = $request->string('sort')->value();

        $query = Bill::query()
            ->when($term !== null, fn ($q) => $q->where('term_id', $term->id))
            ->when($term === null, fn ($q) => $q->whereRaw('1 = 0'))
            ->when(
                in_array($request->string('status')->value(), self::STATUSES, true),
                fn ($q) => $q->where('status', $request->string('status')->value()),
            )
            ->when($request->filled('search'), function ($q) use ($request) {
                $term = '%'.$request->string('search')->value().'%';
                $q->whereHas('student', function ($s) use ($term) {
                    $s->where('first_name', 'like', $term)
                        ->orWhere('last_name', 'like', $term)
                        ->orWhere('student_number', 'like', $term);
                });
            })
            ->with(['student', 'term', 'items', 'adjustments']);

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
     * Bulk-generate bills for all eligible admitted students in the open term.
     */
    public function generate(GenerateTermBills $generate): JsonResponse
    {
        $created = $generate();

        return response()->json(['created' => $created]);
    }

    /**
     * A single bill with its items, credits, installment plan and payments.
     */
    public function show(Bill $bill): BillResource
    {
        return new BillResource(
            $bill->load(['student', 'term', 'items', 'adjustments', 'installments', 'payments.recorder', 'payments.submitter']),
        );
    }

    /**
     * A single student's bill for the open term. 404 if there's no open term or
     * the student hasn't been billed yet.
     */
    public function showForStudent(Student $student): BillResource
    {
        $term = Term::open();
        abort_if($term === null, 404, 'No term is currently open.');

        $bill = $student->bills()
            ->where('term_id', $term->id)
            ->with(['items', 'term', 'adjustments', 'installments', 'payments.recorder', 'payments.submitter'])
            ->first();

        abort_if($bill === null, 404, 'This student has not been billed yet.');

        return new BillResource($bill);
    }
}
