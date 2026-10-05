<?php

namespace App\Http\Controllers\Admin;

use App\Actions\GenerateBillForEnrollment;
use App\Http\Controllers\Controller;
use App\Http\Resources\EnrollmentResource;
use App\Models\SchoolYear;
use App\Models\Student;
use App\Services\StudentCreditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ReturningEnrollmentController extends Controller
{
    public function summary(Student $student): JsonResponse
    {
        $latest = $student->enrollments()->with('schoolYear')->get()
            ->sortByDesc(fn ($row) => $row->schoolYear?->school_year)->first();
        $eligible = $latest?->status === 'dropped';

        return response()->json(['data' => [
            'eligible' => $eligible,
            'blockers' => $eligible ? [] : ['Only a student whose latest enrollment is dropped can enroll again here.'],
            'latestSchoolYearId' => $latest?->school_year_id,
            'latestSchoolYear' => $latest?->schoolYear?->school_year,
            'previousBalance' => round($student->bills()->get()->sum(fn ($bill) => $bill->balance()), 2),
            'availableCredit' => app(StudentCreditService::class)->availableFor($student),
        ]]);
    }

    public function store(Request $request, Student $student, GenerateBillForEnrollment $generate): EnrollmentResource
    {
        $input = $request->validate([
            'schoolYearId' => ['required', 'integer', 'exists:school_years,id'],
            'program' => ['required', 'string', Rule::exists('programs', 'code')->where('is_active', true)],
            'yearLevel' => ['required', Rule::in(SchoolYear::YEAR_LEVELS)],
            'discountId' => ['present', 'nullable', 'integer', Rule::exists('discounts', 'id')->where('is_active', true)->where('category', 'voucher')],
            'droppingCategory' => ['required', Rule::in(['paying', 'voucher_esc'])],
        ]);
        abort_if($input['discountId'] !== null && $input['droppingCategory'] !== 'voucher_esc', 422, 'Choose Voucher / ESC when assigning a voucher.');

        return DB::transaction(function () use ($request, $student, $generate, $input) {
            $student = Student::lockForUpdate()->findOrFail($student->id);
            $enrollments = $student->enrollments()->with('schoolYear')->lockForUpdate()->get();
            $existing = $enrollments->firstWhere('school_year_id', $input['schoolYearId']);
            if ($existing !== null) {
                abort_unless($existing->returning_from_enrollment_id !== null
                    && $existing->track === $input['program']
                    && $existing->year_level === $input['yearLevel']
                    && $existing->discount_id === $input['discountId']
                    && $existing->dropping_category === $input['droppingCategory'], 422, 'This student already has an enrollment for that school year.');

                return new EnrollmentResource($existing->load(['schoolYear', 'bill', 'discount']));
            }
            $previous = $enrollments->sortByDesc(fn ($row) => $row->schoolYear?->school_year)->first();
            abort_unless($previous?->status === 'dropped', 422, 'The student’s latest enrollment must be dropped before enrolling again.');
            $year = SchoolYear::findOrFail($input['schoolYearId']);
            abort_unless($year->school_year > $previous->schoolYear->school_year
                && $year->start_date && $year->end_date && $previous->schoolYear->end_date
                && $year->start_date->gt($previous->schoolYear->end_date)
                && $year->end_date->gt($year->start_date), 422, 'Choose a later school year with dates after the previous school year ends.');

            $enrollment = $student->enrollments()->create([
                'school_year_id' => $year->id,
                'returning_from_enrollment_id' => $previous->id,
                'track' => $input['program'],
                'year_level' => $input['yearLevel'],
                'discount_id' => $input['discountId'],
                'dropping_category' => $input['droppingCategory'],
                'status' => 'pending',
                'created_by' => $request->user()->id,
            ]);
            $student->update(['track_or_strand' => $input['program'], 'year_level' => $input['yearLevel'], 'school_year' => $year->school_year]);
            $bill = $generate($enrollment);
            app(StudentCreditService::class)->applyToBill($bill, $request->user()->id);
            $bill->refresh()->recalculate();
            $bill->settleEnrollment();
            $student->syncStatusFromLatestEnrollment();

            return new EnrollmentResource($enrollment->fresh()->load(['schoolYear', 'bill', 'discount']));
        }, 3);
    }
}
