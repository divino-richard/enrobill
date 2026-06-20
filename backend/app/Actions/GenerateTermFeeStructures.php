<?php

namespace App\Actions;

use App\Models\FeeStructure;
use App\Models\Program;
use App\Models\Term;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class GenerateTermFeeStructures
{
    /**
     * Create a fee structure for every active program × SHS year level that
     * doesn't already have one in the open term, each seeded with that program's
     * default fee items. Returns the number created. Idempotent — re-running only
     * fills the gaps.
     */
    public function __invoke(): int
    {
        $term = Term::open();

        if ($term === null) {
            throw ValidationException::withMessages([
                'feeStructures' => 'No term is currently open for enrollment.',
            ]);
        }

        $programs = Program::query()
            ->where('is_active', true)
            ->with('feeItems')
            ->ordered()
            ->get();

        if ($programs->isEmpty()) {
            throw ValidationException::withMessages([
                'feeStructures' => 'Define at least one active program before generating fee structures.',
            ]);
        }

        // Programs (by code|year) that already have a structure in this term.
        $existing = FeeStructure::query()
            ->where('term_id', $term->id)
            ->get()
            ->map(fn (FeeStructure $structure) => $structure->track.'|'.$structure->year_level)
            ->flip();

        $created = 0;

        DB::transaction(function () use ($term, $programs, $existing, &$created) {
            foreach ($programs as $program) {
                foreach (FeeStructure::YEAR_LEVELS as $yearLevel) {
                    if ($existing->has($program->code.'|'.$yearLevel)) {
                        continue; // Already has a structure — leave it untouched.
                    }

                    $structure = FeeStructure::create([
                        'term_id' => $term->id,
                        'track' => $program->code,
                        'year_level' => $yearLevel,
                    ]);

                    // Seed the items priced for this level (one flat row each).
                    $items = $program->feeItems
                        ->where('year_level', $yearLevel)
                        ->map(fn ($item) => ['name' => $item->name, 'amount' => $item->amount])
                        ->values()
                        ->all();

                    if ($items !== []) {
                        $structure->items()->createMany($items);
                    }

                    $created++;
                }
            }
        });

        return $created;
    }
}
