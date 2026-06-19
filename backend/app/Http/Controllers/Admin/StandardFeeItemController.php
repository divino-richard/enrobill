<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\StandardFeeItemResource;
use App\Models\StandardFeeItem;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class StandardFeeItemController extends Controller
{
    /**
     * The default fee items new fee structures are seeded with. Restricted to
     * admins by route middleware.
     */
    public function index(): AnonymousResourceCollection
    {
        return StandardFeeItemResource::collection(
            StandardFeeItem::query()->orderBy('id')->get(),
        );
    }

    /**
     * Replace the standard fee item list.
     */
    public function update(Request $request): AnonymousResourceCollection
    {
        $validated = $request->validate([
            'items' => ['present', 'array'],
            'items.*.name' => ['required', 'string', 'max:100', 'distinct:ignore_case'],
            'items.*.amount' => ['required', 'numeric', 'min:0', 'max:99999999.99'],
        ], [
            'items.*.name.distinct' => 'Each standard fee item must have a unique name.',
        ]);

        DB::transaction(function () use ($validated) {
            StandardFeeItem::query()->delete();
            StandardFeeItem::query()->insert(
                collect($validated['items'])
                    ->map(fn (array $item) => [
                        'name' => $item['name'],
                        'amount' => $item['amount'],
                        'created_at' => now(),
                        'updated_at' => now(),
                    ])
                    ->all(),
            );
        });

        return StandardFeeItemResource::collection(
            StandardFeeItem::query()->orderBy('id')->get(),
        );
    }
}
