<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\PaymentChannelResource;
use App\Models\Payment;
use App\Models\PaymentChannel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PaymentChannelController extends Controller
{
    /**
     * Accepted QR image MIME types mapped to their extension.
     */
    private const ALLOWED_TYPES = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
    ];

    private const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

    /**
     * All payment channels, visible to admins and cashiers.
     */
    public function index(): AnonymousResourceCollection
    {
        return PaymentChannelResource::collection(
            PaymentChannel::query()->orderBy('id')->get(),
        );
    }

    /**
     * Cashier-only: add a payment method students can pay to.
     *
     * The `code` is derived from the label rather than typed — it's an internal
     * key (used for QR object paths and channel-specific rendering), so it must
     * stay stable and slug-safe. A QR can't be attached here because presigning
     * needs a saved channel id; it's uploaded via update straight after.
     */
    public function store(Request $request): PaymentChannelResource
    {
        $validated = $request->validate([
            'label' => ['required', 'string', 'max:100'],
            'accountName' => ['nullable', 'string', 'max:150'],
            'accountNumber' => ['nullable', 'string', 'max:50'],
            'isActive' => ['required', 'boolean'],
        ]);

        $code = Str::slug($validated['label']);

        // A label of only punctuation/non-latin characters slugs to "", which
        // would collide with any other such label.
        if ($code === '') {
            throw ValidationException::withMessages([
                'label' => 'Use a name with letters or numbers.',
            ]);
        }

        if (PaymentChannel::query()->where('code', $code)->exists()) {
            throw ValidationException::withMessages([
                'label' => 'A payment method with that name already exists.',
            ]);
        }

        $paymentChannel = PaymentChannel::create([
            'code' => $code,
            'label' => $validated['label'],
            'account_name' => $validated['accountName'] ?? null,
            'account_number' => $validated['accountNumber'] ?? null,
            'is_active' => $validated['isActive'],
        ]);

        return new PaymentChannelResource($paymentChannel);
    }

    /**
     * Cashier-only: update account details, QR image and active state.
     *
     * Update a channel's account details, QR image and active state.
     */
    public function update(Request $request, PaymentChannel $paymentChannel): PaymentChannelResource
    {
        $validated = $request->validate([
            'accountName' => ['nullable', 'string', 'max:150'],
            'accountNumber' => ['nullable', 'string', 'max:50'],
            'qrKey' => ['nullable', 'string', 'max:255'],
            'isActive' => ['required', 'boolean'],
        ]);

        $previousKey = $paymentChannel->qr_key;

        $paymentChannel->update([
            'account_name' => $validated['accountName'] ?? null,
            'account_number' => $validated['accountNumber'] ?? null,
            // Only overwrite the QR when a new key is provided.
            'qr_key' => $validated['qrKey'] ?? $paymentChannel->qr_key,
            'is_active' => $validated['isActive'],
        ]);

        // Drop the superseded object so the bucket doesn't keep unreferenced QRs.
        $newKey = $paymentChannel->fresh()->qr_key;
        if ($previousKey !== null && $previousKey !== $newKey) {
            Storage::disk('s3')->delete($previousKey);
        }

        return new PaymentChannelResource($paymentChannel->fresh());
    }

    /**
     * Cashier-only: delete a payment method outright, along with its QR object.
     *
     * Blocked once payments have been recorded against it. Payments store the
     * method as a bare code rather than a foreign key, so removing the channel
     * would strip the label off historical receipts with nothing to restore it.
     * Deactivating hides the method from students without touching that history.
     */
    public function destroy(PaymentChannel $paymentChannel): Response
    {
        $payments = Payment::query()->where('method', $paymentChannel->code)->count();

        if ($payments > 0) {
            throw ValidationException::withMessages([
                'paymentChannel' => sprintf(
                    '%s has %d recorded %s and cannot be deleted. Hide it from students instead.',
                    $paymentChannel->label,
                    $payments,
                    $payments === 1 ? 'payment' : 'payments',
                ),
            ]);
        }

        if ($paymentChannel->qr_key !== null) {
            Storage::disk('s3')->delete($paymentChannel->qr_key);
        }

        $paymentChannel->delete();

        return response()->noContent();
    }

    /**
     * Cashier-only pre-signed S3 URL for uploading a channel QR to the bucket.
     */
    public function presign(Request $request, PaymentChannel $paymentChannel): JsonResponse
    {
        $validated = $request->validate([
            'contentType' => ['required', 'string', Rule::in(array_keys(self::ALLOWED_TYPES))],
            'size' => ['required', 'integer', 'min:1', 'max:'.self::MAX_BYTES],
        ]);

        $key = sprintf(
            'payment-channels/%s/%s.%s',
            $paymentChannel->code,
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
}
