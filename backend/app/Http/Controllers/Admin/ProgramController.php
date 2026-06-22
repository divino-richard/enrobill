<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProgramResource;
use App\Models\Program;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ProgramController extends Controller
{
    /** The senior-high tracks a program can belong to. */
    public const CATEGORIES = ['Academic Track', 'TVL Track'];

    private const SORTABLE = [
        'name' => 'name',
        'category' => 'category',
        'createdAt' => 'created_at',
    ];

    /**
     * The program catalog — paginated, searchable, sortable, and filterable by
     * track + active state. Restricted to admins by route middleware.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $direction = $request->string('dir')->lower()->value() === 'desc' ? 'desc' : 'asc';
        $perPage = min(max($request->integer('per_page', 15), 1), 100);
        $sortKey = $request->string('sort')->value();

        $query = Program::query()
            ->when(
                in_array($request->string('category')->value(), self::CATEGORIES, true),
                fn ($query) => $query->where('category', $request->string('category')->value()),
            )
            ->when($request->string('active')->value() === 'active', fn ($query) => $query->where('is_active', true))
            ->when($request->string('active')->value() === 'inactive', fn ($query) => $query->where('is_active', false))
            ->when(
                $request->filled('search'),
                fn ($query) => $query->where('name', 'like', '%'.$request->string('search')->value().'%'),
            );

        if (isset(self::SORTABLE[$sortKey])) {
            $query->orderBy(self::SORTABLE[$sortKey], $direction)->orderBy('id', $direction);
        } else {
            $query->ordered();
        }

        return ProgramResource::collection($query->paginate($perPage)->withQueryString());
    }

    /**
     * Add a program. The code is derived from the name and is immutable, since
     * applications and students reference it.
     */
    public function store(Request $request): ProgramResource
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'category' => ['required', Rule::in(self::CATEGORIES)],
            'isActive' => ['sometimes', 'boolean'],
        ]);

        $program = Program::create([
            'code' => $this->uniqueCode($validated['name']),
            'name' => $validated['name'],
            'category' => $validated['category'],
            'sort_order' => (int) Program::max('sort_order') + 1,
            'is_active' => $validated['isActive'] ?? true,
        ]);

        return new ProgramResource($program);
    }

    /**
     * Update a program's name, category and active state. The code is fixed.
     */
    public function update(Request $request, Program $program): ProgramResource
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'category' => ['required', Rule::in(self::CATEGORIES)],
            'isActive' => ['required', 'boolean'],
        ]);

        $program->update([
            'name' => $validated['name'],
            'category' => $validated['category'],
            'is_active' => $validated['isActive'],
        ]);

        return new ProgramResource($program->fresh());
    }

    /**
     * Delete a program — only if nothing references its code.
     */
    public function destroy(Program $program): Response
    {
        $referenced = DB::table('students')->where('track_or_strand', $program->code)->exists()
            || DB::table('applications')->where('track_or_strand', $program->code)->exists();

        if ($referenced) {
            throw ValidationException::withMessages([
                'program' => 'This program is in use by students or applications. Deactivate it instead.',
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
