<?php

namespace App\Http\Controllers\Admin;

use App\Actions\GenerateTermBills;
use App\Http\Controllers\Controller;
use App\Http\Resources\BillResource;
use App\Models\Bill;
use App\Models\Student;
use App\Models\Term;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class BillController extends Controller
{
    /**
     * Bills for the currently open term. Restricted to admins by route
     * middleware.
     */
    public function index(): AnonymousResourceCollection
    {
        $term = Term::open();

        $bills = Bill::query()
            ->when($term !== null, fn ($query) => $query->where('term_id', $term->id))
            ->when($term === null, fn ($query) => $query->whereRaw('1 = 0'))
            ->with(['student', 'term', 'items'])
            ->latest()
            ->get();

        return BillResource::collection($bills);
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
     * A single student's bill for the open term. 404 if there's no open term or
     * the student hasn't been billed yet.
     */
    public function showForStudent(Student $student): BillResource
    {
        $term = Term::open();
        abort_if($term === null, 404, 'No term is currently open.');

        $bill = $student->bills()
            ->where('term_id', $term->id)
            ->with(['items', 'term'])
            ->first();

        abort_if($bill === null, 404, 'This student has not been billed yet.');

        return new BillResource($bill);
    }
}
