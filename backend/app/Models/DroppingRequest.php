<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DroppingRequest extends Model
{
    protected $guarded = ['id'];

    public const OPEN = ['draft', 'submitted', 'needs_correction'];

    protected function casts(): array
    {
        return ['snapshot' => 'array', 'submissions' => 'array', 'events' => 'array', 'confirmed_at' => 'datetime', 'effective_date' => 'date'];
    }

    public function enrollment(): BelongsTo
    {
        return $this->belongsTo(Enrollment::class);
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function reference(): string
    {
        return 'DROP-'.str_pad((string) $this->id, 6, '0', STR_PAD_LEFT);
    }

    public function record(string $action, User $actor, ?string $remarks = null): void
    {
        $this->events = [...$this->events, ['action' => $action, 'actorId' => $actor->id, 'actorName' => $actor->name, 'actorRole' => $actor->role->value, 'at' => now()->toIso8601String(), 'remarks' => $remarks]];
        $this->save();
    }
}
