<?php

namespace App\Services;

use App\Actions\NotifyStudent;
use App\Models\DroppingRequest;
use App\Models\Enrollment;
use App\Models\Program;
use App\Models\SchoolYear;
use App\Models\Student;
use Illuminate\Support\Facades\DB;

/** Student-owned return journey; all financial eligibility stays in the shared rules. */
class StudentReturningEnrollment
{
    public function __construct(private ReturningEnrollmentRules $rules, private StudentCreditService $credits) {}

    public function summary(Student $student, ?SchoolYear $lockedYear = null): array
    {
        $latest = $this->rules->latest($student);
        $source = $latest?->status === 'dropped' ? $latest : ($latest ? $this->rules->source($latest) : null);
        $returning = $latest && $latest->status !== 'dropped' && ($source || $latest->returning_from_enrollment_id);
        $base = ['state' => 'not_applicable', 'canStart' => false, 'blockers' => [], 'effectiveDroppingDate' => null,
            'returnDeadline' => null, 'source' => null, 'offer' => null, 'enrollment' => null, 'requirements' => null,
            'previousBills' => [], 'availableCredit' => $this->credits->availableFor($student)];
        if (! $latest || (! $source && ! $returning)) {
            return $base;
        }
        if ($returning && $latest->status !== 'enrolled' && $latest->enrolled_at !== null) {
            return $base;
        }
        if ($returning && $latest->status === 'enrolled') {
            return [...$base, 'state' => 'enrolled', 'enrollment' => $this->enrollment($latest)];
        }
        $source ??= Enrollment::where('student_id', $student->id)->find($latest->returning_from_enrollment_id);
        if (! $source) {
            return $base;
        }
        $eligibility = $this->rules->eligibility($source);
        $drop = DroppingRequest::where('enrollment_id', $source->id)->where('status', 'confirmed')->latest('id')->first();
        $program = Program::where('code', $source->track)->first();
        $bills = $returning ? $this->credits->previousBills($latest) : $student->bills()->with('schoolYear')->get();
        $base = [...$base, ...$eligibility, 'source' => ['id' => $source->id, 'schoolYear' => $source->schoolYear?->school_year,
            'program' => $source->track, 'programName' => $program?->name ?? $source->track, 'yearLevel' => $source->year_level,
            'droppingRequestId' => $drop?->id, 'billId' => $source->bill?->id],
            'previousBills' => $bills->map(fn ($bill) => ['id' => $bill->id, 'schoolYear' => $bill->schoolYear?->school_year,
                'balance' => $bill->balance(), 'pendingPayment' => round((float) $bill->payments()->where('status', 'pending')->sum('amount'), 2)])->values()->all()];
        if ($returning) {
            $requirements = $this->rules->requirements($latest);
            return [...$base, 'state' => $latest->status === 'pending' && ($requirements['eligible'] ?? false) ? 'pending' : 'blocked',
                'enrollment' => $this->enrollment($latest), 'requirements' => $requirements,
                'blockers' => $latest->status === 'pending' ? ($requirements['blockers'] ?? $base['blockers'])
                    : ['Your previous return was closed. Contact the school to review your enrollment record.']];
        }
        if (! $eligibility['eligible']) {
            return [...$base, 'state' => 'blocked'];
        }
        $year = $lockedYear ?? SchoolYear::admitting();
        if (! $year || ! $year->is_active || ! $year->admission_open || ! $this->rules->eligibility($source, $year)['eligible']) {
            return [...$base, 'state' => 'unavailable', 'blockers' => ['Re-enrollment is not yet open for a later school year. Your records remain available.']];
        }
        if (! $program?->is_active || ! in_array($source->year_level, SchoolYear::YEAR_LEVELS, true)) {
            return [...$base, 'state' => 'blocked', 'blockers' => ['Contact the school to confirm your returning program and grade level.']];
        }
        $fees = $year->fees()->whereIn('year_level', ['all', $source->year_level])->get();
        if ($fees->isEmpty()) {
            return [...$base, 'state' => 'unavailable', 'blockers' => ['The school is preparing fees for your returning grade. Re-enrollment will be available once setup is complete.']];
        }
        $start = $this->rules->startEligibility($source, $year);
        if (! $start['eligible']) {
            return [...$base, 'state' => 'settlement_required', 'blockers' => $start['blockers']];
        }
        return [...$base, 'state' => 'ready', 'canStart' => true, 'offer' => ['schoolYearId' => $year->id,
            'schoolYear' => $year->school_year, 'feeTotal' => round((float) $fees->sum('amount'), 2),
            'downpaymentValue' => (float) $year->downpayment_value]];
    }

    public function start(Student $student, int $yearId, int $actorId): Enrollment
    {
        return DB::transaction(function () use ($student, $yearId, $actorId) {
            $student = Student::whereKey($student->id)->lockForUpdate()->firstOrFail();
            $student->enrollments()->lockForUpdate()->get();
            $existing = $student->enrollments()->where('school_year_id', $yearId)->first();
            if ($existing) {
                abort_unless(($existing->returning_from_enrollment_id || $this->rules->source($existing))
                    && in_array($existing->status, ['pending', 'enrolled'], true), 422, 'An enrollment already exists for this school year.');
                return $existing;
            }
            // Lock the calendar so an admissions change cannot race this decision.
            $year = SchoolYear::whereKey($yearId)->lockForUpdate()->firstOrFail();
            $summary = $this->summary($student, $year);
            abort_unless($summary['canStart'] && $summary['offer']['schoolYearId'] === $yearId,
                422, implode(' ', $summary['blockers']) ?: 'Choose the school year currently open for re-enrollment.');
            $source = $summary['source'];
            $enrollment = $student->enrollments()->create(['school_year_id' => $yearId,
                'returning_from_enrollment_id' => $source['id'], 'track' => $source['program'],
                'year_level' => $source['yearLevel'], 'discount_id' => null, 'status' => 'pending', 'created_by' => $actorId]);
            $student->update(['track_or_strand' => $source['program'], 'year_level' => $source['yearLevel'], 'school_year' => $summary['offer']['schoolYear']]);
            $student->syncStatusFromLatestEnrollment();
            app(NotifyStudent::class)($student, 'enrollment', 'Re-enrollment started',
                'Your pending enrollment has been created. The cashier will generate your new school-year bill and confirm its payment requirement.',
                'View re-enrollment', '/portal/programs?reenroll=1', false, 'returning-started:'.$enrollment->id);
            return $enrollment->fresh();
        }, 3);
    }

    private function enrollment(Enrollment $enrollment): array
    {
        $program = Program::where('code', $enrollment->track)->first();
        return ['id' => $enrollment->id, 'status' => $enrollment->status,
            'program' => $enrollment->track, 'programName' => $program?->name ?? $enrollment->track, 'yearLevel' => $enrollment->year_level,
            'schoolYear' => $enrollment->schoolYear?->school_year, 'billId' => $enrollment->bill?->id];
    }
}
