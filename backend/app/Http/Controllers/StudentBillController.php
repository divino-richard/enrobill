<?php

namespace App\Http\Controllers;

use App\Http\Resources\BillResource;
use App\Http\Resources\EnrollmentResource;
use App\Models\Bill;
use App\Models\Enrollment;
use App\Models\SchoolYear;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class StudentBillController extends Controller
{
    /**
     * Channels a student can submit a self-service payment for (digital wallets).
     */
    private const SUBMIT_METHODS = ['gcash', 'maya'];

    private const ALLOWED_TYPES = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
    ];

    private const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

    /**
     * The authenticated student's bill for the active school year, with payments.
     */
    public function show(Request $request): BillResource
    {
        return new BillResource($this->resolveBill($request));
    }

    /**
     * All of the authenticated student's bills across every school year, newest
     * first — the current bill plus history.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $student = $request->user()->student;
        abort_if($student === null, 404, 'No student record found.');

        $bills = $student->bills()
            ->with(['schoolYear', 'enrollment', 'items', 'adjustments', 'installments', 'payments.recorder', 'payments.submitter'])
            ->latest()
            ->get();

        return BillResource::collection($bills);
    }

    /**
     * The student's enrollment per school year — program, year level, semester and
     * status for the current year plus past years. Newest first.
     */
    public function enrollments(Request $request): AnonymousResourceCollection
    {
        $student = $request->user()->student;
        abort_if($student === null, 404, 'No student record found.');

        $records = $student->enrollments()
            ->with('schoolYear')
            ->get()
            ->sortByDesc(fn (Enrollment $e) => $e->schoolYear?->school_year ?? '')
            ->values();

        return EnrollmentResource::collection($records);
    }

    /**
     * Pre-signed S3 URL for uploading a proof-of-payment screenshot.
     */
    public function presign(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'contentType' => ['required', 'string', Rule::in(array_keys(self::ALLOWED_TYPES))],
            'size' => ['required', 'integer', 'min:1', 'max:'.self::MAX_BYTES],
        ]);

        $key = sprintf(
            'payment-proofs/%s/%s.%s',
            $request->user()->id,
            Str::uuid()->toString(),
            self::ALLOWED_TYPES[$validated['contentType']],
        );

        $signed = Storage::disk('s3')->temporaryUploadUrl(
            $key,
            now()->addMinutes(10),
            ['ContentType' => $validated['contentType']],
        );

        return response()->json([
            'key' => $key,
            'url' => $signed['url'],
            'headers' => $signed['headers'],
        ]);
    }

    /**
     * Submit a payment for admin verification, with a proof screenshot. The
     * student chooses how much to pay — at least the amount due now (the next
     * installment / downpayment) and at most the outstanding balance. Paying more
     * lowers their remaining monthly installments. The payment is pending and
     * doesn't reduce the balance until an admin verifies it.
     */
    public function storePayment(Request $request): BillResource
    {
        $bill = $this->resolveBill($request);

        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01', 'max:99999999.99'],
            'method' => ['required', Rule::in(self::SUBMIT_METHODS)],
            'reference' => ['nullable', 'string', 'max:100'],
            'proofKey' => ['required', 'string', 'max:255'],
            'paidAt' => ['required', 'date'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        // Only one payment may be under review at a time — the student must wait
        // for it to be verified or rejected before submitting another.
        if ($bill->payments()->where('status', 'pending')->exists()) {
            throw ValidationException::withMessages([
                'payment' => 'You already have a payment awaiting verification. Please wait for it to be reviewed before submitting another.',
            ]);
        }

        $due = $bill->amountDue();
        $balance = round($bill->netTotal() - (float) $bill->amount_paid, 2);

        if ($balance <= 0) {
            throw ValidationException::withMessages([
                'amount' => 'This bill has no outstanding amount due.',
            ]);
        }

        $amount = round((float) $validated['amount'], 2);

        if ($amount < $due - 0.01) {
            throw ValidationException::withMessages([
                'amount' => "Please pay at least the amount due of {$due}.",
            ]);
        }

        if ($amount > $balance + 0.01) {
            throw ValidationException::withMessages([
                'amount' => "The payment exceeds the outstanding balance of {$balance}.",
            ]);
        }

        $bill->payments()->create([
            'amount' => min($amount, $balance),
            'method' => $validated['method'],
            'status' => 'pending',
            'reference' => $validated['reference'] ?? null,
            'proof_key' => $validated['proofKey'],
            'paid_at' => $validated['paidAt'],
            'note' => $validated['note'] ?? null,
            'submitted_by' => $request->user()->id,
        ]);

        return new BillResource(
            $bill->fresh()->load(['schoolYear', 'enrollment', 'items', 'adjustments', 'installments', 'payments.recorder', 'payments.submitter']),
        );
    }

    /**
     * The authenticated user's bill for the active school year, or 404.
     */
    private function resolveBill(Request $request): Bill
    {
        $student = $request->user()->student;
        abort_if($student === null, 404, 'No student record found.');

        $schoolYear = SchoolYear::active();
        abort_if($schoolYear === null, 404, 'No school year is currently active.');

        $bill = $student->bills()
            ->where('school_year_id', $schoolYear->id)
            ->with(['items', 'schoolYear', 'enrollment', 'adjustments', 'installments', 'payments.recorder', 'payments.submitter'])
            ->first();

        abort_if($bill === null, 404, 'You have no bill for the current school year yet.');

        return $bill;
    }
}
