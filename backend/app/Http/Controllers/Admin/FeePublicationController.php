<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\SchoolYearResource;
use App\Models\SchoolYear;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class FeePublicationController extends Controller
{
    public function publish(SchoolYear $schoolYear): SchoolYearResource
    {
        return DB::transaction(function () use ($schoolYear) {
            $schoolYear = SchoolYear::whereKey($schoolYear->id)->lockForUpdate()->firstOrFail();
            $fees = $schoolYear->fees()->get();
            foreach (SchoolYear::YEAR_LEVELS as $level) {
                $hasTuition = $fees->contains(fn ($fee) => in_array($fee->year_level, ['all', $level], true) && $fee->category === 'tuition');
                if (! $hasTuition) {
                    throw ValidationException::withMessages(['fees' => 'Add a tuition fee for both Grade 11 and Grade 12 before publishing. A zero amount is allowed.']);
                }
            }
            if ($fees->contains(fn ($fee) => (float) $fee->amount < 0)
                || $schoolYear->downpayment_value === null || (float) $schoolYear->downpayment_value < 0
                || $schoolYear->installment_count < 1 || $schoolYear->installment_count > 24) {
                throw ValidationException::withMessages(['fees' => 'Review fee amounts and set a valid downpayment and installment count before publishing.']);
            }
            $schoolYear->update(['fees_published_at' => $schoolYear->fees_published_at ?? now()]);

            return new SchoolYearResource($schoolYear);
        });
    }

    public function draft(SchoolYear $schoolYear): SchoolYearResource
    {
        return DB::transaction(function () use ($schoolYear) {
            $schoolYear = SchoolYear::whereKey($schoolYear->id)->lockForUpdate()->firstOrFail();
            $schoolYear->update(['fees_published_at' => null, 'admission_open' => false]);

            return new SchoolYearResource($schoolYear);
        });
    }
}
