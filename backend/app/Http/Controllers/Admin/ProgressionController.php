<?php

namespace App\Http\Controllers\Admin;

use App\Actions\EnsureEnrollment;
use App\Http\Controllers\Controller;
use App\Models\Enrollment;
use App\Models\SchoolYear;
use App\Models\Student;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ProgressionController extends Controller
{
    public function __construct(private EnsureEnrollment $ensureEnrollment) {}

    /**
     * Year-end queues for the active school year:
     *  - candidates: continuing students below the top grade awaiting a decision.
     *  - graduates:  finishing top-grade students awaiting a decision.
     *  - revertible: students already decided (promoted/retained) but not yet
     *                billed, so the decision can still be undone.
     */
    public function index(): JsonResponse
    {
        $schoolYear = SchoolYear::active();

        if ($schoolYear === null) {
            return response()->json([
                'data' => ['openTerm' => null, 'candidates' => [], 'graduates' => [], 'revertible' => []],
            ]);
        }

        $sy = $schoolYear->school_year;

        $candidates = $this->pending($sy)
            ->where('year_level', '!=', $this->topLevel())
            ->get()
            ->map(fn (Student $student) => [
                'id' => $student->id,
                'studentNumber' => $student->student_number,
                'name' => trim($student->first_name.' '.$student->last_name),
                'track' => $student->track_or_strand,
                'currentYearLevel' => $student->year_level,
                'nextYearLevel' => $this->nextLevel($student->year_level),
            ])
            ->values();

        $graduates = $this->pending($sy)
            ->where('year_level', $this->topLevel())
            ->get()
            ->map(fn (Student $student) => [
                'id' => $student->id,
                'studentNumber' => $student->student_number,
                'name' => trim($student->first_name.' '.$student->last_name),
                'track' => $student->track_or_strand,
                'currentYearLevel' => $student->year_level,
            ])
            ->values();

        $revertible = $this->revertible($sy)
            ->map(fn (Student $student) => [
                'id' => $student->id,
                'studentNumber' => $student->student_number,
                'name' => trim($student->first_name.' '.$student->last_name),
                'track' => $student->track_or_strand,
                'currentYearLevel' => $student->year_level,
                'previousYearLevel' => $this->priorLevel($student, $sy),
            ])
            ->values();

        return response()->json([
            'data' => [
                'openTerm' => [
                    'schoolYear' => $schoolYear->school_year,
                    'semester' => $schoolYear->current_semester,
                ],
                'candidates' => $candidates,
                'graduates' => $graduates,
                'revertible' => $revertible,
            ],
        ]);
    }

    /**
     * Promote the selected students: advance a grade and open a pending enrollment
     * for the new school year at the new grade. The cashier generates the bill
     * later. Re-checks eligibility per student. Returns how many were promoted.
     */
    public function store(Request $request): JsonResponse
    {
        $schoolYear = SchoolYear::active();
        abort_if($schoolYear === null, 422, 'No school year is currently active.');

        $ids = $this->validatedIds($request);

        $students = $this->pending($schoolYear->school_year)
            ->where('year_level', '!=', $this->topLevel())
            ->whereIn('id', $ids)
            ->get();

        $count = DB::transaction(function () use ($students, $schoolYear) {
            $done = 0;
            foreach ($students as $student) {
                $student->update(['year_level' => $this->nextLevel($student->year_level)]);
                ($this->ensureEnrollment)($student, $schoolYear, request()->user()?->id);
                $done++;
            }

            return $done;
        });

        return response()->json(['data' => ['promoted' => $count]]);
    }

    /**
     * Retain the selected students: keep their current grade and open a pending
     * enrollment for the new school year (a junior repeating, or a finisher
     * repeating the top grade). The cashier generates the bill later. Re-checks
     * eligibility. Returns how many retained.
     */
    public function retain(Request $request): JsonResponse
    {
        $schoolYear = SchoolYear::active();
        abort_if($schoolYear === null, 422, 'No school year is currently active.');

        $ids = $this->validatedIds($request);

        $students = $this->pending($schoolYear->school_year)
            ->whereIn('id', $ids)
            ->get();

        $count = DB::transaction(function () use ($students, $schoolYear) {
            $done = 0;
            foreach ($students as $student) {
                ($this->ensureEnrollment)($student, $schoolYear, request()->user()?->id);
                $done++;
            }

            return $done;
        });

        return response()->json(['data' => ['retained' => $count]]);
    }

    /**
     * Graduate the selected finishing students. Marks their latest enrollment
     * completed and mirrors it onto the student's status. Re-checks eligibility.
     * Returns how many were graduated.
     */
    public function graduate(Request $request): JsonResponse
    {
        $schoolYear = SchoolYear::active();
        abort_if($schoolYear === null, 422, 'No school year is currently active.');

        $ids = $this->validatedIds($request);

        $students = $this->pending($schoolYear->school_year)
            ->where('year_level', $this->topLevel())
            ->whereIn('id', $ids)
            ->with(['enrollments.schoolYear'])
            ->get();

        $count = DB::transaction(function () use ($students) {
            $done = 0;
            foreach ($students as $student) {
                $latest = $student->enrollments
                    ->sortByDesc(fn (Enrollment $e) => $e->schoolYear?->school_year ?? '')
                    ->first();

                $latest?->update(['status' => 'completed']);
                $student->syncStatusFromLatestEnrollment();
                $done++;
            }

            return $done;
        });

        return response()->json(['data' => ['graduated' => $count]]);
    }

    /**
     * Undo a promotion/retention for the selected students: delete the pending,
     * not-yet-billed enrollment for the active school year and restore the grade of
     * their latest prior enrollment. Re-checks eligibility. Returns how many were
     * reverted.
     */
    public function revert(Request $request): JsonResponse
    {
        $schoolYear = SchoolYear::active();
        abort_if($schoolYear === null, 422, 'No school year is currently active.');

        $ids = $this->validatedIds($request);

        $students = $this->revertible($schoolYear->school_year)
            ->whereIn('id', $ids);

        $count = DB::transaction(function () use ($students, $schoolYear) {
            $done = 0;
            foreach ($students as $student) {
                $prior = $this->priorLevel($student, $schoolYear->school_year);

                $student->enrollments()
                    ->where('school_year_id', $schoolYear->id)
                    ->whereDoesntHave('bill')
                    ->delete();

                if ($prior !== null) {
                    $student->update(['year_level' => $prior]);
                }
                $done++;
            }

            return $done;
        });

        return response()->json(['data' => ['reverted' => $count]]);
    }

    /**
     * @return array<int, int>
     */
    private function validatedIds(Request $request): array
    {
        return $request->validate([
            'studentIds' => ['required', 'array', 'min:1'],
            'studentIds.*' => ['integer'],
        ])['studentIds'];
    }

    /**
     * Continuing (enrolled) students still awaiting a year-end decision: they
     * have no enrollment yet for the given school year.
     *
     * @return Builder<Student>
     */
    private function pending(string $schoolYear): Builder
    {
        return Student::query()
            ->where('status', 'enrolled')
            ->whereNotNull('year_level')
            ->whereDoesntHave('enrollments', function ($query) use ($schoolYear) {
                $query->whereHas('schoolYear', fn ($sy) => $sy->where('school_year', $schoolYear));
            })
            ->orderBy('last_name')
            ->orderBy('first_name');
    }

    /**
     * Continuing students whose year-end decision (promote/retain) can still be
     * undone: they were already enrolled, have a pending **not-yet-billed**
     * enrollment for this school year, and have a prior-year enrollment to restore.
     * Newly accepted/admitted first-timers are excluded (no prior grade).
     *
     * @return Collection<int, Student>
     */
    private function revertible(string $schoolYear): Collection
    {
        return Student::query()
            ->where('status', 'enrolled')
            // A decided-but-unbilled enrollment for this year.
            ->whereHas('enrollments', function ($query) use ($schoolYear) {
                $query->whereHas('schoolYear', fn ($sy) => $sy->where('school_year', $schoolYear))
                    ->whereDoesntHave('bill');
            })
            // …and a prior-year enrollment — i.e. a continuing student, not a
            // first-time admission.
            ->whereHas('enrollments', function ($query) use ($schoolYear) {
                $query->whereHas('schoolYear', fn ($sy) => $sy->where('school_year', '!=', $schoolYear));
            })
            ->with(['enrollments.schoolYear'])
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get();
    }

    /**
     * The grade of the student's latest enrollment outside the given school year
     * — the grade they'd return to if the year's decision is undone.
     */
    private function priorLevel(Student $student, string $excludeSchoolYear): ?string
    {
        $latest = $student->enrollments
            ->filter(fn (Enrollment $e) => $e->schoolYear?->school_year !== $excludeSchoolYear)
            ->sortByDesc(fn (Enrollment $e) => $e->schoolYear?->school_year ?? '')
            ->first();

        return $latest?->year_level;
    }

    private function topLevel(): string
    {
        $levels = SchoolYear::YEAR_LEVELS;

        return end($levels);
    }

    /**
     * The grade after the given one, or the same grade if already at the top.
     */
    private function nextLevel(?string $current): ?string
    {
        $levels = SchoolYear::YEAR_LEVELS;
        $index = array_search($current, $levels, true);

        if ($index === false || $index + 1 >= count($levels)) {
            return $current;
        }

        return $levels[$index + 1];
    }
}
