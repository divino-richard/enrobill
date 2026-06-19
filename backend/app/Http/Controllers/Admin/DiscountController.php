<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\DiscountResource;
use App\Models\Discount;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

class DiscountController extends Controller
{
    private const CATEGORIES = ['discount', 'scholarship', 'voucher'];

    private const TYPES = ['fixed', 'percentage'];

    /**
     * The reusable discount catalog. Restricted to admins by route middleware.
     */
    public function index(): AnonymousResourceCollection
    {
        return DiscountResource::collection(Discount::query()->latest()->get());
    }

    /**
     * Add a named discount/scholarship/voucher to the catalog.
     */
    public function store(Request $request): DiscountResource
    {
        $discount = Discount::create($this->validateDiscount($request));

        return new DiscountResource($discount);
    }

    /**
     * Update a catalog discount. Existing bill adjustments keep their snapshot.
     */
    public function update(Request $request, Discount $discount): DiscountResource
    {
        $discount->update($this->validateDiscount($request, $discount));

        return new DiscountResource($discount->fresh());
    }

    /**
     * Remove a discount from the catalog. Bills that already used it keep their
     * adjustment (the foreign key is nulled, not cascaded).
     */
    public function destroy(Discount $discount): Response
    {
        $discount->delete();

        return response()->noContent();
    }

    /**
     * @return array<string, mixed>
     */
    private function validateDiscount(Request $request, ?Discount $discount = null): array
    {
        $validated = $request->validate([
            'name' => [
                'required', 'string', 'max:100',
                Rule::unique('discounts', 'name')->ignore($discount?->id),
            ],
            'category' => ['required', Rule::in(self::CATEGORIES)],
            'type' => ['required', Rule::in(self::TYPES)],
            'value' => [
                'required', 'numeric', 'min:0',
                // A percentage can't exceed 100; a fixed amount is capped by column size.
                $request->input('type') === 'percentage' ? 'max:100' : 'max:99999999.99',
            ],
            'isActive' => ['sometimes', 'boolean'],
        ]);

        return [
            'name' => $validated['name'],
            'category' => $validated['category'],
            'type' => $validated['type'],
            'value' => $validated['value'],
            'is_active' => $validated['isActive'] ?? true,
        ];
    }
}
