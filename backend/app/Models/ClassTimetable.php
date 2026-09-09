<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['section_id', 'entries', 'published_entries', 'version', 'published_at', 'updated_by', 'published_by'])]
class ClassTimetable extends Model
{
    protected function casts(): array
    {
        return ['entries' => 'array', 'published_entries' => 'array', 'version' => 'integer', 'published_at' => 'datetime'];
    }

    public function section(): BelongsTo
    {
        return $this->belongsTo(Section::class);
    }
}
