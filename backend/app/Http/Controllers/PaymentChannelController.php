<?php

namespace App\Http\Controllers;

use App\Http\Resources\PaymentChannelResource;
use App\Models\PaymentChannel;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PaymentChannelController extends Controller
{
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
