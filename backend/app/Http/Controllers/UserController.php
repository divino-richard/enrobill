<?php

namespace App\Http\Controllers;

use App\Enums\Role;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
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
