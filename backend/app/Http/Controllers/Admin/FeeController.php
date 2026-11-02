<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\SchoolYearFeeResource;
use App\Models\SchoolYear;
use App\Models\SchoolYearFee;
use App\Support\InstallmentAmounts;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class FeeController extends Controller
{
    /**
     * The global fee schedule for a school year (defaults to the active one).
     * Restricted to admins/cashiers by route middleware.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $schoolYear = $this->resolveSchoolYear($request);

        $fees = $schoolYear === null
            ? SchoolYearFee::query()->whereRaw('1 = 0')->get()
            : $schoolYear->fees()->orderBy('year_level')->orderBy('sequence')->orderBy('id')->get();

        return SchoolYearFeeResource::collection($fees);
    }

    public function preview(Request $request): JsonResponse
    {
        $input = $request->validate(['school_year_id' => ['required', 'integer', Rule::exists('school_years', 'id')]]);

        return DB::transaction(function () use ($input) {
            $year = SchoolYear::whereKey($input['school_year_id'])->sharedLock()->firstOrFail();
            $fees = $year->fees()->get();

            return response()->json(['data' => collect(SchoolYear::YEAR_LEVELS)->map(function ($level) use ($year, $fees) {
                $total = round((float) $fees->whereIn('year_level', ['all', $level])->sum('amount'), 2);

                return [
                    'yearLevel' => $level,
                    'total' => $total,
                    ...InstallmentAmounts::calculate($total, (float) $year->downpayment_value, (int) $year->installment_count),
                ];
            })]);
        });
    }

    /**
     * Add a fee item to a school year's schedule.
     */
    public function store(Request $request): SchoolYearFeeResource
    {
        $validated = $this->validateFee($request, withSchoolYear: true);

        $fee = DB::transaction(function () use ($validated) {
            $year = SchoolYear::whereKey($validated['schoolYearId'])->lockForUpdate()->firstOrFail();
            $year->assertFeesDraft();

            return SchoolYearFee::create([
                'school_year_id' => $validated['schoolYearId'],
                'year_level' => $validated['yearLevel'],
                'category' => $validated['category'],
                'dropping_component' => $validated['droppingComponent'] ?? null,
                'name' => $validated['name'],
                'type' => $validated['type'],
                'amount' => $validated['amount'],
                'sequence' => $validated['sequence'] ?? 0,
            ]);

        });

        return new SchoolYearFeeResource($fee);
    }

    /**
     * Update a fee item.
     */
    public function update(Request $request, SchoolYearFee $fee): SchoolYearFeeResource
    {
        $validated = $this->validateFee($request, withSchoolYear: false);

        DB::transaction(function () use ($fee, $validated) {
            $year = SchoolYear::whereKey($fee->school_year_id)->lockForUpdate()->firstOrFail();
            $year->assertFeesDraft();
            $fee->refresh();
            $fee->update([
                'year_level' => $validated['yearLevel'],
                'category' => $validated['category'],
                'dropping_component' => array_key_exists('droppingComponent', $validated) ? $validated['droppingComponent'] : $fee->dropping_component,
                'name' => $validated['name'],
                'type' => $validated['type'],
                'amount' => $validated['amount'],
                'sequence' => $validated['sequence'] ?? $fee->sequence,
            ]);

        });

        return new SchoolYearFeeResource($fee->fresh());
    }

    /**
     * Delete a fee item.
     */
    public function destroy(SchoolYearFee $fee): Response
    {
        DB::transaction(function () use ($fee) {
            $year = SchoolYear::whereKey($fee->school_year_id)->lockForUpdate()->firstOrFail();
            $year->assertFeesDraft();
            $fee->delete();
        });

        return response()->noContent();
    }

    /**
     * Copy the entire fee schedule from one school year into another (the target
     * must have no fees yet) — a convenience when rolling a new year.
     */
    public function copy(Request $request): AnonymousResourceCollection
    {
        $validated = $request->validate([
            'fromSchoolYearId' => ['required', 'integer', 'different:toSchoolYearId', Rule::exists('school_years', 'id')],
            'toSchoolYearId' => ['required', 'integer', Rule::exists('school_years', 'id')],
        ]);

        $target = DB::transaction(function () use ($validated) {
            $target = SchoolYear::whereKey($validated['toSchoolYearId'])->lockForUpdate()->firstOrFail();
            $target->assertFeesDraft();
            if ($target->fees()->exists()) {
                throw ValidationException::withMessages(['toSchoolYearId' => 'That school year already has fees. Clear them first.']);
            }
            $source = SchoolYear::whereKey($validated['fromSchoolYearId'])->sharedLock()->firstOrFail();
            if ($source->fees_published_at === null) {
                throw ValidationException::withMessages(['fromSchoolYearId' => 'Only published fee schedules can be copied.']);
            }
            $target->fees()->createMany($source->fees()->get()->map(fn (SchoolYearFee $fee) => $fee->only([
                'year_level', 'category', 'dropping_component', 'name', 'type', 'amount', 'sequence',
            ]))->all());

            return $target;
        });

        return SchoolYearFeeResource::collection(
            $target->fees()->orderBy('year_level')->orderBy('sequence')->orderBy('id')->get(),
        );
    }

    /**
     * The school year being managed: the `school_year_id` query/body value, else
     * the active one.
     */
    private function resolveSchoolYear(Request $request): ?SchoolYear
    {
        if ($request->filled('school_year_id')) {
            return SchoolYear::find($request->integer('school_year_id'));
        }

        return SchoolYear::active();
    }

    /**
     * @return array<string, mixed>
     */
    private function validateFee(Request $request, bool $withSchoolYear): array
    {
        return $request->validate([
            ...($withSchoolYear
                ? ['schoolYearId' => ['required', 'integer', Rule::exists('school_years', 'id')]]
                : []),
            'yearLevel' => ['required', Rule::in(SchoolYearFee::YEAR_LEVELS)],
            'category' => ['required', Rule::in(SchoolYearFee::CATEGORIES)],
            'droppingComponent' => ['nullable', Rule::in(['registration', 'miscellaneous', 'laboratory', 'tuition', 'other'])],
            'name' => ['required', 'string', 'max:100'],
            'type' => ['required', Rule::in(SchoolYearFee::TYPES)],
            'amount' => ['required', 'numeric', 'min:0', 'max:99999999.99'],
            'sequence' => ['nullable', 'integer', 'min:0', 'max:1000'],
        ]);
    }
}
