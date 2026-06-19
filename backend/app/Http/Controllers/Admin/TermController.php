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
                'max:20',
                Rule::unique('terms', 'school_year')->where(
                    'semester',
                    $request->input('semester'),
                ),
            ],
            'semester' => ['required', Rule::in(self::SEMESTERS)],
        ], [
            'schoolYear.unique' => 'That school year and semester already exists.',
        ]);

        $term = Term::create([
            'school_year' => $validated['schoolYear'],
            'semester' => $validated['semester'],
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
