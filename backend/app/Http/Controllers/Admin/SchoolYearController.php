<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\SchoolYearResource;
use App\Models\SchoolYear;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class SchoolYearController extends Controller
{
    private const SEMESTERS = ['first', 'second'];

    /**
     * All school years, newest first. Restricted to admins by route middleware.
     */
    public function index(): AnonymousResourceCollection
    {
        return SchoolYearResource::collection(SchoolYear::query()->newestFirst()->get());
    }

    /**
     * Create a new school year (one row per year).
     */
    public function store(Request $request): SchoolYearResource
    {
        $validated = $request->validate([
            'schoolYear' => [
                'required',
                'string',
                'regex:/^\d{4}-\d{4}$/',
                // Second year must be the first year + 1 (e.g. 2026-2027).
                function (string $attribute, mixed $value, \Closure $fail) {
                    if (preg_match('/^(\d{4})-(\d{4})$/', (string) $value, $m)
                        && (int) $m[2] !== (int) $m[1] + 1) {
                        $fail('The school year must be two consecutive years, e.g. 2026-2027.');
                    }
                },
                Rule::unique('school_years', 'school_year'),
            ],
            'startDate' => ['required', 'date'],
            'endDate' => ['required', 'date', 'after_or_equal:startDate'],
            ...$this->policyRules($request),
        ], [
            'schoolYear.regex' => 'The school year must look like 2026-2027.',
            'schoolYear.unique' => 'That school year already exists.',
            'endDate.after_or_equal' => 'The end date must be on or after the start date.',
        ]);

        $schoolYear = SchoolYear::create([
            'school_year' => $validated['schoolYear'],
            'current_semester' => 'first',
            'start_date' => $validated['startDate'],
            'end_date' => $validated['endDate'],
            'is_active' => false,
            'admission_open' => false,
            ...$this->policyAttributes($validated),
        ]);

        return new SchoolYearResource($schoolYear);
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
     * Toggle a school year's active state and/or its admission window, and advance
     * its current-semester pointer. Activating one deactivates any other (at most
     * one active at a time). Deactivating also closes admissions; admissions can
     * only be open on the active year.
     */
    public function update(Request $request, SchoolYear $schoolYear): SchoolYearResource
    {
        $validated = $request->validate([
            'isActive' => ['sometimes', 'boolean'],
            'admissionOpen' => ['sometimes', 'boolean'],
            'currentSemester' => ['sometimes', Rule::in(self::SEMESTERS)],
        ]);

        DB::transaction(function () use ($schoolYear, $validated) {
            if (array_key_exists('isActive', $validated)) {
                if ($validated['isActive']) {
                    SchoolYear::query()
                        ->whereKeyNot($schoolYear->id)
                        ->where('is_active', true)
                        ->update(['is_active' => false, 'admission_open' => false]);
                    $schoolYear->is_active = true;
                } else {
                    // An inactive year can't keep admissions open.
                    $schoolYear->is_active = false;
                    $schoolYear->admission_open = false;
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

            if (array_key_exists('currentSemester', $validated)) {
                $schoolYear->current_semester = $validated['currentSemester'];
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
        $schoolYear->delete();

        return response()->noContent();
    }
}
