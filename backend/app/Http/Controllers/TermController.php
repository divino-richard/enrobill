<?php

namespace App\Http\Controllers;

use App\Models\Term;
use Illuminate\Http\JsonResponse;

class TermController extends Controller
{
    /**
     * The term currently accepting applications (school year + semester), or
     * null when admissions are closed. Readable by any authenticated user —
     * applicants use it to know whether they may submit an application.
     */
    public function open(): JsonResponse
    {
        $term = Term::admitting();

        return response()->json([
            'data' => $term ? [
                'schoolYear' => $term->school_year,
                'semester' => $term->semester,
            ] : null,
        ]);
    }
}
