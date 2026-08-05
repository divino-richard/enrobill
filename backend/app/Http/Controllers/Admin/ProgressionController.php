<?php

namespace App\Http\Controllers\Admin;

use App\Actions\YearEndCloseout;
use App\Http\Controllers\Controller;
use App\Http\Resources\StudentDocumentResource;
use App\Models\ProgressionDecision;
use App\Models\SchoolYear;
use App\Models\SemesterStanding;
use App\Models\Student;
use App\Models\StudentDocument;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ProgressionController extends Controller
{
    public function __construct(private YearEndCloseout $closeout) {}

    /**
     * The year-end close-out for the active (ending) school year: students still
     * awaiting a decision, and the decisions already recorded. Empty unless the
     * active year's progression window is open.
     */
    /**
     * Close-out summary for the active year: the header banners and counts. The
     * student rows are paginated separately via `students`.
     */
    public function index(): JsonResponse
    {
        $active = SchoolYear::active();

        if ($active === null || ! $active->isProgressionOpen()) {
            return response()->json([
                'data' => [
                    'activeYear' => $active ? $this->yearRef($active) : null,
                    'nextYear' => null,
                    'progressionOpen' => false,
                    'pending' => 0,
                    'readyToEnroll' => 0,
                ],
            ]);
        }

        $next = $this->closeout->nextYear($active);
        $readyToEnroll = $this->closeout->decisions($active)
            ->filter->needsMaterialization()
            ->count();

        return response()->json([
            'data' => [
                'activeYear' => $this->yearRef($active),
                'nextYear' => $next ? $this->yearRef($next) : null,
                'progressionOpen' => true,
                'pending' => $this->closeout->pendingStudents($active)->count(),
                'readyToEnroll' => $readyToEnroll,
            ],
        ]);
    }

    /**
     * The unified, filtered, server-paginated close-out roster: every student in
     * the ending year — pending or decided — in one list.
     */
    public function students(Request $request): JsonResponse
    {
        $active = SchoolYear::active();
        abort_if($active === null, 422, 'No school year is currently active.');
        abort_unless($active->isProgressionOpen(), 422, 'Progression is not open for the active school year.');

        $validated = $request->validate([
            'page' => ['sometimes', 'integer', 'min:1'],
            'perPage' => ['sometimes', 'integer', 'min:1', 'max:50'],
            'search' => ['sometimes', 'nullable', 'string', 'max:100'],
            'status' => ['sometimes', 'nullable', Rule::in(['pending', 'decided'])],
            'outcome' => ['sometimes', 'nullable', Rule::in(ProgressionDecision::DECISIONS)],
            'grade' => ['sometimes', 'nullable', Rule::in(SchoolYear::YEAR_LEVELS)],
            'program' => ['sometimes', 'nullable', 'string'],
            'clearance' => ['sometimes', 'nullable', Rule::in(['eligible', 'incomplete'])],
        ]);

        $hasDecision = fn ($q) => $q->where('from_school_year_id', $active->id);

        $query = Student::query()->where(function ($q) use ($active, $hasDecision) {
            // Relevant to close-out: still enrolled in the ending year, or already
            // decided (graduation completes the enrollment, so it only matches here).
            $q->whereHas('enrollments', fn ($e) => $e
                ->where('school_year_id', $active->id)
                ->where('status', 'enrolled'))
                ->orWhereHas('progressionDecisions', $hasDecision);
        });

        if (! empty($validated['search'])) {
            $term = trim($validated['search']);
            $query->where(fn ($q) => $q
                ->where('first_name', 'like', "%{$term}%")
                ->orWhere('last_name', 'like', "%{$term}%")
                ->orWhere('student_number', 'like', "%{$term}%"));
        }

        if (! empty($validated['grade'])) {
            $query->where('year_level', $validated['grade']);
        }

        if (! empty($validated['program'])) {
            $query->where('track_or_strand', $validated['program']);
        }

        if (($validated['status'] ?? null) === 'pending') {
            $query->whereDoesntHave('progressionDecisions', $hasDecision);
        } elseif (($validated['status'] ?? null) === 'decided') {
            $query->whereHas('progressionDecisions', $hasDecision);
        }

        if (! empty($validated['outcome'])) {
            $query->whereHas('progressionDecisions', fn ($d) => $d
                ->where('from_school_year_id', $active->id)
                ->where('decision', $validated['outcome']));
        }

        if (! empty($validated['clearance'])) {
            $eligibleIds = SemesterStanding::query()
                ->where('school_year_id', $active->id)
                ->where('clearance_cleared', true)
                ->where('grades_passed', true)
                ->groupBy('student_id')
                ->havingRaw('count(distinct semester) = ?', [count(SemesterStanding::SEMESTERS)])
                ->pluck('student_id');

            $validated['clearance'] === 'eligible'
                ? $query->whereIn('id', $eligibleIds)
                : $query->whereNotIn('id', $eligibleIds);
        }

        $page = $query
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->paginate($validated['perPage'] ?? 10);

        $ids = collect($page->items())->pluck('id');

        $documents = StudentDocument::query()
            ->whereIn('student_id', $ids)
            ->where('school_year_id', $active->id)
            ->get()
            ->groupBy('student_id');

        $standings = SemesterStanding::query()
            ->whereIn('student_id', $ids)
            ->where('school_year_id', $active->id)
            ->get()
            ->groupBy('student_id');

        $decisions = ProgressionDecision::query()
            ->whereIn('student_id', $ids)
            ->where('from_school_year_id', $active->id)
            ->with('toEnrollment.bill')
            ->get()
            ->keyBy('student_id');

        $top = $this->topLevel();

        $rows = collect($page->items())->map(function (Student $student) use ($documents, $standings, $decisions, $top) {
            $docs = $documents->get($student->id, collect());
            $review = $this->buildReview($standings->get($student->id, collect()), $docs);
            $eligible = collect(SemesterStanding::SEMESTERS)->every(
                fn ($s) => $review[$s]['clearanceCleared'] && $review[$s]['gradesPassed'],
            );

            $decision = $decisions->get($student->id);
            $billed = $decision?->toEnrollment && $decision->toEnrollment->bill;

            return [
                'studentId' => $student->id,
                'studentNumber' => $student->student_number,
                'name' => trim($student->first_name.' '.$student->last_name),
                'track' => $student->track_or_strand,
                'yearLevel' => $student->year_level,
                'nextYearLevel' => $this->nextLevel($student->year_level),
                'isTopGrade' => $student->year_level === $top,
                'documents' => StudentDocumentResource::collection($docs),
                'review' => $review,
                'eligible' => $eligible,
                'status' => $decision ? 'decided' : 'pending',
                'decision' => $decision?->decision,
                'decisionId' => $decision?->id,
                'fromYearLevel' => $decision?->from_year_level,
                'toYearLevel' => $decision?->to_year_level,
                'materialized' => $decision ? $decision->materialized_at !== null : null,
                'revertable' => $decision ? ! $billed : null,
            ];
        });

        return response()->json([
            'data' => $rows,
            'meta' => [
                'page' => $page->currentPage(),
                'perPage' => $page->perPage(),
                'total' => $page->total(),
                'lastPage' => $page->lastPage(),
            ],
        ]);
    }

    /**
     * Accept or return one clearance/grades requirement for a semester of the
     * active year — one field at a time, so accepting one never touches the
     * other's stored state. Gates the promote/graduate decision; no
     * enrollment or billing impact. Returning requires a reason: it's the
     * only way the student learns what to fix, and it's what unlocks the
     * file for them to replace.
     */
    public function review(Request $request): JsonResponse
    {
        $active = SchoolYear::active();
        abort_if($active === null, 422, 'No school year is currently active.');

        $validated = $request->validate([
            'studentId' => ['required', 'integer'],
            'semester' => ['required', Rule::in(SemesterStanding::SEMESTERS)],
            'field' => ['required', Rule::in(['clearance', 'grades'])],
            'accepted' => ['required', 'boolean'],
            'note' => ['nullable', 'string', 'max:1000', 'required_if:accepted,false'],
        ]);

        // Only students actually enrolled in the active year can be reviewed.
        $isEnrolled = Student::query()
            ->whereKey($validated['studentId'])
            ->whereHas('enrollments', fn ($q) => $q
                ->where('school_year_id', $active->id)
                ->where('status', 'enrolled'))
            ->exists();

        abort_unless($isEnrolled, 404);

        $field = $validated['field'];

        // A slot can't be accepted without the file that proves it.
        if ($validated['accepted']) {
            $uploaded = StudentDocument::query()
                ->where('student_id', $validated['studentId'])
                ->where('school_year_id', $active->id)
                ->where('semester', $validated['semester'])
                ->where('type', $field)
                ->exists();

            if (! $uploaded) {
                throw ValidationException::withMessages([
                    'accepted' => "Upload the {$field} for this semester before accepting it.",
                ]);
            }
        }

        SemesterStanding::updateOrCreate(
            [
                'student_id' => $validated['studentId'],
                'school_year_id' => $active->id,
                'semester' => $validated['semester'],
            ],
            [
                ($field === 'clearance' ? 'clearance_cleared' : 'grades_passed') => $validated['accepted'],
                ($field === 'clearance' ? 'clearance_note' : 'grades_note') => $validated['accepted']
                    ? null
                    : $validated['note'],
                'reviewed_by' => $request->user()?->id,
                'reviewed_at' => now(),
            ],
        );

        $student = Student::findOrFail($validated['studentId']);

        return response()->json([
            'data' => ['eligible' => $this->closeout->isFullyCleared($student, $active)],
        ]);
    }

    /**
     * Per-semester review for a student: the marked flags plus whether the file
     * each depends on exists (so the UI can disable a check with nothing to prove
     * it). Filled for every semester.
     *
     * @param  Collection<int, SemesterStanding>  $standings
     * @param  Collection<int, StudentDocument>  $documents
     * @return array<string, array{clearanceCleared: bool, clearanceNote: ?string, gradesPassed: bool, gradesNote: ?string, hasClearanceDoc: bool, hasGradesDoc: bool}>
     */
    private function buildReview($standings, $documents): array
    {
        $bySemester = $standings->keyBy('semester');

        $map = [];
        foreach (SemesterStanding::SEMESTERS as $semester) {
            $row = $bySemester->get($semester);
            $has = fn (string $type) => $documents
                ->contains(fn ($d) => $d->semester === $semester && $d->type === $type);

            $map[$semester] = [
                'clearanceCleared' => (bool) ($row?->clearance_cleared ?? false),
                'clearanceNote' => $row?->clearance_note,
                'gradesPassed' => (bool) ($row?->grades_passed ?? false),
                'gradesNote' => $row?->grades_note,
                'hasClearanceDoc' => $has('clearance'),
                'hasGradesDoc' => $has('grades'),
            ];
        }

        return $map;
    }

    /**
     * Record a decision (promote / retain / graduate) for the selected students.
     */
    public function decide(Request $request): JsonResponse
    {
        $active = $this->openYearOrAbort();

        $validated = $request->validate([
            'studentIds' => ['required', 'array', 'min:1'],
            'studentIds.*' => ['integer'],
            'decision' => ['required', Rule::in(ProgressionDecision::DECISIONS)],
        ]);

        $count = $this->closeout->decide(
            $active,
            $validated['studentIds'],
            $validated['decision'],
            $request->user()?->id,
        );

        return response()->json(['data' => ['decided' => $count]]);
    }

    /**
     * Enroll every promote/retain decision into the next school year.
     */
    public function materialize(Request $request): JsonResponse
    {
        $active = $this->openYearOrAbort();

        $count = $this->closeout->materialize($active, $request->user()?->id);

        return response()->json(['data' => ['materialized' => $count]]);
    }

    /**
     * Undo the selected decisions, reversing their effects.
     */
    public function revert(Request $request): JsonResponse
    {
        $active = $this->openYearOrAbort();

        $validated = $request->validate([
            'decisionIds' => ['required', 'array', 'min:1'],
            'decisionIds.*' => ['integer'],
        ]);

        $count = $this->closeout->revert($active, $validated['decisionIds']);

        return response()->json(['data' => ['reverted' => $count]]);
    }

    private function openYearOrAbort(): SchoolYear
    {
        $active = SchoolYear::active();
        abort_if($active === null, 422, 'No school year is currently active.');
        abort_unless($active->isProgressionOpen(), 422, 'Progression is not open for the active school year.');

        return $active;
    }

    /**
     * @return array<string, mixed>
     */
    private function yearRef(SchoolYear $year): array
    {
        return ['id' => $year->id, 'schoolYear' => $year->school_year];
    }

    private function topLevel(): string
    {
        $levels = SchoolYear::YEAR_LEVELS;

        return end($levels);
    }

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
