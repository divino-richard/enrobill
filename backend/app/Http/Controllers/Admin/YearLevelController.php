<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\YearLevelResource;
use App\Models\YearLevel;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class YearLevelController extends Controller
{
    /**
     * The year level catalog. Restricted to admins by route middleware.
     */
    public function index(): AnonymousResourceCollection
    {
        return YearLevelResource::collection(YearLevel::query()->ordered()->get());
    }

    /**
     * Add a year level. Its code is derived from the name and is immutable.
     */
    public function store(Request $request): YearLevelResource
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'isActive' => ['sometimes', 'boolean'],
        ]);

        $yearLevel = YearLevel::create([
            'code' => $this->uniqueCode($validated['name']),
            'name' => $validated['name'],
            'sort_order' => (int) YearLevel::max('sort_order') + 1,
            'is_active' => $validated['isActive'] ?? true,
        ]);

        return new YearLevelResource($yearLevel);
    }

    /**
     * Update a year level's name and active state. The code is fixed.
     */
    public function update(Request $request, YearLevel $yearLevel): YearLevelResource
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'isActive' => ['required', 'boolean'],
        ]);

        $yearLevel->update([
            'name' => $validated['name'],
            'is_active' => $validated['isActive'],
        ]);

        return new YearLevelResource($yearLevel->fresh());
    }

    /**
     * Delete a year level — only if nothing references its code.
     */
    public function destroy(YearLevel $yearLevel): Response
    {
        // Program assignments cascade on delete, so they don't block; only real
        // usage (records / fee data) does.
        $referenced = DB::table('students')->where('year_level', $yearLevel->code)->exists()
            || DB::table('applications')->where('year_level', $yearLevel->code)->exists()
            || DB::table('fee_structures')->where('year_level', $yearLevel->code)->exists()
            || DB::table('program_fee_items')->where('year_level', $yearLevel->code)->exists();

        if ($referenced) {
            throw ValidationException::withMessages([
                'yearLevel' => 'This year level is in use. Deactivate it instead.',
            ]);
        }

        $yearLevel->delete();

        return response()->noContent();
    }

    private function uniqueCode(string $name): string
    {
        $base = Str::slug($name, '_') ?: 'level';
        $code = $base;
        $suffix = 2;

        while (YearLevel::where('code', $code)->exists()) {
            $code = $base.'_'.$suffix++;
        }

        return $code;
    }
}
