<?php

namespace App\Http\Resources;

use App\Models\PaymentChannel;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/**
 * @mixin PaymentChannel
 */
class PaymentChannelResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'label' => $this->label,
            'accountName' => $this->account_name,
            'accountNumber' => $this->account_number,
            'isActive' => $this->is_active,
            'hasQr' => $this->qr_key !== null,
            'qrUrl' => $this->qr_key
                ? Storage::disk('s3')->temporaryUrl($this->qr_key, now()->addMinutes(30))
                : null,
        ];
    }
}
