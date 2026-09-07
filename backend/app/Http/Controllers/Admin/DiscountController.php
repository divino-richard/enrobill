<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\DiscountResource;
use App\Models\BillAdjustment;
use App\Models\Discount;
use App\Models\IncentiveAward;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class DiscountController extends Controller
{
    private const CATEGORIES = ['voucher'];

    private const SORTABLE = [
        'name' => 'name',
        'category' => 'category',
        'value' => 'value',
        'createdAt' => 'created_at',
    ];

    /**
     * The reusable discount catalog — paginated, searchable, sortable, and
     * filterable by category. Restricted to admins by route middleware.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $sort = self::SORTABLE[$request->string('sort')->value()] ?? 'name';
        $direction = $request->string('dir')->lower()->value() === 'desc' ? 'desc' : 'asc';
        $perPage = min(max($request->integer('per_page', 15), 1), 100);

        $discounts = Discount::query()
            ->when(
                in_array($request->string('category')->value(), self::CATEGORIES, true),
                fn ($query) => $query->where('category', $request->string('category')->value()),
            )
            ->when(
                $request->filled('search'),
                fn ($query) => $query->where('name', 'like', '%'.$request->string('search')->value().'%'),
            )
            ->orderBy($sort, $direction)
            ->orderBy('id', $direction)
            ->paginate($perPage)
            ->withQueryString();

        return DiscountResource::collection($discounts);
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
        $attributes = $this->validateDiscount($request, $discount);

        if (! $attributes['is_active'] && $this->isLockedByAppliedIncentive($discount)) {
            throw ValidationException::withMessages([
                'isActive' => 'This voucher unlocked a permanent tuition incentive and cannot be retired.',
            ]);
        }

        $discount->update($attributes);

        return new DiscountResource($discount->fresh());
    }

    /**
     * Remove a discount from the catalog. Bills that already used it keep their
     * adjustment (the foreign key is nulled, not cascaded).
     */
    public function destroy(Discount $discount): Response
    {
        if ($this->isLockedByAppliedIncentive($discount)) {
            throw ValidationException::withMessages([
                'discount' => 'This voucher unlocked a permanent tuition incentive and cannot be deleted.',
            ]);
        }

        $discount->delete();

        return response()->noContent();
    }

    /**
     * @return array<string, mixed>
     */
    private function validateDiscount(Request $request, ?Discount $discount = null): array
    {
        // The catalog holds vouchers — a fixed peso amount. (Freebies are
        // eligibility-driven promos managed per school year, not catalog rows.)
        $validated = $request->validate([
            'name' => [
                'required', 'string', 'max:100',
                Rule::unique('discounts', 'name')->ignore($discount?->id),
            ],
            'category' => ['required', Rule::in(self::CATEGORIES)],
            'value' => ['required', 'numeric', 'min:0', 'max:99999999.99'],
            'isActive' => ['sometimes', 'boolean'],
        ]);

        return [
            'name' => $validated['name'],
            'category' => $validated['category'],
            'type' => 'fixed',
            'value' => $validated['value'],
            'is_active' => $validated['isActive'] ?? true,
        ];
    }

    /** Preserve the voucher evidence behind an irrevocable incentive award. */
    private function isLockedByAppliedIncentive(Discount $discount): bool
    {
        return BillAdjustment::query()
            ->where('discount_id', $discount->id)
            ->where(function ($query) {
                $query->whereHas('bill.adjustments', fn ($adjustments) => $adjustments
                    ->whereNotNull('incentive_key'))
                    ->orWhereHas('bill.enrollment.incentiveAwards', fn ($awards) => $awards
                        ->whereIn('status', [
                            IncentiveAward::STATUS_APPLIED,
                            IncentiveAward::STATUS_APPLIED_NO_BALANCE,
                        ]));
            })
            ->exists();
    }
}
