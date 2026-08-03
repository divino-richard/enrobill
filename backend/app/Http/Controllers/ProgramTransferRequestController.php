<?php

namespace App\Http\Controllers;

use App\Http\Resources\ProgramTransferRequestResource;
use App\Models\ProgramTransferRequest;
use App\Models\Student;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class ProgramTransferRequestController extends Controller
{
    /**
     * The authenticated student's own transfer requests, newest first.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $student = $this->ownStudentOrAbort($request);

        return ProgramTransferRequestResource::collection(
            $student->transferRequests()->with(['student', 'decidedBy'])->latest()->get(),
        );
    }

    /**
     * Request a transfer to a different program. Only one pending request is
     * allowed at a time — the student sees its decision before asking again.
     */
    public function store(Request $request): ProgramTransferRequestResource
    {
        $student = $this->ownStudentOrAbort($request);

        $enrollment = $student->enrollments()
            ->where('status', 'enrolled')
            ->whereHas('schoolYear', fn ($q) => $q->where('is_active', true))
            ->with('schoolYear')
            ->first();

        abort_if(
            $enrollment === null,
            422,
            'You need an active enrollment to request a transfer.',
        );

        $alreadyPending = $student->transferRequests()
            ->where('status', 'pending')
            ->exists();

        abort_if(
            $alreadyPending,
            422,
            'You already have a pending transfer request — wait for a decision before submitting another.',
        );

        $validated = $request->validate([
            'toProgramCode' => [
                'required',
                'string',
                'exists:programs,code',
                Rule::notIn([$enrollment->track]),
            ],
            'reason' => ['required', 'string', 'max:1000'],
        ], [
            'toProgramCode.not_in' => 'Choose a program different from the one you\'re currently in.',
        ]);

        $transferRequest = ProgramTransferRequest::create([
            'student_id' => $student->id,
            'enrollment_id' => $enrollment->id,
            'from_program_code' => $enrollment->track,
            'to_program_code' => $validated['toProgramCode'],
            'school_year' => $enrollment->schoolYear->school_year,
            'reason' => $validated['reason'],
            'status' => 'pending',
        ]);

        return new ProgramTransferRequestResource($transferRequest);
    }

    private function ownStudentOrAbort(Request $request): Student
    {
        $student = $request->user()->student;

        abort_if($student === null, 404, 'No student record found.');

        return $student;
    }
}
