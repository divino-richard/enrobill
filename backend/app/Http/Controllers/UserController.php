<?php

namespace App\Http\Controllers;

use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class UserController extends Controller
{
    /**
     * Paginated list of users. Restricted to admins by route middleware.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $users = User::query()
            ->orderBy('name')
            ->paginate($request->integer('per_page', 15));

        return UserResource::collection($users);
    }

    /**
     * A single user. Restricted to admins by route middleware.
     */
    public function show(User $user): UserResource
    {
        return new UserResource($user);
    }
}
