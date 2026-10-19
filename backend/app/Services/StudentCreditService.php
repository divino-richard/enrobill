<?php

namespace App\Services;

use App\Models\Bill;
use App\Models\Enrollment;
use App\Models\Student;
use App\Models\StudentCredit;
use App\Models\StudentCreditAllocation;
use Illuminate\Support\Facades\DB;

class StudentCreditService
{
    /** Issue once under the bill-generation transaction, before applying any credits. */
    public function issueReturningCredit(Bill $bill, Enrollment $source, ?int $actorId = null): void
    {
        if ($source->student_id !== $bill->student_id
            || ! app(ReturningEnrollmentRules::class)->startEligibility($source, $bill->schoolYear)['eligible']) {
            return;
        }
        $sourceBill = $source->bill()->lockForUpdate()->first();
        if (! $sourceBill) {
            return;
        }

        $paid = Currency::cents($sourceBill->payments()->where('status', 'verified')->sum('amount'));
        // Excess payments already belong to a separate credit, including amounts
        // already used elsewhere. Applied credits are never treated as new cash.
        $excessIssued = Currency::cents($sourceBill->issuedCredit?->amount ?? 0);
        $amount = min(Currency::cents($sourceBill->netTotal()), max($paid - $excessIssued, 0));
        if ($amount <= 0) {
            return;
        }

        StudentCredit::firstOrCreate([
            'source_bill_id' => $sourceBill->id, 'kind' => StudentCredit::RETURNING_STUDENT,
        ], [
            'student_id' => $bill->student_id, 'amount' => Currency::pesos($amount),
            'issued_by' => $actorId ?? $sourceBill->droppingAssessment?->approved_by ?? $bill->enrollment?->created_by,
        ]);
    }

    public function availableFor(Student|int $student): float
    {
        $id = $student instanceof Student ? $student->id : $student;

        return Currency::pesos(StudentCredit::where('student_id', $id)->get()->sum(fn ($credit) => Currency::cents($credit->remaining())));
    }

    /** Release allocations which are no longer needed after a benefit or payment change. */
    public function reconcile(Bill $bill): void
    {
        $allowance = max(Currency::cents($bill->netTotal()) - Currency::cents($bill->amount_paid), 0);
        $allocations = $bill->creditAllocations()->orderBy('id')->lockForUpdate()->get();
        foreach ($allocations as $allocation) {
            $active = Currency::cents($allocation->amount) - Currency::cents($allocation->released_amount);
            $keep = min($active, $allowance);
            $allowance -= $keep;
            if ($keep < $active) {
                $allocation->update(['released_amount' => Currency::pesos(Currency::cents($allocation->released_amount) + $active - $keep)]);
            }
        }
        $bill->unsetRelation('creditAllocations');
    }

    /** Allocate only to a later school year, after its own benefits have been calculated. */
    public function applyToBill(Bill $bill, ?int $actorId = null): void
    {
        DB::transaction(function () use ($bill, $actorId) {
            Student::whereKey($bill->student_id)->lockForUpdate()->firstOrFail();
            if ($bill->enrollment_id) {
                Enrollment::whereKey($bill->enrollment_id)->lockForUpdate()->firstOrFail();
            }
            $bill = Bill::whereKey($bill->id)->lockForUpdate()->firstOrFail();
            if ($bill->hasDroppingAssessment()) {
                return;
            }
            $this->reconcile($bill);
            $needed = Currency::cents($bill->balance());
            $targetStart = $bill->schoolYear?->start_date?->toDateString();
            if (! $targetStart || $needed <= 0) {
                return;
            }
            $credits = StudentCredit::where('student_id', $bill->student_id)->with('sourceBill.schoolYear')->orderBy('id')->lockForUpdate()->get();
            foreach ($credits as $credit) {
                $sourceEnd = $credit->sourceBill?->schoolYear?->end_date?->toDateString();
                if (! $sourceEnd || $targetStart <= $sourceEnd || $credit->source_bill_id === $bill->id) {
                    continue;
                }
                $amount = min($needed, Currency::cents($credit->remaining()));
                if ($amount <= 0) {
                    continue;
                }
                StudentCreditAllocation::create(['credit_id' => $credit->id, 'bill_id' => $bill->id,
                    'amount' => Currency::pesos($amount), 'allocated_by' => $actorId]);
                $needed -= $amount;
                if ($needed <= 0) {
                    break;
                }
            }
        });
    }

    public function previousBalance(Enrollment $enrollment): float
    {
        return Currency::pesos($this->previousBills($enrollment)->sum(fn ($bill) => Currency::cents($bill->balance())));
    }

    public function priorDebtClear(Enrollment $enrollment): bool
    {
        $start = $enrollment->schoolYear?->start_date;
        $hasPreviousDrop = $enrollment->returning_from_enrollment_id !== null
            || Enrollment::where('student_id', $enrollment->student_id)
                ->whereKeyNot($enrollment->id)->where('status', 'dropped')
                ->whereHas('schoolYear', fn ($query) => $query->where(function ($dates) use ($start) {
                    $dates->whereNull('start_date');
                    if ($start) {
                        $dates->orWhere('start_date', '<', $start);
                    } else {
                        $dates->orWhereNotNull('start_date');
                    }
                }))->exists();
        if (! $hasPreviousDrop) {
            return true;
        }
        // An incomplete target calendar cannot establish a valid later-year return.
        if (! $start) {
            return false;
        }
        foreach ($this->previousBills($enrollment) as $bill) {
            if ($bill->balance() > 0) {
                return false;
            }
        }

        return true;
    }

    public function previousBills(Enrollment $enrollment)
    {
        $start = $enrollment->schoolYear?->start_date;

        return Bill::where('student_id', $enrollment->student_id)
            ->where('school_year_id', '!=', $enrollment->school_year_id)
            ->where(function ($query) use ($enrollment, $start) {
                // Always retain the explicit source debt, even for legacy calendars.
                if ($enrollment->returning_from_enrollment_id) {
                    $query->where('enrollment_id', $enrollment->returning_from_enrollment_id);
                }
                $query->orWhereHas('schoolYear', fn ($year) => $year->where(function ($dates) use ($start) {
                    $dates->whereNull('start_date');
                    if ($start) {
                        $dates->orWhere('start_date', '<', $start);
                    } else {
                        $dates->orWhereNotNull('start_date');
                    }
                }));
            })
            ->get();
    }
}
