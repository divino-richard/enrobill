<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\PaymentChannelResource;
use App\Models\PaymentChannel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

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

        $paymentChannel->update([
            'account_name' => $validated['accountName'] ?? null,
            'account_number' => $validated['accountNumber'] ?? null,
            // Only overwrite the QR when a new key is provided.
            'qr_key' => $validated['qrKey'] ?? $paymentChannel->qr_key,
            'is_active' => $validated['isActive'],
        ]);

        return new PaymentChannelResource($paymentChannel->fresh());
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
