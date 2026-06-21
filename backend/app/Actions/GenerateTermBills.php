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
    public function __construct(private EnsureEnrollment $ensureEnrollment) {}

    /**
     * Generate bills for every admitted student in the open term whose program
     * has a matching fee structure and who isn't billed yet. Returns the number
     * of bills created. Idempotent — re-running only bills new students.
     */
    public function __invoke(): int
    {
        $term = Term::open();

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
            ->where('status', 'admitted')
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
