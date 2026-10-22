<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\FreebieResource;
use App\Models\Freebie;
use App\Models\SchoolYear;
use App\Services\ReferralPeriod;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

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
        $isReferral = $request->input('type') === 'referral';

        $validated = $request->validate([
            'type' => ['required', Rule::in(Freebie::TYPES)],
            'name' => ['required', 'string', 'max:100'],
            'isActive' => ['sometimes', 'boolean'],
            'startsOn' => [Rule::prohibitedIf($isReferral), 'nullable', 'date'],
            'endsOn' => [$isReferral && $request->boolean('isActive', true) ? 'required' : 'nullable', 'date_format:Y-m-d', ...($isReferral ? [] : ['after_or_equal:startsOn'])],
            'minReferrals' => [Rule::prohibitedIf($isReferral), 'nullable', 'integer', 'min:1'],
        ], [
            'startsOn.prohibited' => 'The referral incentive follows normal admissions and does not use a separate start date.',
            'endsOn.required' => 'Set a referral enrollment cutoff before enabling the incentive.',
            'minReferrals.prohibited' => 'The referral requirement is fixed at one successful referral.',
        ]);

        $freebie = DB::transaction(function () use ($schoolYear, $validated, $isReferral) {
            // Code issuance uses this same lock: published deadlines cannot race a change.
            $schoolYear = SchoolYear::whereKey($schoolYear->id)->lockForUpdate()->firstOrFail();
            $existing = $schoolYear->freebies()->where('type', $validated['type'])->first();
            $cutoff = $validated['endsOn'] ?? null;
            $hasCodes = $isReferral && $schoolYear->referralCodes()->exists();
            $validExistingCutoff = $existing?->hasValidReferralCutoff() ?? false;
            $legacyReservation = $hasCodes && ! $validExistingCutoff;
            if ($isReferral && $cutoff !== null
                && (($schoolYear->start_date !== null && $cutoff < $schoolYear->start_date->toDateString())
                    || ($schoolYear->end_date !== null && $cutoff > $schoolYear->end_date->toDateString()))) {
                throw ValidationException::withMessages(['endsOn' => 'Choose a referral cutoff within the academic year\'s start and end dates.']);
            }
            if ($isReferral && $cutoff !== $existing?->ends_on?->toDateString()) {
                if ($validExistingCutoff && $hasCodes) {
                    throw ValidationException::withMessages(['endsOn' => 'The cutoff is locked because referral codes have already been issued.']);
                }
                if ($cutoff !== null && ! $legacyReservation && $cutoff < now(ReferralPeriod::TIMEZONE)->toDateString()) {
                    throw ValidationException::withMessages(['endsOn' => 'Choose a cutoff on or after today.']);
                }
            }
            if ($cutoff === null && $hasCodes) {
                throw ValidationException::withMessages(['endsOn' => 'Existing referral codes need an enrollment cutoff.']);
            }

            return Freebie::updateOrCreate(
                ['school_year_id' => $schoolYear->id, 'type' => $validated['type']],
                [
                    'name' => $validated['name'],
                    'is_active' => $validated['isActive'] ?? true,
                    'starts_on' => $isReferral ? null : ($validated['startsOn'] ?? null),
                    'ends_on' => $cutoff,
                    'min_referrals' => $isReferral ? 1 : null,
                ],
            );
        });

        return new FreebieResource($freebie);
    }
}
