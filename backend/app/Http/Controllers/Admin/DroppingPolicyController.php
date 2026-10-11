<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\BillResource;
use App\Models\Bill;
use App\Models\BillItem;
use App\Models\DroppingPolicy;
use App\Models\Enrollment;
use App\Models\SchoolYear;
use App\Models\SchoolYearFee;
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

    public function updatePeriod(Request $request, SchoolYear $schoolYear, string $period)
    {
        abort_unless(in_array($period, self::PERIODS, true), 404);
        $rules = [
            'startsOn' => ['required_without:feeRules', 'required_with:endsOn', 'date_format:Y-m-d'],
            'endsOn' => ['required_without:feeRules', 'required_with:startsOn', 'date_format:Y-m-d', 'after_or_equal:startsOn'],
            'feeRules' => ['required_without_all:startsOn,endsOn', 'array:paying,voucher_esc', 'min:1'],
        ];
        foreach (['paying', 'voucher_esc'] as $category) {
            $rules["feeRules.$category"] = ['sometimes', 'array', 'min:1'];
            $rules["feeRules.$category.*"] = ['array:feeId,percent'];
            $rules["feeRules.$category.*.feeId"] = ['required', 'integer', 'distinct', Rule::exists('school_year_fees', 'id')->where('school_year_id', $schoolYear->id)];
            $rules["feeRules.$category.*.percent"] = ['required', 'integer', 'between:1,100'];
        }
        $input = $request->validate($rules);

        return DB::transaction(function () use ($schoolYear, $period, $input) {
            $schoolYear = SchoolYear::lockForUpdate()->findOrFail($schoolYear->id);
            abort_unless($schoolYear->start_date && $schoolYear->end_date, 422, 'Set the school year start and end dates first.');
            $previous = DroppingPolicy::where('school_year_id', $schoolYear->id)->orderByDesc('version')->first();
            $periods = $previous?->periods ?? [];
            // Date edits affect the shared period; fee edits never send or
            // overwrite dates from a potentially stale category editor.
            if (isset($input['startsOn'], $input['endsOn'])) {
                $periods[$period] = ['startsOn' => $input['startsOn'], 'endsOn' => $input['endsOn']];
                abort_if($period === 'enrollment' && $input['startsOn'] > $schoolYear->start_date->toDateString(), 422, 'Enrollment must begin on or before the school year starts.');
                abort_if($period === 'quarter_4' && $input['endsOn'] < $schoolYear->end_date->toDateString(), 422, 'The final quarter must cover the school year’s end date.');
            }
            $lastEnd = null;
            $complete = true;
            foreach (self::PERIODS as $key) {
                $range = $periods[$key] ?? null;
                if (empty($range['startsOn']) || empty($range['endsOn'])) {
                    $complete = false;

                    continue;
                }
                abort_if($lastEnd && $range['startsOn'] <= $lastEnd, 422, 'Periods must follow calendar order without overlapping. Adjust the dates and try again.');
                if ($lastEnd && Carbon::parse($lastEnd)->addDay()->toDateString() !== $range['startsOn']) {
                    $complete = false;
                }
                $lastEnd = $range['endsOn'];
            }

            // Missing keys on legacy policies retain their original category
            // formulas. New policies explicitly start with unconfigured fees.
            $feeRules = $previous?->fee_rules ?? ($previous ? ['paying' => [], 'voucher_esc' => []]
                : array_fill_keys(['paying', 'voucher_esc'], array_fill_keys(self::PERIODS, [])));
            $fees = isset($input['feeRules']) ? $schoolYear->fees()->lockForUpdate()->get()->keyBy('id') : collect();
            foreach ($input['feeRules'] ?? [] as $category => $entries) {
                $feeRules[$category][$period] = array_map(function ($entry) use ($fees) {
                    $fee = $fees->get($entry['feeId']);
                    abort_unless($fee, 422, 'A selected fee is no longer available. Reload the fee schedule.');

                    return ['feeId' => (int) $fee->id, 'percent' => (int) $entry['percent'],
                        'name' => $fee->name, 'category' => $fee->category, 'yearLevel' => $fee->year_level];
                }, $entries);
            }
            foreach (['paying', 'voucher_esc'] as $category) {
                foreach (self::PERIODS as $key) {
                    if (array_key_exists($key, $feeRules[$category]) && $feeRules[$category][$key] === []) {
                        $complete = false;
                    }
                }
            }
            DroppingPolicy::create(['school_year_id' => $schoolYear->id, 'version' => ($previous?->version ?? 0) + 1,
                'enabled' => $complete, 'periods' => $periods,
                'formulas' => $previous?->formulas ?? DroppingPolicy::FORMULAS, 'fee_rules' => $feeRules]);

            return response()->json(['data' => $this->data($schoolYear)]);
        });
    }

    public function update(Request $request, SchoolYear $schoolYear)
    {
        $rules = ['enabled' => ['required', 'boolean'], 'periods' => ['required', 'array:'.implode(',', self::PERIODS)]];
        foreach (self::PERIODS as $period) {
            $rules["periods.$period"] = ['required', 'array:startsOn,endsOn'];
            $rules["periods.$period.startsOn"] = ['required', 'date_format:Y-m-d'];
            $rules["periods.$period.endsOn"] = ['required', 'date_format:Y-m-d', "after_or_equal:periods.$period.startsOn"];
        }
        $rules['feeRules'] = ['sometimes', 'array:paying,voucher_esc', 'size:2'];
        foreach (['paying', 'voucher_esc'] as $category) {
            $rules["feeRules.$category"] = ['required_with:feeRules', 'array:'.implode(',', self::PERIODS)];
            foreach (self::PERIODS as $period) {
                $key = "feeRules.$category.$period";
                $rules[$key] = ['required_with:feeRules', 'array', 'min:1'];
                $rules["$key.*"] = ['array:feeId,percent'];
                $rules["$key.*.feeId"] = ['required', 'integer', 'distinct', Rule::exists('school_year_fees', 'id')->where('school_year_id', $schoolYear->id)];
                $rules["$key.*.percent"] = ['required', 'integer', 'between:1,100'];
            }
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
            $previous = DroppingPolicy::where('school_year_id', $schoolYear->id)->orderByDesc('version')->first();
            $feeRules = $previous?->fee_rules;
            if (isset($input['feeRules'])) {
                $fees = $schoolYear->fees()->lockForUpdate()->get()->keyBy('id');
                $feeRules = $input['feeRules'];
                foreach ($feeRules as &$categoryRules) {
                    foreach ($categoryRules as &$entries) {
                        foreach ($entries as &$entry) {
                            $fee = $fees->get($entry['feeId']);
                            abort_unless($fee, 422, 'A selected fee is no longer available. Reload the fee schedule.');
                            $entry = ['feeId' => (int) $fee->id, 'percent' => (int) $entry['percent'],
                                'name' => $fee->name, 'category' => $fee->category, 'yearLevel' => $fee->year_level];
                        }
                        unset($entry);
                    }
                    unset($entries);
                }
                unset($categoryRules);
            }
            DroppingPolicy::create(['school_year_id' => $schoolYear->id, 'version' => $version,
                'enabled' => $input['enabled'], 'periods' => $input['periods'],
                'formulas' => $previous?->formulas ?? DroppingPolicy::FORMULAS, 'fee_rules' => $feeRules]);

            return response()->json(['data' => $this->data($schoolYear)]);
        });
    }

    public function classification(Request $request, Bill $bill)
    {
        $input = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.id' => ['required', 'integer', 'distinct'],
            'items.*.component' => ['present', 'nullable', Rule::in(['registration', 'miscellaneous', 'laboratory', 'tuition', 'other'])],
            'items.*.sourceFeeId' => ['sometimes', 'nullable', 'integer'],
        ]);

        return DB::transaction(function () use ($bill, $input) {
            Student::lockForUpdate()->findOrFail($bill->student_id);
            Enrollment::lockForUpdate()->findOrFail($bill->enrollment_id);
            $bill = Bill::lockForUpdate()->findOrFail($bill->id);
            abort_if($bill->droppingAssessment()->exists(), 422, 'The approved dropping assessment cannot be changed.');
            $ids = $bill->items()->pluck('id');
            abort_if(collect($input['items'])->pluck('id')->diff($ids)->isNotEmpty(), 422, 'Every fee must belong to this bill.');
            foreach ($input['items'] as $item) {
                $billItem = BillItem::where('bill_id', $bill->id)->findOrFail($item['id']);
                $changes = ['dropping_component' => $item['component']];
                if (array_key_exists('sourceFeeId', $item) && $item['sourceFeeId'] !== $billItem->source_fee_id) {
                    $fee = isset($item['sourceFeeId']) ? SchoolYearFee::where('school_year_id', $bill->school_year_id)->find($item['sourceFeeId']) : null;
                    abort_if(isset($item['sourceFeeId']) && ! $fee, 422, 'Choose a fee from this bill’s school year.');
                    abort_if($fee && ! in_array($fee->year_level, ['all', $bill->enrollment->year_level], true), 422, 'Choose a fee for this enrollment’s grade level.');
                    $changes['source_fee_id'] = $fee?->id;
                }
                $billItem->update($changes);
            }
            $sources = $bill->items()->whereNotNull('source_fee_id')->pluck('source_fee_id');
            abort_if($sources->count() !== $sources->unique()->count(), 422, 'Each fee schedule item can be linked to only one bill line.');

            return new BillResource($bill->fresh());
        });
    }

    private function data(SchoolYear $schoolYear): array
    {
        $policy = DroppingPolicy::where('school_year_id', $schoolYear->id)->orderByDesc('version')->first();

        return ['id' => $policy?->id, 'schoolYearId' => $schoolYear->id, 'version' => $policy?->version ?? 0,
            'enabled' => $policy?->enabled ?? false, 'periods' => $policy?->periods ?? (object) [],
            'formulas' => $policy?->formulas ?? DroppingPolicy::FORMULAS, 'feeRules' => $policy?->fee_rules];
    }
}
