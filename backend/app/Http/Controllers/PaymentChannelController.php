<?php

namespace App\Http\Controllers;

use App\Http\Resources\PaymentChannelResource;
use App\Models\PaymentChannel;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PaymentChannelController extends Controller
{
    /**
     * Active payment channels with a QR set, for students to pay against.
     * Available to any authenticated user.
     */
    public function index(): AnonymousResourceCollection
    {
        return PaymentChannelResource::collection(
            PaymentChannel::query()
                ->where('is_active', true)
                ->whereNotNull('qr_key')
                ->orderBy('id')
                ->get(),
        );
    }
}
