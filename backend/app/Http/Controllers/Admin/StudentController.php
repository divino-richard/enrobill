<?php

namespace App\Http\Controllers\Admin;

use App\Actions\GenerateBillForStudent;
use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Resources\StudentResource;
use App\Models\SchoolYear;
use App\Models\Student;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
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
     * Admit a walk-in student directly (for applicants who didn't apply online).
     * Creates their login account and student record, opens a pending enrollment
     * for the active school year, and generates their bill (when fees exist) so it
     * shows immediately. Further details can be edited afterwards.
     */
    public function store(Request $request, GenerateBillForStudent $generateBill): StudentResource
    {
        $validated = $request->validate([
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => [
                'required',
                'confirmed',
                'string',
                'min:8',
                'regex:/[A-Z]/',
                'regex:/\d/',
            ],
            'firstName' => ['required', 'string', 'max:100'],
            'middleName' => ['nullable', 'string', 'max:100'],
            'lastName' => ['required', 'string', 'max:100'],
            'trackOrStrand' => ['required', 'string', 'exists:programs,code'],
            'yearLevel' => ['required', Rule::in(SchoolYear::YEAR_LEVELS)],
            'schoolYear' => ['required', 'string', 'max:20'],
            'noDownpayment' => ['sometimes', 'boolean'],
        ], [
            'password.min' => 'Password must be at least 8 characters.',
            'password.regex' => 'Password must include an uppercase letter and a number.',
            'password.confirmed' => 'Password and confirmation do not match.',
            'email.unique' => 'An account with this email already exists.',
        ]);

        // Admitting bills the student immediately, so the active school year must
        // already have a fee schedule — otherwise we'd enroll without a bill.
        $schoolYear = SchoolYear::active();
        abort_if($schoolYear === null, 422, 'No school year is currently active.');
        abort_if(
            $schoolYear->fees()->count() === 0,
            422,
            "Set up fees for SY {$schoolYear->school_year} before admitting students.",
        );

        $student = DB::transaction(function () use ($validated, $generateBill, $request, $schoolYear) {
            $fullName = Str::squish(
                "{$validated['firstName']} ".($validated['middleName'] ?? '')." {$validated['lastName']}"
            );

            // Admin-created accounts are trusted — verified immediately so the
            // student can sign in right away.
            $user = User::create([
                'name' => $fullName,
                'first_name' => $validated['firstName'],
                'middle_name' => $validated['middleName'] ?? null,
                'last_name' => $validated['lastName'],
                'email' => $validated['email'],
                'password' => $validated['password'],
                'role' => Role::Student,
                'email_verified_at' => now(),
            ]);

            $student = $user->student()->create([
                'student_number' => Str::uuid()->toString(),
                'status' => 'admitted',
                'first_name' => $validated['firstName'],
                'middle_name' => $validated['middleName'] ?? null,
                'last_name' => $validated['lastName'],
                'email' => $validated['email'],
                'track_or_strand' => $validated['trackOrStrand'],
                'year_level' => $validated['yearLevel'],
                'school_year' => $validated['schoolYear'],
            ]);

            $student->forceFill([
                'student_number' => sprintf('%d-%05d', $student->created_at->year, $student->id),
            ])->save();

            // Open a pending enrollment + generate the bill for the active year.
            $generateBill(
                $student,
                $schoolYear,
                $request->user()?->id,
                (bool) ($validated['noDownpayment'] ?? false),
            );

            return $student;
        });

        return new StudentResource($student->fresh());
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
