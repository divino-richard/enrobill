<?php

namespace App\Http\Resources;

use App\Models\ProgramTransferRequest;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin ProgramTransferRequest
 */
class ProgramTransferRequestResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            // Same "PREFIX-000123" shape as the bill receipt number — derived
            // from the id, not stored.
            'controlNumber' => 'TR-'.str_pad((string) $this->id, 6, '0', STR_PAD_LEFT),
            'studentId' => $this->student_id,
            'studentName' => trim($this->student->first_name.' '.$this->student->last_name),
            'studentNumber' => $this->student->student_number,
            'fromProgramCode' => $this->from_program_code,
            'toProgramCode' => $this->to_program_code,
            'schoolYear' => $this->school_year,
            'reason' => $this->reason,
            'status' => $this->status,
            'requestedAt' => $this->created_at?->toIso8601String(),
            'decidedAt' => $this->decided_at?->toIso8601String(),
            'decisionNote' => $this->decision_note,
            'decidedByName' => $this->decidedBy?->name,
        ];
    }
}
