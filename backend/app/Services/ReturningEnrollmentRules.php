<?php

namespace App\Services;

use App\Models\Bill;
use App\Models\DroppingRequest;
use App\Models\Enrollment;
use App\Models\SchoolYear;
use App\Models\Student;
use Illuminate\Support\Carbon;

/** One authority for return windows, collection timing, and activation requirements. */
class ReturningEnrollmentRules
{
    public function latest(Student $student): ?Enrollment
    {
        return $student->enrollments()->with('schoolYear')->get()
            ->sortByDesc(fn ($row) => [$row->schoolYear?->school_year, $row->id])->first();
    }

    /** Resolve history even when an alternative enrollment path omits the return link. */
    public function source(Enrollment $target): ?Enrollment
    {
        $history = Enrollment::where('student_id', $target->student_id)
            ->when($target->exists, fn ($q) => $q->whereKeyNot($target->id))
            ->with('schoolYear')->get()
            ->sortByDesc(fn ($row) => [$row->schoolYear?->school_year, $row->id]);

        foreach ($history as $row) {
            if ($row->status === 'dropped') {
                return $row;
            }
            // A withdrawn/completed attempt which never activated cannot hide
            // the unresolved drop. An actual enrolled milestone closes its window.
            if ($row->status === 'enrolled' || $row->enrolled_at !== null) {
                return null;
            }
        }

        return null;
    }

    public function eligibility(Enrollment $source, ?SchoolYear $year = null): array
    {
        $drop = DroppingRequest::where('enrollment_id', $source->id)
            ->where('student_id', $source->student_id)->where('status', 'confirmed')->latest('id')->first();
        $date = $drop?->effective_date?->toDateString();
        $deadline = $date ? Carbon::parse($date, 'Asia/Manila')->addYearsNoOverflow(2)->toDateString() : null;
        $blockers = [];
        if ($source->status !== 'dropped') {
            $blockers[] = 'The previous enrollment must have an approved drop.';
        }
        if (! $date) {
            $blockers[] = 'The confirmed effective dropping date is missing. Ask the school to correct the historical dropping record before re-enrollment.';
        } elseif ($date > now('Asia/Manila')->toDateString()) {
            $blockers[] = 'The effective dropping date is in the future. Ask the school to correct the historical dropping record before re-enrollment.';
        } elseif (now('Asia/Manila')->toDateString() > $deadline) {
            $blockers[] = "The re-enrollment deadline was {$deadline} (Asia/Manila). Enrollment had to become active by that date.";
        }
        if ($year && ! ($year->school_year > $source->schoolYear?->school_year
            && $year->start_date && $year->end_date && $source->schoolYear?->end_date
            && $year->start_date->gt($source->schoolYear->end_date)
            && $year->end_date->gt($year->start_date))) {
            $blockers[] = 'Choose a later school year with dates after the previous school year ends.';
        }

        return ['effectiveDroppingDate' => $date, 'returnDeadline' => $deadline,
            'eligible' => $blockers === [], 'blockers' => $blockers];
    }

    public function requirements(Enrollment $target): ?array
    {
        // Never reopen or invalidate an enrollment which is already active.
        if ($target->getRawOriginal('status') === 'enrolled' || $target->status === 'completed') {
            return null;
        }
        $source = $this->source($target);
        if (! $source) {
            return null;
        }
        $eligibility = $this->eligibility($source, $target->schoolYear);
        $credits = app(StudentCreditService::class);
        $previous = $credits->previousBalance($target);
        $bill = $target->bill()->first();
        $newPayment = $bill?->enrollmentPaymentRemaining();
        $blockers = $eligibility['blockers'];
        if ($previous > 0) {
            $blockers[] = 'Settle all previous dropping balances before completing re-enrollment. Only verified payments and applied credits count.';
        }
        if ($bill === null) {
            $blockers[] = 'Generate the new school year’s bill to determine its enrollment payment requirement.';
        } elseif ($newPayment > 0) {
            $blockers[] = 'Meet the new school year’s enrollment payment requirement.';
        }
        $pending = $target->student->bills()->whereHas('payments', fn ($q) => $q->where('status', 'pending'))->exists();
        if ($pending && ($previous > 0 || $newPayment > 0)) {
            $blockers[] = 'A payment is awaiting verification; it does not count toward enrollment yet.';
        }

        return [...$eligibility, 'blockers' => $blockers, 'canActivate' => $blockers === [],
            'previousBalance' => $previous, 'newEnrollmentPayment' => $newPayment];
    }

    public function activationBlockers(Enrollment $target): array
    {
        $return = $this->requirements($target);
        if ($return !== null) {
            return $return['blockers'];
        }
        $bill = $target->bill()->first();

        return $bill && $bill->enrollmentDownpaymentMet() ? [] : ['Meet this enrollment’s payment requirement before activation.'];
    }

    public function collectionState(Bill $bill): string
    {
        if (! $bill->isDroppingBill()) {
            return 'standard';
        }
        foreach (Enrollment::where('student_id', $bill->student_id)->where('status', 'pending')->get() as $target) {
            $source = $this->source($target);
            if ($source && $this->eligibility($source, $target->schoolYear)['eligible']
                && app(StudentCreditService::class)->previousBills($target)->contains('id', $bill->id)) {
                return 'required_for_reenrollment';
            }
        }

        return 'deferred_until_reenrollment';
    }

    public function billReturnRequirements(Bill $bill): ?array
    {
        if (! $bill->isDroppingBill()) {
            return $bill->enrollment ? $this->requirements($bill->enrollment) : null;
        }
        foreach (Enrollment::where('student_id', $bill->student_id)->where('status', 'pending')->get() as $target) {
            if ($this->source($target) && app(StudentCreditService::class)->previousBills($target)->contains('id', $bill->id)) {
                return $this->requirements($target);
            }
        }
        // Expose the date even before a student decides to return.
        $source = $bill->enrollment;
        if ($source && Enrollment::where('student_id', $bill->student_id)->where(fn ($q) => $q->where('status', 'enrolled')->orWhereNotNull('enrolled_at'))
            ->whereHas('schoolYear', fn ($q) => $q->where('school_year', '>', $source->schoolYear?->school_year))->exists()) {
            return null;
        }

        return $source ? $this->eligibility($source) : null;
    }
}
