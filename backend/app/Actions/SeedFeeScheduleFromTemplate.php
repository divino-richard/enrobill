<?php

namespace App\Actions;

use App\Models\SchoolYear;
use App\Support\FeeScheduleTemplate;

class SeedFeeScheduleFromTemplate
{
    /**
     * Populate a school year's fee schedule from the default template
     * ([[FeeScheduleTemplate]]). No-op (returns 0) if it already has fees, so it's
     * safe to call on a freshly created year. Returns the number of items created.
     */
    public function __invoke(SchoolYear $schoolYear): int
    {
        if ($schoolYear->fees()->exists()) {
            return 0;
        }

        $rows = FeeScheduleTemplate::rows();
        $schoolYear->fees()->createMany($rows);

        return count($rows);
    }
}
