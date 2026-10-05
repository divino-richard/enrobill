<?php

namespace App\Http\Controllers\Admin;

use App\Actions\ExecuteProgramTransfer;
use App\Actions\NotifyStudent;
use App\Http\Controllers\Controller;
use App\Http\Resources\ProgramTransferRequestResource;
use App\Models\Program;
use App\Models\ProgramTransferRequest;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ProgramTransferRequestController extends Controller
{
    public function __construct(private ExecuteProgramTransfer $executeTransfer, private NotifyStudent $notify) {}

    /**
     * Every transfer request, newest first.
     */
    public function index(): AnonymousResourceCollection
    {
        return ProgramTransferRequestResource::collection(
            ProgramTransferRequest::query()
                ->with(['student', 'decidedBy'])
                ->latest()
                ->get(),
        );
    }

    /**
     * Accept or reject a pending request. Accepting actually moves the
     * student to the target program — see ExecuteProgramTransfer.
     */
    public function decide(Request $request, ProgramTransferRequest $transferRequest): ProgramTransferRequestResource
    {
        abort_if(
            $transferRequest->status !== 'pending',
            422,
            'This request has already been decided.',
        );

        $validated = $request->validate([
            'status' => ['required', Rule::in(['approved', 'rejected'])],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        DB::transaction(function () use ($transferRequest, $validated, $request) {
            $transferRequest->update([
                'status' => $validated['status'],
                'decision_note' => $validated['note'] ?? null,
                'decided_by' => $request->user()->id,
                'decided_at' => now(),
            ]);

            if ($validated['status'] === 'approved') {
                ($this->executeTransfer)($transferRequest);
            }

        });

        if ($transferRequest->student !== null) {
            $approved = $validated['status'] === 'approved';
            $programName = Program::where('code', $transferRequest->to_program_code)->value('name')
                ?? $transferRequest->to_program_code;

            ($this->notify)(
                $transferRequest->student,
                'transfer',
                $approved ? 'Transfer approved' : 'Transfer rejected',
                $approved
                    ? "Your transfer to {$programName} was approved and is now in effect."
                    : 'Your transfer request was not approved.'.(
                        $validated['note'] ?? null ? " Reason: {$validated['note']}" : ''
                    ),
                ctaLabel: 'View transfer status',
                ctaUrl: '/portal/programs',
            );
        }

        return new ProgramTransferRequestResource(
            $transferRequest->fresh(['student', 'decidedBy']),
        );
    }
}
