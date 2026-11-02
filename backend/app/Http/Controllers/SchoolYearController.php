<?php

namespace App\Http\Controllers;

use App\Models\SchoolYear;
use App\Support\InstallmentAmounts;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class SchoolYearController extends Controller
{
    public function estimate(Request $request): JsonResponse
    {
        $input = $request->validate([
            'school_year' => ['required', 'string', 'max:20'],
            'year_level' => ['required', Rule::in(SchoolYear::YEAR_LEVELS)],
        ]);

        return DB::transaction(function () use ($input) {
            $year = SchoolYear::query()->where('is_active', true)->where('admission_open', true)
                ->whereNotNull('fees_published_at')->where('school_year', $input['school_year'])
                ->sharedLock()->first();
            abort_if($year === null, 404, 'Published fees are unavailable for this admission year.');
            $fees = $year->fees()->whereIn('year_level', ['all', $input['year_level']])
                ->orderBy('sequence')->orderBy('id')->get();
            $total = round((float) $fees->sum('amount'), 2);

            return response()->json(['data' => [
                'schoolYear' => $year->school_year,
                'yearLevel' => $input['year_level'],
                'publishedAt' => $year->fees_published_at->toIso8601String(),
                'items' => $fees->map(fn ($fee) => ['id' => $fee->id, 'name' => $fee->name, 'category' => $fee->category, 'amount' => (float) $fee->amount]),
                'total' => $total,
                ...InstallmentAmounts::calculate($total, (float) $year->downpayment_value, (int) $year->installment_count),
            ]]);
        });
    }

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
