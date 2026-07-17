<?php

namespace App\Actions;

use App\Models\Discount;
use App\Models\Enrollment;
use App\Models\ProgressionDecision;
use App\Models\SchoolYear;
use App\Models\Student;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Year-end close-out for the *ending* school year. Records an explicit decision
 * per student (promote / retain / graduate), then materializes promote/retain
 * decisions into next-year enrollments as a separate, lazy step. Graduation is
 * terminal and needs no following year.
 */
class YearEndCloseout
{
    public function __construct(private EnsureEnrollment $ensureEnrollment) {}

    /**
     * Enrolled students in the ending year still awaiting a decision.
     *
     * @return Collection<int, Student>
     */
    public function pendingStudents(SchoolYear $year): Collection
    {
        return Student::query()
            ->where('status', 'enrolled')
            ->whereHas('enrollments', fn ($q) => $q
                ->where('school_year_id', $year->id)
                ->where('status', 'enrolled'))
            ->whereDoesntHave('progressionDecisions', fn ($q) => $q
                ->where('from_school_year_id', $year->id))
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get();
    }

    /**
     * Decisions already recorded for the ending year, newest first.
     *
     * @return Collection<int, ProgressionDecision>
     */
    public function decisions(SchoolYear $year): Collection
    {
        return ProgressionDecision::query()
            ->where('from_school_year_id', $year->id)
            ->with(['student', 'toEnrollment.bill'])
            ->latest('decided_at')
            ->get();
    }

    /**
     * The chronologically next existing school year — where promote/retain
     * decisions are enrolled. Null when it hasn't been created yet.
     */
    public function nextYear(SchoolYear $year): ?SchoolYear
    {
        return SchoolYear::query()
            ->where('school_year', '>', $year->school_year)
            ->orderBy('school_year')
            ->first();
    }

    /**
     * Record a decision for each eligible student in the ending year. Ineligible
     * students (e.g. promoting a top-grade student) are skipped. Returns the count
     * actually decided.
     *
     * @param  array<int, int>  $studentIds
     */
    public function decide(SchoolYear $year, array $studentIds, string $decision, ?int $userId): int
    {
        if (! in_array($decision, ProgressionDecision::DECISIONS, true)) {
            throw ValidationException::withMessages(['decision' => 'Unknown decision.']);
        }

        $students = $this->pendingStudents($year)
            ->whereIn('id', $studentIds)
            ->filter(fn (Student $s) => $this->eligibleFor($s, $decision));

        return DB::transaction(function () use ($students, $year, $decision, $userId) {
            $done = 0;
            foreach ($students as $student) {
                $this->applyDecision($student, $year, $decision, $userId);
                $done++;
            }

            return $done;
        });
    }

    /**
     * Enroll every not-yet-materialized promote/retain decision into the next
     * school year. Requires that year to exist. Returns the count materialized.
     */
    public function materialize(SchoolYear $year, ?int $userId): int
    {
        $next = $this->nextYear($year);

        $pending = $this->decisions($year)->filter->needsMaterialization();

        if ($pending->isEmpty()) {
            return 0;
        }

        if ($next === null) {
            throw ValidationException::withMessages([
                'nextYear' => 'Create the next school year before enrolling promoted or retained students.',
            ]);
        }

        return DB::transaction(function () use ($pending, $next, $year, $userId) {
            $done = 0;
            foreach ($pending as $decision) {
                // A voucher granted on admission covers the student's whole senior
                // high run, and progression has no accept step to re-grant it, so
                // it rides along to the new year's enrollment.
                $enrollment = ($this->ensureEnrollment)(
                    $decision->student,
                    $next,
                    $userId,
                    $this->grantedVoucherId($decision->student, $year),
                );
                $decision->update([
                    'to_school_year_id' => $next->id,
                    'to_enrollment_id' => $enrollment->id,
                    'materialized_at' => now(),
                ]);
                $done++;
            }

            return $done;
        });
    }

    /**
     * The voucher the student holds in the ending year, if it is still one the
     * catalog grants. A voucher retired since admission is not carried into the new
     * year — the cashier would not be able to apply it there either.
     */
    private function grantedVoucherId(Student $student, SchoolYear $year): ?int
    {
        $discountId = Enrollment::query()
            ->where('student_id', $student->id)
            ->where('school_year_id', $year->id)
            ->value('discount_id');

        if ($discountId === null) {
            return null;
        }

        return Discount::query()
            ->whereKey($discountId)
            ->where('is_active', true)
            ->value('id');
    }

    /**
     * Undo the given decisions for the ending year: reverse their effects and
     * delete the records. A materialized decision whose next-year enrollment has
     * already been billed is skipped. Returns the count reverted.
     *
     * @param  array<int, int>  $decisionIds
     */
    public function revert(SchoolYear $year, array $decisionIds): int
    {
        $decisions = ProgressionDecision::query()
            ->where('from_school_year_id', $year->id)
            ->whereIn('id', $decisionIds)
            ->with(['student', 'toEnrollment.bill'])
            ->get();

        return DB::transaction(function () use ($decisions, $year) {
            $done = 0;
            foreach ($decisions as $decision) {
                // A billed next-year enrollment can't be undone here.
                if ($decision->toEnrollment && $decision->toEnrollment->bill) {
                    continue;
                }

                $this->reverseDecision($decision, $year);
                $done++;
            }

            return $done;
        });
    }

    /**
     * Whether a student may receive the given decision. Only top-grade students
     * graduate; only non-top students promote; anyone may be retained.
     */
    private function eligibleFor(Student $student, string $decision): bool
    {
        return match ($decision) {
            'promote' => $student->year_level !== $this->topLevel(),
            'graduate' => $student->year_level === $this->topLevel(),
            default => true, // retain
        };
    }

    private function applyDecision(Student $student, SchoolYear $year, string $decision, ?int $userId): void
    {
        $toLevel = match ($decision) {
            'promote' => $this->nextLevel($student->year_level),
            'retain' => $student->year_level,
            default => null, // graduate
        };

        ProgressionDecision::create([
            'student_id' => $student->id,
            'from_school_year_id' => $year->id,
            'decision' => $decision,
            'from_year_level' => $student->year_level,
            'to_year_level' => $toLevel,
            'decided_by' => $userId,
            'decided_at' => now(),
        ]);

        if ($decision === 'graduate') {
            // Complete the ending year's enrollment; the status mirror graduates them.
            $student->enrollments()
                ->where('school_year_id', $year->id)
                ->update(['status' => 'completed']);
            $student->syncStatusFromLatestEnrollment();

            return;
        }

        // Promote advances the grade now; retain keeps it. The student stays
        // enrolled and is carried into the next year on materialization.
        if ($decision === 'promote') {
            $student->update(['year_level' => $toLevel]);
        }
    }

    private function reverseDecision(ProgressionDecision $decision, SchoolYear $year): void
    {
        $student = $decision->student;

        if ($decision->decision === 'graduate') {
            // Reopen the ending year's enrollment and restore enrolled standing.
            $student->enrollments()
                ->where('school_year_id', $year->id)
                ->where('status', 'completed')
                ->update(['status' => 'enrolled']);
        } else {
            // Drop the (unbilled) next-year enrollment and restore the grade and
            // current-standing school year to the ending year they revert to.
            $decision->toEnrollment?->delete();
            $restore = ['school_year' => $year->school_year];
            if ($decision->from_year_level !== null) {
                $restore['year_level'] = $decision->from_year_level;
            }
            $student->update($restore);
        }

        $decision->delete();
        $student->syncStatusFromLatestEnrollment();
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
