<?php

namespace App\Http\Controllers;

use App\Actions\ReferralLifecycle;
use App\Http\Resources\ApplicationResource;
use App\Models\Freebie;
use App\Models\IncentiveAward;
use App\Models\Referral;
use App\Models\ReferralCode;
use App\Models\SchoolYear;
use App\Models\Student;
use App\Services\ReferralPeriod;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ReferralController extends Controller
{
    /**
     * The authenticated student's referral code and referral progress for a target
     * school year. Other students are always shown as first name + surname initial.
     */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'schoolYearId' => ['nullable', 'integer', 'exists:school_years,id'],
        ]);
        $student = $this->student($request);
        $targetYear = isset($validated['schoolYearId'])
            ? SchoolYear::findOrFail($validated['schoolYearId'])
            : $this->defaultTargetYear($student);

        return response()->json([
            'data' => $this->summary($student, $targetYear),
        ]);
    }

    /** Issue (or return) the student's stable reusable code for a target year. */
    public function store(Request $request, ReferralLifecycle $referrals): JsonResponse
    {
        $validated = $request->validate([
            'targetSchoolYearId' => ['nullable', 'integer', 'exists:school_years,id'],
        ]);
        $student = $this->student($request);
        $targetYear = SchoolYear::admitting();

        if ($targetYear === null) {
            throw ValidationException::withMessages([
                'targetSchoolYearId' => 'No school year is currently accepting applications.',
            ]);
        }
        if (isset($validated['targetSchoolYearId'])
            && (int) $validated['targetSchoolYearId'] !== $targetYear->id) {
            throw ValidationException::withMessages([
                'targetSchoolYearId' => 'Referral codes can only be issued for the school year currently accepting applications.',
            ]);
        }

        $referrals->issueCode($student, $targetYear, $request->user());

        return response()->json([
            'data' => $this->summary($student, $targetYear),
        ], 201);
    }

    private function student(Request $request): Student
    {
        $student = $request->user()?->student;
        abort_if($student === null, 404, 'No student record found.');

        return $student;
    }

    private function defaultTargetYear(Student $student): ?SchoolYear
    {
        $admitting = SchoolYear::admitting();
        if ($admitting !== null) {
            return $admitting;
        }

        return $student->referralCodes()
            ->with('targetSchoolYear')
            ->latest('school_year_id')
            ->first()
            ?->targetSchoolYear;
    }

    /**
     * @return array<string, mixed>
     */
    private function summary(Student $student, ?SchoolYear $targetYear): array
    {
        $period = app(ReferralPeriod::class);
        $cutoff = $targetYear ? $period->closesAt($targetYear->id) : null;
        $ended = $targetYear !== null && $period->hasEnded($targetYear->id);
        $campaignActive = $cutoff !== null && ! $ended && $targetYear !== null
            && (bool) $targetYear->is_active
            && (bool) $targetYear->admission_open
            && Freebie::query()
                ->where('school_year_id', $targetYear->id)
                ->where('type', IncentiveAward::TYPE_REFERRAL)
                ->where('is_active', true)
                ->exists();
        $code = $targetYear === null
            ? null
            : ReferralCode::query()
                ->where('referrer_student_id', $student->id)
                ->where('school_year_id', $targetYear->id)
                ->with([
                    'targetSchoolYear',
                    'referrals' => fn ($query) => $query
                        ->with(['referredApplication', 'referredStudent'])
                        ->latest('claimed_at'),
                ])
                ->first();

        $referrals = $code?->referrals ?? collect();
        $successfulCount = $referrals->where('status', Referral::STATUS_SUCCESSFUL)->count();
        $award = $targetYear === null
            ? null
            : IncentiveAward::query()
                ->where('school_year_id', $targetYear->id)
                ->where('student_id', $student->id)
                ->where('type', IncentiveAward::TYPE_REFERRAL)
                ->where('beneficiary', IncentiveAward::BENEFICIARY_REFERRER_GRADE_12)
                ->first();

        $alreadyPaid = $targetYear !== null && $code === null && app(ReferralLifecycle::class)->hasGrade12Payments($student, $targetYear);

        return [
            'enrollmentCutoff' => $cutoff?->toDateString(),
            'enrollmentCutoffPassed' => $ended,
            'ineligibilityReason' => $alreadyPaid ? 'A Grade 12 payment has already been submitted or recorded. Referral participation must start before payment. Contact the registrar to review your account.' : null,
            'targetSchoolYear' => $targetYear ? [
                'id' => $targetYear->id,
                'schoolYear' => $targetYear->school_year,
            ] : null,
            'campaignEnabled' => $campaignActive,
            'code' => $code ? [
                'id' => $code->id,
                'code' => $code->code,
                'targetSchoolYear' => [
                    'id' => $code->targetSchoolYear->id,
                    'schoolYear' => $code->targetSchoolYear->school_year,
                ],
                'isActive' => (bool) $code->is_active,
            ] : null,
            'eligibleToRefer' => ! $alreadyPaid && $campaignActive
                && $this->hasQualifyingEnrollment($student, $targetYear),
            'successfulCount' => $successfulCount,
            'benefitStatus' => $award?->status ?? ($successfulCount > 0 ? 'pending' : ($ended && $code !== null ? 'expired' : 'not_earned')),
            'referrals' => $referrals->map(fn (Referral $referral) => [
                'id' => $referral->id,
                'referredDisplay' => $this->referredDisplay($referral),
                'status' => $period->status($referral),
            ])->values()->all(),
        ];
    }

    private function hasQualifyingEnrollment(Student $student, ?SchoolYear $targetYear): bool
    {
        if ($targetYear === null) {
            return false;
        }

        if (! preg_match('/^(\d{4})-(\d{4})$/', $targetYear->school_year, $parts)) {
            return false;
        }

        $priorLabel = ((int) $parts[1] - 1).'-'.((int) $parts[2] - 1);
        $priorYear = SchoolYear::query()->where('school_year', $priorLabel)->first();

        return $priorYear !== null && $student->enrollments()
            ->where('school_year_id', $priorYear->id)
            ->where('year_level', 'grade_11')
            ->where('status', 'enrolled')
            ->exists();
    }

    private function referredDisplay(Referral $referral): ?string
    {
        if ($referral->referredStudent !== null) {
            return ApplicationResource::studentDisplay($referral->referredStudent);
        }

        $application = $referral->referredApplication;
        if ($application === null) {
            return null;
        }

        return ApplicationResource::nameDisplay($application->given_name, $application->surname);
    }
}
