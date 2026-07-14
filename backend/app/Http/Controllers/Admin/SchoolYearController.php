<?php

namespace App\Http\Controllers\Admin;

use App\Actions\SeedFeeScheduleFromTemplate;
use App\Http\Controllers\Controller;
use App\Http\Resources\SchoolYearResource;
use App\Models\SchoolYear;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class SchoolYearController extends Controller
{
    /** How long a school year may run. The ceiling keeps it inside its own label. */
    private const MIN_MONTHS = 3;

    private const MAX_MONTHS = 12;

    /**
     * All school years, newest first. Restricted to admins by route middleware.
     */
    public function index(): AnonymousResourceCollection
    {
        return SchoolYearResource::collection(SchoolYear::query()->newestFirst()->get());
    }

    /**
     * Create a new school year (one row per year) and seed its fee schedule from
     * the default template so the admin can immediately review/adjust it.
     *
     * The `school_year` label is derived from the start date rather than accepted
     * from the client, so the label and the dates can never disagree.
     */
    public function store(Request $request, SeedFeeScheduleFromTemplate $seedFees): SchoolYearResource
    {
        $validated = $request->validate([
            'startDate' => ['required', 'date'],
            'endDate' => [
                'required',
                'date',
                'after:startDate',
                function (string $attribute, mixed $value, \Closure $fail) use ($request) {
                    $start = $this->tryParse($request->input('startDate'));
                    $end = $this->tryParse($value);

                    // Unparseable dates are already reported by their own rules.
                    if ($start === null || $end === null) {
                        return;
                    }

                    if ($end->lessThan($start->copy()->addMonths(self::MIN_MONTHS))) {
                        $fail('A school year must run for at least '.self::MIN_MONTHS.' months.');
                    }

                    if ($end->greaterThan($start->copy()->addMonths(self::MAX_MONTHS))) {
                        $fail('A school year cannot run longer than '.self::MAX_MONTHS.' months.');
                    }
                },
            ],
            ...$this->policyRules($request),
        ], [
            'endDate.after' => 'The end date must be after the start date.',
        ]);

        $startDate = Carbon::parse($validated['startDate']);
        $label = $this->labelFor($startDate, Carbon::parse($validated['endDate']));

        if (SchoolYear::query()->whereYear('start_date', $startDate->year)->exists()) {
            throw ValidationException::withMessages([
                'startDate' => "A school year starting in {$startDate->year} already exists.",
            ]);
        }

        $schoolYear = DB::transaction(function () use ($validated, $label, $seedFees) {
            $schoolYear = SchoolYear::create([
                'school_year' => $label,
                'start_date' => $validated['startDate'],
                'end_date' => $validated['endDate'],
                'is_active' => false,
                'admission_open' => false,
                ...$this->policyAttributes($validated),
            ]);

            $seedFees($schoolYear);

            return $schoolYear;
        });

        return new SchoolYearResource($schoolYear);
    }

    /**
     * The label for a school year running between two dates. It describes the span
     * the dates actually cover: a year confined to one calendar year is "2027", one
     * that crosses into the next is "2027-2028".
     */
    private function labelFor(Carbon $startDate, Carbon $endDate): string
    {
        return $startDate->year === $endDate->year
            ? (string) $startDate->year
            : sprintf('%d-%d', $startDate->year, $endDate->year);
    }

    /**
     * Parse a request date, or null when it is missing or unparseable — Carbon
     * throws on garbage, which would surface as a 500 rather than a 422.
     */
    private function tryParse(mixed $value): ?Carbon
    {
        if (! is_string($value) || $value === '') {
            return null;
        }

        try {
            return Carbon::parse($value);
        } catch (\Exception) {
            return null;
        }
    }

    /**
     * Update a school year's installment policy (downpayment + number of monthly
     * installments). Installments are always on.
     */
    public function updatePolicy(Request $request, SchoolYear $schoolYear): SchoolYearResource
    {
        $validated = $request->validate($this->policyRules($request));

        $schoolYear->update($this->policyAttributes($validated));

        return new SchoolYearResource($schoolYear->fresh());
    }

    /**
     * Validation rules for the installment policy. Every bill is installment, so a
     * downpayment policy and monthly count are always required.
     *
     * @return array<string, mixed>
     */
    private function policyRules(Request $request): array
    {
        $percentage = $request->input('downpaymentType') === 'percentage';

        return [
            'downpaymentType' => ['required', Rule::in(['percentage', 'fixed'])],
            'downpaymentValue' => ['required', 'numeric', 'min:0', 'max:'.($percentage ? '100' : '99999999.99')],
            'installmentCount' => ['required', 'integer', 'min:1', 'max:24'],
        ];
    }

    /**
     * Map validated policy input to the school year columns.
     *
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     */
    private function policyAttributes(array $validated): array
    {
        return [
            'downpayment_type' => $validated['downpaymentType'] ?? null,
            'downpayment_value' => $validated['downpaymentValue'] ?? null,
            'installment_count' => $validated['installmentCount'] ?? null,
        ];
    }

    /**
     * Toggle a school year's active state, its admission window and/or its
     * progression window. Activating one deactivates any other (at most one
     * active at a time). Deactivating also closes admissions and progression;
     * both can only be open on the active year.
     */
    public function update(Request $request, SchoolYear $schoolYear): SchoolYearResource
    {
        $validated = $request->validate([
            'isActive' => ['sometimes', 'boolean'],
            'admissionOpen' => ['sometimes', 'boolean'],
            // Nullable: null clears the override (follow the end-date schedule),
            // true/false force the window open/closed.
            'progressionOpen' => ['sometimes', 'nullable', 'boolean'],
        ]);

        DB::transaction(function () use ($schoolYear, $validated) {
            if (array_key_exists('isActive', $validated)) {
                if ($validated['isActive']) {
                    SchoolYear::query()
                        ->whereKeyNot($schoolYear->id)
                        ->where('is_active', true)
                        ->update(['is_active' => false, 'admission_open' => false, 'progression_open' => null]);
                    $schoolYear->is_active = true;
                } else {
                    // An inactive year can't admit, and its progression override is
                    // cleared so it returns to the schedule when reactivated.
                    $schoolYear->is_active = false;
                    $schoolYear->admission_open = false;
                    $schoolYear->progression_open = null;
                }
            }

            if (array_key_exists('admissionOpen', $validated)) {
                if ($validated['admissionOpen'] && ! $schoolYear->is_active) {
                    throw ValidationException::withMessages([
                        'admissionOpen' => 'Activate the school year before opening admissions.',
                    ]);
                }
                $schoolYear->admission_open = $validated['admissionOpen'];
            }

            if (array_key_exists('progressionOpen', $validated)) {
                // Forcing it open only makes sense on the active year; clearing the
                // override (null) or forcing it closed is always allowed.
                if ($validated['progressionOpen'] === true && ! $schoolYear->is_active) {
                    throw ValidationException::withMessages([
                        'progressionOpen' => 'Activate the school year before enabling progression.',
                    ]);
                }
                $schoolYear->progression_open = $validated['progressionOpen'];
            }

            $schoolYear->save();
        });

        return new SchoolYearResource($schoolYear->fresh());
    }

    /**
     * Delete a school year.
     */
    public function destroy(SchoolYear $schoolYear): Response
    {
        $hasEnrollments = $schoolYear->enrollments()->exists();
        $hasBills = $schoolYear->bills()->exists();

        if ($hasEnrollments || $hasBills) {
            $dependencies = collect([
                $hasEnrollments ? 'enrollments' : null,
                $hasBills ? 'bills' : null,
            ])->filter()->values();

            throw ValidationException::withMessages([
                'schoolYear' => sprintf(
                    'This school year already has %s and cannot be deleted.',
                    $dependencies->count() === 2
                        ? 'enrollments and bills'
                        : $dependencies->first(),
                ),
            ]);
        }

        $schoolYear->delete();

        return response()->noContent();
    }
}
