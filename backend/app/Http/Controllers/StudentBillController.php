<?php

namespace App\Http\Controllers;

use App\Actions\GenerateInstallmentSchedule;
use App\Http\Resources\BillResource;
use App\Models\Bill;
use App\Models\Term;
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
     * The authenticated student's bill for the open term, with payments.
     */
    public function show(Request $request): BillResource
    {
        return new BillResource($this->resolveBill($request));
    }

    /**
     * All of the authenticated student's bills across every term, newest first —
     * the current bill plus history.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $student = $request->user()->student;
        abort_if($student === null, 404, 'No student record found.');

        $bills = $student->bills()
            ->with(['term', 'items', 'adjustments', 'installments', 'payments.recorder', 'payments.submitter'])
            ->latest()
            ->get();

        return BillResource::collection($bills);
    }

    /**
     * Choose how to pay: full payment or installments. Installment generates the
     * schedule from the term policy; full clears it. Locked once any payment
     * exists.
     */
    public function choosePlan(Request $request, GenerateInstallmentSchedule $generate): BillResource
    {
        $bill = $this->resolveBill($request);

        $validated = $request->validate([
            'option' => ['required', Rule::in(['full', 'installment'])],
        ]);

        $locked = $bill->payments()->whereIn('status', ['pending', 'verified'])->exists();
        if ($locked) {
            throw ValidationException::withMessages([
                'option' => 'Your payment plan can no longer be changed because a payment has already been made or is under review.',
            ]);
        }

        if ($validated['option'] === 'installment') {
            $generate($bill); // throws if the term doesn't offer installments
        } else {
            $bill->installments()->delete();
        }

        $bill->update(['payment_option' => $validated['option']]);

        return new BillResource(
            $bill->fresh()->load(['term', 'items', 'adjustments', 'installments', 'payments.recorder', 'payments.submitter']),
        );
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
     * payment is pending and doesn't reduce the balance until an admin verifies.
     */
    public function storePayment(Request $request): BillResource
    {
        $bill = $this->resolveBill($request);

        $validated = $request->validate([
            'method' => ['required', Rule::in(self::SUBMIT_METHODS)],
            'reference' => ['nullable', 'string', 'max:100'],
            'proofKey' => ['required', 'string', 'max:255'],
            'paidAt' => ['required', 'date'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        // The amount is set by the system (next installment, else balance) — the
        // student can't choose it.
        $amount = $bill->amountDue();

        if ($amount <= 0) {
            throw ValidationException::withMessages([
                'amount' => 'This bill has no outstanding amount due.',
            ]);
        }

        $bill->payments()->create([
            'amount' => $amount,
            'method' => $validated['method'],
            'status' => 'pending',
            'reference' => $validated['reference'] ?? null,
            'proof_key' => $validated['proofKey'],
            'paid_at' => $validated['paidAt'],
            'note' => $validated['note'] ?? null,
            'submitted_by' => $request->user()->id,
        ]);

        return new BillResource(
            $bill->fresh()->load(['term', 'items', 'adjustments', 'installments', 'payments.recorder', 'payments.submitter']),
        );
    }

    /**
     * The authenticated user's bill for the open term, or 404.
     */
    private function resolveBill(Request $request): Bill
    {
        $student = $request->user()->student;
        abort_if($student === null, 404, 'No student record found.');

        $term = Term::open();
        abort_if($term === null, 404, 'No term is currently open.');

        $bill = $student->bills()
            ->where('term_id', $term->id)
            ->with(['items', 'term', 'adjustments', 'installments', 'payments.recorder', 'payments.submitter'])
            ->first();

        abort_if($bill === null, 404, 'You have no bill for the current term yet.');

        return $bill;
    }
}
