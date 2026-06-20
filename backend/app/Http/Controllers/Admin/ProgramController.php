<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProgramResource;
use App\Models\Program;
use App\Models\YearLevel;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ProgramController extends Controller
{
    /**
     * The full program catalog with default fee items. Restricted to admins by
     * route middleware.
     */
    public function index(): AnonymousResourceCollection
    {
        return ProgramResource::collection(
            Program::query()->ordered()->with(['feeItems', 'yearLevels'])->get(),
        );
    }

    /**
     * Add a program. The code is derived from the name and is immutable, since
     * applications/students/fee structures reference it.
     */
    public function store(Request $request): ProgramResource
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'category' => ['required', 'string', 'max:100'],
            'isActive' => ['sometimes', 'boolean'],
            'yearLevelCodes' => ['present', 'array'],
            'yearLevelCodes.*' => ['string', 'exists:year_levels,code'],
        ]);

        $code = $this->uniqueCode($validated['name']);

        $program = Program::create([
            'code' => $code,
            'name' => $validated['name'],
            'category' => $validated['category'],
            'sort_order' => (int) Program::max('sort_order') + 1,
            'is_active' => $validated['isActive'] ?? true,
        ]);

        $program->yearLevels()->sync($this->levelIds($validated['yearLevelCodes']));

        return new ProgramResource($program->load(['feeItems', 'yearLevels']));
    }

    /**
     * Update a program's name, category, active state and offered year levels.
     * The code is fixed.
     */
    public function update(Request $request, Program $program): ProgramResource
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'category' => ['required', 'string', 'max:100'],
            'isActive' => ['required', 'boolean'],
            'yearLevelCodes' => ['present', 'array'],
            'yearLevelCodes.*' => ['string', 'exists:year_levels,code'],
        ]);

        $program->update([
            'name' => $validated['name'],
            'category' => $validated['category'],
            'is_active' => $validated['isActive'],
        ]);

        $program->yearLevels()->sync($this->levelIds($validated['yearLevelCodes']));

        return new ProgramResource($program->fresh()->load(['feeItems', 'yearLevels']));
    }

    /**
     * Map year level codes to ids for syncing the pivot.
     *
     * @param  array<int, string>  $codes
     * @return array<int, int>
     */
    private function levelIds(array $codes): array
    {
        return YearLevel::whereIn('code', $codes)->pluck('id')->all();
    }

    /**
     * Replace a program's default fee items.
     */
    public function updateFeeItems(Request $request, Program $program): ProgramResource
    {
        $validated = $request->validate([
            'items' => ['present', 'array'],
            'items.*.name' => ['required', 'string', 'max:100'],
            'items.*.amounts' => ['array'],
            'items.*.amounts.*' => ['nullable', 'numeric', 'min:0', 'max:99999999.99'],
        ]);

        // Only amounts for year levels this program actually offers are stored.
        $validCodes = collect($program->yearLevels()->pluck('code'))->flip();

        DB::transaction(function () use ($program, $validated, $validCodes) {
            $program->feeItems()->delete();

            $rows = [];
            foreach ($validated['items'] as $item) {
                foreach (($item['amounts'] ?? []) as $code => $amount) {
                    if ($amount !== null && $validCodes->has($code)) {
                        $rows[] = [
                            'name' => $item['name'],
                            'year_level' => $code,
                            'amount' => $amount,
                        ];
                    }
                }
            }

            if ($rows !== []) {
                $program->feeItems()->createMany($rows);
            }
        });

        return new ProgramResource($program->fresh()->load(['feeItems', 'yearLevels']));
    }

    /**
     * Delete a program — only if nothing references its code.
     */
    public function destroy(Program $program): Response
    {
        $referenced = DB::table('students')->where('track_or_strand', $program->code)->exists()
            || DB::table('applications')->where('track_or_strand', $program->code)->exists()
            || DB::table('fee_structures')->where('track', $program->code)->exists();

        if ($referenced) {
            throw ValidationException::withMessages([
                'program' => 'This program is in use by students, applications or fee structures. Deactivate it instead.',
            ]);
        }

        $program->delete();

        return response()->noContent();
    }

    /**
     * Build a unique slug-style code from the program name.
     */
    private function uniqueCode(string $name): string
    {
        $base = Str::slug($name, '_') ?: 'program';
        $code = $base;
        $suffix = 2;

        while (Program::where('code', $code)->exists()) {
            $code = $base.'_'.$suffix++;
        }

        return $code;
    }
}
