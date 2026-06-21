<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\EnrollmentResource;
use App\Models\Enrollment;
use App\Models\Student;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class EnrollmentController extends Controller
{
    /**
     * The lifecycle states an enrollment may hold.
     */
    public const STATUSES = ['pending', 'enrolled', 'dropped', 'completed', 'withdrawn'];

    /**
     * A student's enrollments across every term, newest first.
     */
    public function index(Student $student): AnonymousResourceCollection
    {
        $records = $student->enrollments()
            ->with('term')
            ->get()
            ->sortByDesc(
                fn (Enrollment $e) => ($e->term?->school_year ?? '').'|'.($e->term?->semester ?? ''),
            )
            ->values();

        return EnrollmentResource::collection($records);
    }

    /**
     * Update an enrollment's status (enroll / drop / withdraw / complete) and
     * mirror the change onto the student's global status.
     */
    public function update(Request $request, Enrollment $enrollment): EnrollmentResource
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in(self::STATUSES)],
        ]);

        $enrollment->update([
            'status' => $validated['status'],
            // Stamp the enrollment date the first time it becomes enrolled.
            'enrolled_at' => $validated['status'] === 'enrolled'
                ? ($enrollment->enrolled_at ?? now())
                : $enrollment->enrolled_at,
        ]);

        $enrollment->student?->syncStatusFromLatestEnrollment();

        return new EnrollmentResource($enrollment->fresh()->load('term'));
    }
}
