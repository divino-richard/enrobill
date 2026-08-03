<?php

namespace App\Actions;

use App\Models\ProgramTransferRequest;
use Illuminate\Support\Facades\DB;

class ExecuteProgramTransfer
{
    public function __construct(private AssignSectionOnEnroll $assignSection) {}

    /**
     * Move the student to the approved request's target program: update the
     * enrollment and the student's mirror field, drop the now-stale section
     * (it belonged to the old program), then re-place them via the same
     * placement logic used on fresh enrollment.
     */
    public function __invoke(ProgramTransferRequest $request): void
    {
        DB::transaction(function () use ($request) {
            $enrollment = $request->enrollment;

            $enrollment->update([
                'track' => $request->to_program_code,
                'section_id' => null,
            ]);
            $request->student->update(['track_or_strand' => $request->to_program_code]);

            ($this->assignSection)($enrollment->fresh());
        });
    }
}
