<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\BillResource;
use App\Models\Bill;
use App\Models\BillItem;
use App\Models\DroppingPolicy;
use App\Models\Enrollment;
use App\Models\SchoolYear;
use App\Models\Student;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class DroppingPolicyController extends Controller
{
    private const PERIODS = ['enrollment', 'quarter_1', 'quarter_2', 'quarter_3', 'quarter_4'];

    public function show(SchoolYear $schoolYear)
    {
        return response()->json(['data' => $this->data($schoolYear)]);
    }

    public function update(Request $request, SchoolYear $schoolYear)
    {
        $rules = ['enabled' => ['required', 'boolean'], 'periods' => ['required', 'array:'.implode(',', self::PERIODS)]];
        foreach (self::PERIODS as $period) {
            $rules["periods.$period"] = ['required', 'array:startsOn,endsOn'];
            $rules["periods.$period.startsOn"] = ['required', 'date_format:Y-m-d'];
            $rules["periods.$period.endsOn"] = ['required', 'date_format:Y-m-d', "after_or_equal:periods.$period.startsOn"];
        }
        $input = $request->validate($rules);

        return DB::transaction(function () use ($schoolYear, $input) {
            $schoolYear = SchoolYear::lockForUpdate()->findOrFail($schoolYear->id);
            $previousEnd = null;
            foreach (self::PERIODS as $period) {
                $range = $input['periods'][$period];
                abort_if($previousEnd && Carbon::parse($previousEnd)->addDay()->toDateString() !== $range['startsOn'], 422,
                    'The five periods must be in order, with no gaps or overlapping dates.');
                $previousEnd = $range['endsOn'];
            }
            abort_unless($schoolYear->start_date && $schoolYear->end_date, 422, 'Set the school year start and end dates first.');
            abort_if($input['periods']['enrollment']['startsOn'] > $schoolYear->start_date->toDateString()
                || $input['periods']['quarter_4']['endsOn'] < $schoolYear->end_date->toDateString(), 422,
                'The policy dates must cover the full school year.');
            $version = (int) DroppingPolicy::where('school_year_id', $schoolYear->id)->max('version') + 1;
            DroppingPolicy::create(['school_year_id' => $schoolYear->id, 'version' => $version,
                'enabled' => $input['enabled'], 'periods' => $input['periods']]);

            return response()->json(['data' => $this->data($schoolYear)]);
        });
    }

    public function classification(Request $request, Bill $bill)
    {
        $input = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.id' => ['required', 'integer', 'distinct'],
            'items.*.component' => ['required', Rule::in(['registration', 'miscellaneous', 'laboratory', 'tuition', 'other'])],
        ]);

        return DB::transaction(function () use ($bill, $input) {
            Student::lockForUpdate()->findOrFail($bill->student_id);
            Enrollment::lockForUpdate()->findOrFail($bill->enrollment_id);
            $bill = Bill::lockForUpdate()->findOrFail($bill->id);
            abort_if($bill->droppingAssessment()->exists(), 422, 'The approved dropping assessment cannot be changed.');
            $ids = $bill->items()->pluck('id');
            abort_if(collect($input['items'])->pluck('id')->diff($ids)->isNotEmpty(), 422, 'Every fee must belong to this bill.');
            foreach ($input['items'] as $item) {
                BillItem::where('bill_id', $bill->id)->findOrFail($item['id'])->update(['dropping_component' => $item['component']]);
            }

            return new BillResource($bill->fresh());
        });
    }

    public function category(Request $request, Enrollment $enrollment)
    {
        $input = $request->validate(['category' => ['required', Rule::in(['paying', 'voucher_esc'])]]);

        return DB::transaction(function () use ($enrollment, $input) {
            Student::lockForUpdate()->findOrFail($enrollment->student_id);
            $enrollment = Enrollment::lockForUpdate()->findOrFail($enrollment->id);
            $bill = $enrollment->bill()->lockForUpdate()->first();
            abort_if($bill?->droppingAssessment()->exists(), 422, 'The approved dropping category cannot be changed.');
            $enrollment->update(['dropping_category' => $input['category']]);

            return response()->json(['data' => ['enrollmentId' => $enrollment->id, 'category' => $enrollment->dropping_category]]);
        });
    }

    private function data(SchoolYear $schoolYear): array
    {
        $policy = DroppingPolicy::where('school_year_id', $schoolYear->id)->orderByDesc('version')->first();

        return ['id' => $policy?->id, 'schoolYearId' => $schoolYear->id, 'version' => $policy?->version ?? 0,
            'enabled' => $policy?->enabled ?? false, 'periods' => $policy?->periods ?? (object) [],
            'formulas' => $policy?->formulas ?? DroppingPolicy::FORMULAS];
    }
}
