<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProgramResource;
use App\Models\FeeStructure;
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
     * The program catalog with default fee items — paginated, searchable,
     * sortable, and filterable by track + active state. Restricted to admins by
     * route middleware.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $direction = $request->string('dir')->lower()->value() === 'desc' ? 'desc' : 'asc';
        $perPage = min(max($request->integer('per_page', 15), 1), 100);
        $sortKey = $request->string('sort')->value();

        $query = Program::query()
            ->with('feeItems')
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
     * applications/students/fee structures reference it.
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

        return new ProgramResource($program->load('feeItems'));
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

        return new ProgramResource($program->fresh()->load('feeItems'));
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

        // Only amounts for the fixed SHS year levels are stored.
        $validCodes = collect(FeeStructure::YEAR_LEVELS)->flip();

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

        return new ProgramResource($program->fresh()->load('feeItems'));
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
