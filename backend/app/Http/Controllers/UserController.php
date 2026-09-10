<?php

namespace App\Http\Controllers;

use App\Enums\Role;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    /**
     * Sortable columns, mapped from API key to database column (allow-list).
     */
    private const SORTABLE = [
        'name' => 'name',
        'email' => 'email',
        'role' => 'role',
        'createdAt' => 'created_at',
    ];

    /**
     * Paginated, searchable, filterable, sortable list of users. Restricted to
     * admins by route middleware.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $sort = self::SORTABLE[$request->string('sort')->value()] ?? 'name';
        $direction = $request->string('dir')->lower()->value() === 'desc' ? 'desc' : 'asc';
        $perPage = min(max($request->integer('per_page', 15), 1), 100);
        $roles = array_map(fn (Role $role) => $role->value, Role::cases());

        $users = User::query()
            ->when(
                in_array($request->string('role')->value(), $roles, true),
                fn ($query) => $query->where('role', $request->string('role')->value()),
            )
            ->when($request->filled('search'), function ($query) use ($request) {
                $term = '%'.$request->string('search')->value().'%';
                $query->where(function ($sub) use ($term) {
                    $sub->where('name', 'like', $term)
                        ->orWhere('email', 'like', $term);
                });
            })
            ->orderBy($sort, $direction)
            ->orderBy('id', $direction)
            ->paginate($perPage)
            ->withQueryString();

        return UserResource::collection($users);
    }

    /**
     * A single user. Restricted to admins by route middleware.
     */
    public function show(User $user): UserResource
    {
        return new UserResource($user);
    }

    /**
     * Create a verified staff account. Student and applicant accounts continue
     * to use their dedicated enrollment and registration flows.
     */
    public function store(Request $request): UserResource
    {
        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'middle_name' => ['nullable', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'role' => [
                'required',
                Rule::in([Role::Admin->value, Role::Cashier->value, Role::Teacher->value]),
            ],
            'password' => [
                'required',
                'confirmed',
                'string',
                'min:8',
                'regex:/[A-Z]/',
                'regex:/\d/',
            ],
        ]);

        $user = User::create([
            'name' => Str::squish(
                "{$validated['first_name']} ".($validated['middle_name'] ?? '')." {$validated['last_name']}"
            ),
            'first_name' => $validated['first_name'],
            'middle_name' => $validated['middle_name'] ?? null,
            'last_name' => $validated['last_name'],
            'email' => $validated['email'],
            'password' => $validated['password'],
            'role' => $validated['role'],
            'email_verified_at' => now(),
        ]);

        return new UserResource($user);
    }

    /**
     * Update a user's role. Restricted to admins by route middleware.
     */
    public function update(Request $request, User $user): UserResource
    {
        // Guard against an admin locking themselves out of the back office.
        abort_if(
            $user->id === $request->user()->id,
            422,
            "You can't change your own role.",
        );

        $validated = $request->validate([
            'role' => ['required', Rule::enum(Role::class)],
        ]);

        $user->update(['role' => $validated['role']]);

        return new UserResource($user->fresh());
    }
}
