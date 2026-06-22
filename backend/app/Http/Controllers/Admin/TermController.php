<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\TermResource;
use App\Models\Term;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class TermController extends Controller
{
    private const SEMESTERS = ['first', 'second'];

    /**
     * All academic terms, newest first. Restricted to admins by route middleware.
     */
    public function index(): AnonymousResourceCollection
    {
        return TermResource::collection(Term::query()->newestFirst()->get());
    }

    /**
     * Create a new academic term.
     */
    public function store(Request $request): TermResource
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
                Rule::unique('terms', 'school_year')->where(
                    'semester',
                    $request->input('semester'),
                ),
            ],
            'semester' => ['required', Rule::in(self::SEMESTERS)],
            'startDate' => ['required', 'date'],
            'endDate' => ['required', 'date', 'after_or_equal:startDate'],
            ...$this->policyRules($request),
        ], [
            'schoolYear.regex' => 'The school year must look like 2026-2027.',
            'schoolYear.unique' => 'That school year and semester already exists.',
            'endDate.after_or_equal' => 'The end date must be on or after the start date.',
        ]);

        $term = Term::create([
            'school_year' => $validated['schoolYear'],
            'semester' => $validated['semester'],
            'start_date' => $validated['startDate'],
            'end_date' => $validated['endDate'],
            'is_active' => false,
            'admission_open' => false,
            ...$this->policyAttributes($validated),
        ]);

        return new TermResource($term);
    }

    /**
     * Update a term's installment policy (downpayment + number of monthly
     * installments).
     */
    public function updatePolicy(Request $request, Term $term): TermResource
    {
        $validated = $request->validate($this->policyRules($request));

        $term->update($this->policyAttributes($validated));

        return new TermResource($term->fresh());
    }

    /**
     * Validation rules for the installment policy. Downpayment + count are
     * required only when installments are enabled.
     *
     * @return array<string, mixed>
     */
    private function policyRules(Request $request): array
    {
        $percentage = $request->input('downpaymentType') === 'percentage';

        return [
            'installmentsEnabled' => ['required', 'boolean'],
            'downpaymentType' => ['nullable', 'required_if:installmentsEnabled,true', Rule::in(['percentage', 'fixed'])],
            'downpaymentValue' => ['nullable', 'required_if:installmentsEnabled,true', 'numeric', 'min:0', 'max:'.($percentage ? '100' : '99999999.99')],
            'installmentCount' => ['nullable', 'required_if:installmentsEnabled,true', 'integer', 'min:1', 'max:24'],
        ];
    }

    /**
     * Map validated policy input to the term columns.
     *
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     */
    private function policyAttributes(array $validated): array
    {
        $enabled = (bool) ($validated['installmentsEnabled'] ?? false);

        return [
            'installments_enabled' => $enabled,
            'downpayment_type' => $enabled ? ($validated['downpaymentType'] ?? null) : null,
            'downpayment_value' => $enabled ? ($validated['downpaymentValue'] ?? null) : null,
            'installment_count' => $enabled ? ($validated['installmentCount'] ?? null) : null,
        ];
    }

    /**
     * Toggle a term's active state and/or its admission window. Activating one
     * deactivates any other (at most one active at a time). Deactivating a term
     * also closes its admissions, and admissions can only be open on the active
     * term.
     */
    public function update(Request $request, Term $term): TermResource
    {
        $validated = $request->validate([
            'isActive' => ['sometimes', 'boolean'],
            'admissionOpen' => ['sometimes', 'boolean'],
        ]);

        DB::transaction(function () use ($term, $validated) {
            if (array_key_exists('isActive', $validated)) {
                if ($validated['isActive']) {
                    Term::query()
                        ->whereKeyNot($term->id)
                        ->where('is_active', true)
                        ->update(['is_active' => false, 'admission_open' => false]);
                    $term->is_active = true;
                } else {
                    // An inactive term can't keep admissions open.
                    $term->is_active = false;
                    $term->admission_open = false;
                }
            }

            if (array_key_exists('admissionOpen', $validated)) {
                if ($validated['admissionOpen'] && ! $term->is_active) {
                    throw ValidationException::withMessages([
                        'admissionOpen' => 'Activate the term before opening admissions.',
                    ]);
                }
                $term->admission_open = $validated['admissionOpen'];
            }

            $term->save();
        });

        return new TermResource($term->fresh());
    }

    /**
     * Delete a term.
     */
    public function destroy(Term $term): Response
    {
        $term->delete();

        return response()->noContent();
    }
}
