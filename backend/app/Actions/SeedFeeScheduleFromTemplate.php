<?php

namespace App\Actions;

use App\Models\SchoolYear;
use App\Support\FeeScheduleTemplate;

class SeedFeeScheduleFromTemplate
{
    /**
     * Populate a draft from the latest earlier published schedule, or the default template
     * ([[FeeScheduleTemplate]]). No-op (returns 0) if it already has fees, so it's
     * safe to call on a freshly created year. Returns the number of items created.
     */
    public function __invoke(SchoolYear $schoolYear): int
    {
        if ($schoolYear->fees()->exists()) {
            return 0;
        }

        $source = SchoolYear::query()
            ->where('start_date', '<', $schoolYear->start_date)
            ->whereNotNull('fees_published_at')
            ->whereHas('fees')
            ->orderByDesc('start_date')
            ->sharedLock()->first();

        $rows = $source
            ? $source->fees()->orderBy('sequence')->orderBy('id')->get()->map(fn ($fee) => $fee->only([
                'year_level', 'category', 'dropping_component', 'name', 'type', 'amount', 'sequence',
            ]))->all()
            : FeeScheduleTemplate::rows();
        $schoolYear->fees()->createMany($rows);

        return count($rows);
    }
}
