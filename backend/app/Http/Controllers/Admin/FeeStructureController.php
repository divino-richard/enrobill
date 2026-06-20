<?php

namespace App\Http\Controllers\Admin;

use App\Actions\GenerateTermFeeStructures;
use App\Http\Controllers\Controller;
use App\Http\Resources\FeeStructureResource;
use App\Models\FeeStructure;
use App\Models\Program;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class FeeStructureController extends Controller
{
    private const SORTABLE = [
        'program' => 'track',
        'yearLevel' => 'year_level',
        'createdAt' => 'created_at',
    ];

    /**
     * Fee structures — paginated, searchable by program, filterable by term, and
     * sortable. Restricted to admins by route middleware.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $direction = $request->string('dir')->lower()->value() === 'desc' ? 'desc' : 'asc';
        $perPage = min(max($request->integer('per_page', 15), 1), 100);
        $sortKey = $request->string('sort')->value();

        $query = FeeStructure::query()
            ->with(['term', 'items'])
            ->when(
                $request->filled('term_id'),
                fn ($query) => $query->where('term_id', $request->integer('term_id')),
            )
            ->when($request->filled('search'), function ($query) use ($request) {
                $term = '%'.$request->string('search')->value().'%';
                $codes = Program::where('name', 'like', $term)
                    ->orWhere('code', 'like', $term)
                    ->pluck('code');
                $query->whereIn('track', $codes);
            });

        if (isset(self::SORTABLE[$sortKey])) {
            $query->orderBy(self::SORTABLE[$sortKey], $direction)->orderBy('id', $direction);
        } else {
            $query->latest();
        }

        return FeeStructureResource::collection($query->paginate($perPage)->withQueryString());
    }

    /**
     * Bulk-create fee structures for every program missing one in the open term,
     * each seeded with the program's default fee items.
     */
    public function generate(GenerateTermFeeStructures $generate): JsonResponse
    {
        $created = $generate();

        return response()->json(['created' => $created]);
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
    public function destroy(FeeStructure $feeStructure): Response
    {
        $feeStructure->delete();

        return response()->noContent();
    }
}
