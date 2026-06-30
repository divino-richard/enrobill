<?php

namespace App\Http\Controllers;

use App\Models\SchoolYear;
use Illuminate\Http\JsonResponse;

class SchoolYearController extends Controller
{
    /**
     * The school year currently accepting applications, or null when admissions
     * are closed. Readable by any authenticated user — applicants use it to know
     * whether they may submit an application.
     */
    public function open(): JsonResponse
    {
        $schoolYear = SchoolYear::admitting();

        return response()->json([
            'data' => $schoolYear ? [
                'schoolYear' => $schoolYear->school_year,
            ] : null,
        ]);
    }
}
