<?php

namespace App\Http\Controllers;

use App\Http\Resources\EnrollmentResource;
use App\Services\StudentReturningEnrollment;
use Illuminate\Http\Request;

class StudentReturningEnrollmentController extends Controller
{
    public function show(Request $request, StudentReturningEnrollment $returns)
    {
        $student = $request->user()->student;
        abort_unless($student, 404, 'No student record found.');
        return response()->json(['data' => $returns->summary($student)]);
    }

    public function store(Request $request, StudentReturningEnrollment $returns): EnrollmentResource
    {
        $student = $request->user()->student;
        abort_unless($student, 404, 'No student record found.');
        $input = $request->validate([
            'schoolYearId' => ['required', 'integer', 'exists:school_years,id'],
            'studentId' => ['prohibited'], 'program' => ['prohibited'], 'yearLevel' => ['prohibited'],
            'discountId' => ['prohibited'], 'status' => ['prohibited'], 'noDownpayment' => ['prohibited'],
        ]);
        return new EnrollmentResource($returns->start($student, $input['schoolYearId'], $request->user()->id)->load(['schoolYear', 'bill', 'discount']));
    }
}
