<?php

namespace App\Http\Resources;

use App\Models\StudentNotification;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin StudentNotification
 */
class StudentNotificationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'category' => $this->category,
            'title' => $this->title,
            'message' => $this->message,
            'ctaLabel' => $this->cta_label,
            'ctaUrl' => $this->cta_url,
            'actionRequired' => $this->action_required && ! $this->isObsoleteDroppingReminder(),
            'historical' => $this->isObsoleteDroppingReminder(),
            'unread' => $this->read_at === null,
            'createdAt' => $this->created_at?->toIso8601String(),
        ];
    }
}
