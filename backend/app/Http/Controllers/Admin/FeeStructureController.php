<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\FeeStructureResource;
use App\Models\FeeStructure;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class FeeStructureController extends Controller
{
    private const TRACKS = ['stem', 'assh', 'abm', 'gas', 'creative_arts', 'hospitality', 'ict'];

    private const YEAR_LEVELS = ['grade_11', 'grade_12'];

    /**
     * All fee structures, optionally filtered by term. Restricted to admins by
     * route middleware.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $structures = FeeStructure::query()
            ->with(['term', 'items'])
            ->when(
                $request->filled('term_id'),
                fn ($query) => $query->where('term_id', $request->integer('term_id')),
            )
            ->latest()
            ->get();

        return FeeStructureResource::collection($structures);
    }

    /**
     * Create a fee structure for a program (track + year level) in a term.
     */
    public function store(Request $request): FeeStructureResource
    {
        $validated = $request->validate([
            'termId' => ['required', 'integer', 'exists:terms,id'],
            'track' => ['required', Rule::in(self::TRACKS)],
            'yearLevel' => [
                'required',
                Rule::in(self::YEAR_LEVELS),
                Rule::unique('fee_structures', 'year_level')
                    ->where('term_id', $request->integer('termId'))
                    ->where('track', $request->input('track')),
            ],
        ], [
            'yearLevel.unique' => 'A fee structure for this program already exists in this term.',
        ]);

        $structure = FeeStructure::create([
            'term_id' => $validated['termId'],
            'track' => $validated['track'],
            'year_level' => $validated['yearLevel'],
        ]);

        return new FeeStructureResource($structure->load(['term', 'items']));
    }

    /**
     * A single fee structure with its line items.
     */
    public function show(FeeStructure $feeStructure): FeeStructureResource
    {
        return new FeeStructureResource($feeStructure->load(['term', 'items']));
    }

    /**
     * Replace a fee structure's line items.
     */
    public function update(Request $request, FeeStructure $feeStructure): FeeStructureResource
    {
        $validated = $request->validate([
            'items' => ['present', 'array'],
            'items.*.name' => ['required', 'string', 'max:100'],
            'items.*.amount' => ['required', 'numeric', 'min:0', 'max:99999999.99'],
        ]);

        DB::transaction(function () use ($feeStructure, $validated) {
            $feeStructure->items()->delete();
            $feeStructure->items()->createMany(
                collect($validated['items'])
                    ->map(fn (array $item) => [
                        'name' => $item['name'],
                        'amount' => $item['amount'],
                    ])
                    ->all(),
            );
        });

        return new FeeStructureResource($feeStructure->fresh()->load(['term', 'items']));
    }

    /**
     * Delete a fee structure (and its items).
     */
    public function destroy(FeeStructure $feeStructure): \Illuminate\Http\Response
    {
        $feeStructure->delete();

        return response()->noContent();
    }
}
