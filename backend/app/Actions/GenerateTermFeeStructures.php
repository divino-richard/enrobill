<?php

namespace App\Actions;

use App\Models\FeeStructure;
use App\Models\StandardFeeItem;
use App\Models\Term;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class GenerateTermFeeStructures
{
    /**
     * Create a fee structure for every program (track + year level) that doesn't
     * already have one in the open term, each seeded with the standard fee items.
     * Returns the number created. Idempotent — re-running only fills the gaps.
     */
    public function __invoke(): int
    {
        $term = Term::open();

        if ($term === null) {
            throw ValidationException::withMessages([
                'feeStructures' => 'No term is currently open for enrollment.',
            ]);
        }

        $standard = StandardFeeItem::query()->orderBy('id')->get();

        if ($standard->isEmpty()) {
            throw ValidationException::withMessages([
                'feeStructures' => 'Define your standard fee items before generating fee structures.',
            ]);
        }

        // Programs that already have a structure in this term.
        $existing = FeeStructure::query()
            ->where('term_id', $term->id)
            ->get()
            ->map(fn (FeeStructure $structure) => $structure->track.'|'.$structure->year_level)
            ->all();

        $existing = array_flip($existing);

        $items = $standard
            ->map(fn (StandardFeeItem $item) => ['name' => $item->name, 'amount' => $item->amount])
            ->all();

        $created = 0;

        DB::transaction(function () use ($term, $existing, $items, &$created) {
            foreach (FeeStructure::TRACKS as $track) {
                foreach (FeeStructure::YEAR_LEVELS as $yearLevel) {
                    if (isset($existing[$track.'|'.$yearLevel])) {
                        continue; // Already has a structure — leave it untouched.
                    }

                    $structure = FeeStructure::create([
                        'term_id' => $term->id,
                        'track' => $track,
                        'year_level' => $yearLevel,
                    ]);

                    $structure->items()->createMany($items);
                    $created++;
                }
            }
        });

        return $created;
    }
}
