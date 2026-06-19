<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\TermResource;
use App\Models\Term;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

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
            'is_open' => false,
        ]);

        return new TermResource($term);
    }

    /**
     * Open or close a term for enrollment. Opening one closes any other, so at
     * most one term is open at a time.
     */
    public function update(Request $request, Term $term): TermResource
    {
        $validated = $request->validate([
            'isOpen' => ['required', 'boolean'],
        ]);

        DB::transaction(function () use ($term, $validated) {
            if ($validated['isOpen']) {
                Term::query()
                    ->whereKeyNot($term->id)
                    ->where('is_open', true)
                    ->update(['is_open' => false]);
            }

            $term->update(['is_open' => $validated['isOpen']]);
        });

        return new TermResource($term->fresh());
    }

    /**
     * Delete a term.
     */
    public function destroy(Term $term): \Illuminate\Http\Response
    {
        $term->delete();

        return response()->noContent();
    }
}
