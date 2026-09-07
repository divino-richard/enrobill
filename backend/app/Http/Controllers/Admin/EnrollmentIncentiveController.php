<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\EnrollmentIncentiveResource;
use App\Models\Enrollment;

class EnrollmentIncentiveController extends Controller
{
    /** Read-only explanation of voucher and incentive state for an enrollment. */
    public function show(Enrollment $enrollment): EnrollmentIncentiveResource
    {
        $enrollment->load([
            'discount',
            'bill.adjustments.discount',
            'incentiveAwards.freebie',
            'incentiveAwards.billAdjustment',
        ]);

        return new EnrollmentIncentiveResource($enrollment);
    }
}
