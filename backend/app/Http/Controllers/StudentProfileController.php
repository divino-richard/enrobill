<?php

namespace App\Http\Controllers;

use App\Actions\YearEndCloseout;
use App\Http\Resources\StudentResource;
use App\Models\SchoolYear;
use Illuminate\Http\Request;

class StudentProfileController extends Controller
{
    /**
     * The authenticated user's own student record. 404 if they aren't a student
     * yet (e.g. still an applicant).
     */
    public function show(Request $request, YearEndCloseout $closeout): StudentResource
    {
        $student = $request->user()->student;

        abort_if($student === null, 404, 'No student record found.');

        $decision = $student->progressionDecisions()->with('fromSchoolYear')->get()
            ->sortByDesc(fn ($decision) => $decision->fromSchoolYear?->school_year ?? '')
            ->first();
        $awaitingEnrollment = $decision?->needsMaterialization()
            && $student->enrollments()->where('school_year_id', $decision->from_school_year_id)
                ->where('status', 'enrolled')->exists();

        return (new StudentResource($student))->additional(['meta' => [
            'activeSchoolYear' => SchoolYear::active()?->school_year,
            'pendingProgression' => $awaitingEnrollment ? [
                'decision' => $decision->decision,
                'schoolYear' => $closeout->nextYear($decision->fromSchoolYear)?->school_year,
            ] : null,
        ]]);
    }
}
