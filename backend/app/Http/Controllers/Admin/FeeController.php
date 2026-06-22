<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\SchoolYearFeeResource;
use App\Models\SchoolYear;
use App\Models\SchoolYearFee;
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

    /**
     * Add a fee item to a school year's schedule.
     */
    public function store(Request $request): SchoolYearFeeResource
    {
        $validated = $this->validateFee($request, withSchoolYear: true);

        $fee = SchoolYearFee::create([
            'school_year_id' => $validated['schoolYearId'],
            'year_level' => $validated['yearLevel'],
            'name' => $validated['name'],
            'type' => $validated['type'],
            'amount' => $validated['amount'],
            'sequence' => $validated['sequence'] ?? 0,
        ]);

        return new SchoolYearFeeResource($fee);
    }

    /**
     * Update a fee item.
     */
    public function update(Request $request, SchoolYearFee $fee): SchoolYearFeeResource
    {
        $validated = $this->validateFee($request, withSchoolYear: false);

        $fee->update([
            'year_level' => $validated['yearLevel'],
            'name' => $validated['name'],
            'type' => $validated['type'],
            'amount' => $validated['amount'],
            'sequence' => $validated['sequence'] ?? $fee->sequence,
        ]);

        return new SchoolYearFeeResource($fee->fresh());
    }

    /**
     * Delete a fee item.
     */
    public function destroy(SchoolYearFee $fee): Response
    {
        $fee->delete();

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

        $target = SchoolYear::findOrFail($validated['toSchoolYearId']);

        if ($target->fees()->exists()) {
            throw ValidationException::withMessages([
                'toSchoolYearId' => 'That school year already has fees. Clear them first.',
            ]);
        }

        $source = SchoolYear::with('fees')->findOrFail($validated['fromSchoolYearId']);

        DB::transaction(function () use ($source, $target) {
            $target->fees()->createMany(
                $source->fees->map(fn (SchoolYearFee $fee) => [
                    'year_level' => $fee->year_level,
                    'name' => $fee->name,
                    'type' => $fee->type,
                    'amount' => $fee->amount,
                    'sequence' => $fee->sequence,
                ])->all(),
            );
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
            'name' => ['required', 'string', 'max:100'],
            'type' => ['required', Rule::in(SchoolYearFee::TYPES)],
            'amount' => ['required', 'numeric', 'min:0', 'max:99999999.99'],
            'sequence' => ['nullable', 'integer', 'min:0', 'max:1000'],
        ]);
    }
}
