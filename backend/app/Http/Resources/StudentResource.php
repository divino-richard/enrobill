<?php

namespace App\Http\Resources;

use App\Models\Student;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Student
 */
class StudentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'studentNumber' => $this->student_number,
            'status' => $this->status,
            'firstName' => $this->first_name,
            'middleName' => $this->middle_name,
            'lastName' => $this->last_name,
            'extension' => $this->extension,
            'dateOfBirth' => $this->date_of_birth?->format('Y-m-d'),
            'gender' => $this->gender,
            'nationality' => $this->nationality,
            'civilStatus' => $this->civil_status,
            'placeOfBirth' => $this->place_of_birth,
            'religion' => $this->religion,
            'email' => $this->email,
            'phoneNumber' => $this->phone_number,
            'addressProvince' => $this->address_province,
            'addressCity' => $this->address_city,
            'addressBarangay' => $this->address_barangay,
            'addressStreet' => $this->address_street,
            'trackOrStrand' => $this->track_or_strand,
            'yearLevel' => $this->year_level,
            'schoolYear' => $this->school_year,
            'applicationId' => $this->application_id,
            'createdAt' => $this->created_at?->toIso8601String(),
            'updatedAt' => $this->updated_at?->toIso8601String(),
        ];
    }
}
