<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\StudentNotification
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
            'actionRequired' => $this->action_required,
            'unread' => $this->read_at === null,
            'createdAt' => $this->created_at?->toIso8601String(),
        ];
    }
}
