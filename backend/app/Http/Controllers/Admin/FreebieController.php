<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\FreebieResource;
use App\Models\Freebie;
use App\Models\SchoolYear;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class FreebieController extends Controller
{
    /**
     * The freebies (promos) configured for a school year. Restricted to admins by
     * route middleware.
     */
    public function index(SchoolYear $schoolYear): AnonymousResourceCollection
    {
        return FreebieResource::collection($schoolYear->freebies()->orderBy('type')->get());
    }

    /**
     * Create or update a school year's freebie of a given type (one per type).
     */
    public function upsert(Request $request, SchoolYear $schoolYear): FreebieResource
    {
        $validated = $request->validate([
            'type' => ['required', Rule::in(Freebie::TYPES)],
            'name' => ['required', 'string', 'max:100'],
            'isActive' => ['sometimes', 'boolean'],
            'startsOn' => ['nullable', 'date'],
            'endsOn' => ['nullable', 'date', 'after_or_equal:startsOn'],
            'minReferrals' => ['nullable', 'integer', 'min:0'],
        ]);

        $freebie = Freebie::updateOrCreate(
            ['school_year_id' => $schoolYear->id, 'type' => $validated['type']],
            [
                'name' => $validated['name'],
                'is_active' => $validated['isActive'] ?? true,
                'starts_on' => $validated['startsOn'] ?? null,
                'ends_on' => $validated['endsOn'] ?? null,
                'min_referrals' => $validated['minReferrals'] ?? null,
            ],
        );

        return new FreebieResource($freebie);
    }
}
