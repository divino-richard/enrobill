<?php

namespace App\Http\Controllers\Admin;

use App\Actions\YearEndCloseout;
use App\Http\Controllers\Controller;
use App\Http\Resources\StudentDocumentResource;
use App\Models\ProgressionDecision;
use App\Models\SchoolYear;
use App\Models\Student;
use App\Models\StudentDocument;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProgressionController extends Controller
{
    public function __construct(private YearEndCloseout $closeout) {}

    /**
     * The year-end close-out for the active (ending) school year: students still
     * awaiting a decision, and the decisions already recorded. Empty unless the
     * active year's progression window is open.
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
                    'pending' => [],
                    'decided' => [],
                ],
            ]);
        }

        $top = $this->topLevel();

        $pendingStudents = $this->closeout->pendingStudents($active);

        // The clearance / grade slips these students uploaded for the ending year,
        // grouped per student so the admin can read them before deciding.
        $documents = StudentDocument::query()
            ->whereIn('student_id', $pendingStudents->pluck('id'))
            ->where('school_year_id', $active->id)
            ->get()
            ->groupBy('student_id');

        $pending = $pendingStudents
            ->map(fn (Student $student) => [
                'studentId' => $student->id,
                'studentNumber' => $student->student_number,
                'name' => trim($student->first_name.' '.$student->last_name),
                'track' => $student->track_or_strand,
                'yearLevel' => $student->year_level,
                'nextYearLevel' => $this->nextLevel($student->year_level),
                'isTopGrade' => $student->year_level === $top,
                'documents' => StudentDocumentResource::collection(
                    $documents->get($student->id, collect()),
                ),
            ])
            ->values();

        $decided = $this->closeout->decisions($active)
            ->map(function (ProgressionDecision $decision) {
                $billed = $decision->toEnrollment && $decision->toEnrollment->bill;

                return [
                    'id' => $decision->id,
                    'studentId' => $decision->student_id,
                    'studentNumber' => $decision->student?->student_number,
                    'name' => trim(($decision->student?->first_name ?? '').' '.($decision->student?->last_name ?? '')),
                    'track' => $decision->student?->track_or_strand,
                    'decision' => $decision->decision,
                    'fromYearLevel' => $decision->from_year_level,
                    'toYearLevel' => $decision->to_year_level,
                    'materialized' => $decision->materialized_at !== null,
                    // A materialized, already-billed enrollment can't be undone here.
                    'revertable' => ! $billed,
                ];
            })
            ->values();

        $next = $this->closeout->nextYear($active);

        return response()->json([
            'data' => [
                'activeYear' => $this->yearRef($active),
                'nextYear' => $next ? $this->yearRef($next) : null,
                'progressionOpen' => true,
                'pending' => $pending,
                'decided' => $decided,
            ],
        ]);
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
