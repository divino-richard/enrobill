<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\StudentResource;
use App\Models\SchoolYear;
use App\Models\Student;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class StudentController extends Controller
{
    /**
     * Enrollment lifecycle statuses a student record may hold.
     */
    public const STATUSES = ['admitted', 'enrolled', 'inactive', 'graduated', 'dropped'];

    /**
     * Sortable columns, mapped from their API key to the database column. Acts
     * as an allow-list so a client can't sort by an arbitrary column.
     */
    private const SORTABLE = [
        'studentNumber' => 'student_number',
        'name' => 'last_name',
        'schoolYear' => 'school_year',
        'status' => 'status',
        'createdAt' => 'created_at',
    ];

    /**
     * Paginated, searchable, filterable, sortable list of students. Restricted
     * to admins by route middleware.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $sort = self::SORTABLE[$request->string('sort')->value()] ?? 'last_name';
        $direction = $request->string('dir')->lower()->value() === 'desc' ? 'desc' : 'asc';
        $perPage = min(max($request->integer('per_page', 15), 1), 100);

        $students = Student::query()
            ->when(
                in_array($request->string('status')->value(), self::STATUSES, true),
                fn ($query) => $query->where('status', $request->string('status')->value()),
            )
            ->when($request->filled('search'), function ($query) use ($request) {
                $term = '%'.$request->string('search')->value().'%';
                $query->where(function ($sub) use ($term) {
                    $sub->where('student_number', 'like', $term)
                        ->orWhere('first_name', 'like', $term)
                        ->orWhere('last_name', 'like', $term)
                        ->orWhere('email', 'like', $term);
                });
            })
            ->orderBy($sort, $direction)
            // Stable secondary order so equal values don't shuffle between pages.
            ->when($sort === 'last_name', fn ($query) => $query->orderBy('first_name', $direction))
            ->orderBy('id', $direction)
            ->paginate($perPage)
            ->withQueryString();

        return StudentResource::collection($students);
    }

    /**
     * A single student record.
     */
    public function show(Student $student): StudentResource
    {
        return new StudentResource($student);
    }

    /**
     * Update a student's record.
     */
    public function update(Request $request, Student $student): StudentResource
    {
        $validated = $request->validate([
            'firstName' => ['required', 'string', 'max:100'],
            'middleName' => ['nullable', 'string', 'max:100'],
            'lastName' => ['required', 'string', 'max:100'],
            'extension' => ['nullable', 'string', 'max:20'],
            'dateOfBirth' => ['nullable', 'date'],
            'gender' => ['nullable', 'string', 'max:20'],
            'nationality' => ['nullable', 'string', 'max:100'],
            'civilStatus' => ['nullable', 'string', 'max:50'],
            'placeOfBirth' => ['nullable', 'string', 'max:255'],
            'religion' => ['nullable', 'string', 'max:100'],
            'email' => ['nullable', 'email', 'max:255'],
            'phoneNumber' => ['nullable', 'string', 'max:50'],
            'addressProvince' => ['nullable', 'string', 'max:50'],
            'addressCity' => ['nullable', 'string', 'max:50'],
            'addressBarangay' => ['nullable', 'string', 'max:50'],
            'addressStreet' => ['nullable', 'string', 'max:255'],
            'trackOrStrand' => ['nullable', 'string', 'exists:programs,code'],
            'yearLevel' => ['nullable', Rule::in(SchoolYear::YEAR_LEVELS)],
            'schoolYear' => ['nullable', 'string', 'max:20'],
            'status' => ['required', Rule::in(self::STATUSES)],
        ]);

        $student->update([
            'first_name' => $validated['firstName'],
            'middle_name' => $validated['middleName'] ?? null,
            'last_name' => $validated['lastName'],
            'extension' => $validated['extension'] ?? null,
            'date_of_birth' => $validated['dateOfBirth'] ?? null,
            'gender' => $validated['gender'] ?? null,
            'nationality' => $validated['nationality'] ?? null,
            'civil_status' => $validated['civilStatus'] ?? null,
            'place_of_birth' => $validated['placeOfBirth'] ?? null,
            'religion' => $validated['religion'] ?? null,
            'email' => $validated['email'] ?? null,
            'phone_number' => $validated['phoneNumber'] ?? null,
            'address_province' => $validated['addressProvince'] ?? null,
            'address_city' => $validated['addressCity'] ?? null,
            'address_barangay' => $validated['addressBarangay'] ?? null,
            'address_street' => $validated['addressStreet'] ?? null,
            'track_or_strand' => $validated['trackOrStrand'] ?? null,
            'year_level' => $validated['yearLevel'] ?? null,
            'school_year' => $validated['schoolYear'] ?? null,
            'status' => $validated['status'],
        ]);

        return new StudentResource($student->fresh());
    }
}
