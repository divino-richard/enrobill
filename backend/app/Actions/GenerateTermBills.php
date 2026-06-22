<?php

namespace App\Actions;

use App\Models\Bill;
use App\Models\FeeStructure;
use App\Models\Student;
use App\Models\Term;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class GenerateTermBills
{
    /**
     * Students eligible to be billed for a term: newly admitted students and
     * continuing (already enrolled) ones. Excludes dropped, graduated and
     * inactive students.
     */
    private const BILLABLE_STATUSES = ['admitted', 'enrolled'];

    public function __construct(private EnsureEnrollment $ensureEnrollment) {}

    /**
     * Generate bills for every active student in the open term (newly admitted
     * or continuing) whose program has a matching fee structure and who isn't
     * billed for this term yet. Returns the number of bills created. Idempotent
     * — re-running only bills students still missing one for the open term.
     */
    public function __invoke(): int
    {
        $term = Term::active();

        if ($term === null) {
            throw ValidationException::withMessages([
                'billing' => 'No term is currently open for enrollment.',
            ]);
        }

        $structures = FeeStructure::query()
            ->where('term_id', $term->id)
            ->with('items')
            ->get();

        if ($structures->isEmpty()) {
            throw ValidationException::withMessages([
                'billing' => 'No fee structures are defined for the open term yet.',
            ]);
        }

        // Index fee structures by "track|year_level" for quick matching.
        $byProgram = $structures->keyBy(
            fn (FeeStructure $structure) => $structure->track.'|'.$structure->year_level,
        );

        $alreadyBilled = Bill::query()
            ->where('term_id', $term->id)
            ->pluck('student_id')
            ->all();

        $students = Student::query()
            ->whereIn('status', self::BILLABLE_STATUSES)
            ->whereNotIn('id', $alreadyBilled)
            ->get();

        $created = 0;

        DB::transaction(function () use ($students, $byProgram, $term, &$created) {
            foreach ($students as $student) {
                $structure = $byProgram->get(
                    $student->track_or_strand.'|'.$student->year_level,
                );

                if ($structure === null) {
                    continue; // No fee structure for this student's program.
                }

                // The academic record for this term; the bill bills against it.
                $enrollment = ($this->ensureEnrollment)($student, $term);

                $bill = $student->bills()->create([
                    'term_id' => $term->id,
                    'enrollment_id' => $enrollment->id,
                    'fee_structure_id' => $structure->id,
                    'total' => $structure->items->sum('amount'),
                    'amount_paid' => 0,
                    'status' => 'unpaid',
                ]);

                $bill->items()->createMany(
                    $structure->items
                        ->map(fn ($item) => ['name' => $item->name, 'amount' => $item->amount])
                        ->all(),
                );

                $created++;
            }
        });

        return $created;
    }
}
