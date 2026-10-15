<?php

namespace App\Http\Controllers;

use App\Http\Resources\PaymentChannelResource;
use App\Models\PaymentChannel;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PaymentChannelController extends Controller
{
    public function qr(PaymentChannel $paymentChannel): StreamedResponse
    {
        abort_unless($paymentChannel->is_active && $paymentChannel->qr_key, 404);
        $disk = Storage::disk('s3');
        abort_unless($disk->exists($paymentChannel->qr_key), 404);

        return $disk->download($paymentChannel->qr_key, basename($paymentChannel->qr_key), [
            'Cache-Control' => 'private, no-store',
        ]);
    }

    /**
     * Active payment channels students can pay against — those with a QR to scan
     * or account details to transfer to (so bank transfer shows without a QR).
     * Available to any authenticated user.
     */
    public function index(): AnonymousResourceCollection
    {
        return PaymentChannelResource::collection(
            PaymentChannel::query()
                ->where('is_active', true)
                ->where(function ($query) {
                    $query->whereNotNull('qr_key')
                        ->orWhereNotNull('account_number');
                })
                ->orderBy('id')
                ->get(),
        );
    }
}
