<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\EnrollmentResource;
use App\Models\Enrollment;
use App\Models\SchoolYear;
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

    private const SORTABLE = [
        'status' => 'status',
        'createdAt' => 'created_at',
    ];

    /**
     * All enrollments — paginated, searchable by student, filterable by status and
     * school year, sortable. A read-only overview across the school. Restricted to
     * admins/cashiers by route middleware.
     */
    public function all(Request $request): AnonymousResourceCollection
    {
        $direction = $request->string('dir')->lower()->value() === 'desc' ? 'desc' : 'asc';
        $perPage = min(max($request->integer('per_page', 15), 1), 100);
        $sortKey = $request->string('sort')->value();

        $query = Enrollment::query()
            ->with([
                'student' => fn ($student) => $student->with([
                    'bills' => fn ($bill) => $bill
                        ->where('status', '!=', 'paid')
                        ->with(['schoolYear', 'adjustments'])
                        ->orderByDesc('school_year_id')
                        ->orderByDesc('id'),
                ]),
                'schoolYear.fees',
                'bill',
            ])
            ->when(
                in_array($request->string('status')->value(), self::STATUSES, true),
                fn ($q) => $q->where('status', $request->string('status')->value()),
            )
            ->when(
                $request->filled('school_year_id'),
                fn ($q) => $q->where('school_year_id', $request->integer('school_year_id')),
            )
            ->when(
                in_array($request->string('year_level')->value(), SchoolYear::YEAR_LEVELS, true),
                fn ($q) => $q->where('year_level', $request->string('year_level')->value()),
            )
            ->when(
                $request->filled('program_code'),
                fn ($q) => $q->where('track', $request->string('program_code')->value()),
            )
            ->when($request->filled('search'), function ($q) use ($request) {
                $needle = '%'.$request->string('search')->value().'%';
                $q->whereHas('student', function ($s) use ($needle) {
                    $s->where('first_name', 'like', $needle)
                        ->orWhere('last_name', 'like', $needle)
                        ->orWhere('student_number', 'like', $needle);
                });
            });

        if ($sortKey === 'student') {
            // Sort by first name to match the "First Last" display in the table.
            $query->orderBy(
                Student::select('first_name')->whereColumn('students.id', 'enrollments.student_id'),
                $direction,
            );
        } elseif (isset(self::SORTABLE[$sortKey])) {
            $query->orderBy(self::SORTABLE[$sortKey], $direction);
        } else {
            $query->latest();
        }

        $query->orderBy('id', $direction);

        return EnrollmentResource::collection($query->paginate($perPage)->withQueryString());
    }

    /**
     * A student's enrollments across every term, newest first.
     */
    public function index(Student $student): AnonymousResourceCollection
    {
        $records = $student->enrollments()
            ->with('schoolYear')
            ->get()
            ->sortByDesc(fn (Enrollment $e) => $e->schoolYear?->school_year ?? '')
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

        return new EnrollmentResource($enrollment->fresh()->load('schoolYear'));
    }
}
