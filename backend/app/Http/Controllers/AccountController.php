<?php

namespace App\Http\Controllers;

use App\Http\Resources\UserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AccountController extends Controller
{
    /**
     * Update the authenticated user's own profile (name). Available to every
     * role — staff and portal users alike.
     */
    public function updateProfile(Request $request): UserResource
    {
        $data = $request->validate([
            'firstName' => ['required', 'string', 'max:100'],
            'middleName' => ['nullable', 'string', 'max:100'],
            'lastName' => ['required', 'string', 'max:100'],
        ]);

        $user = $request->user();

        $fullName = Str::squish(
            "{$data['firstName']} ".($data['middleName'] ?? '')." {$data['lastName']}"
        );

        $user->update([
            'first_name' => $data['firstName'],
            'middle_name' => $data['middleName'] ?? null,
            'last_name' => $data['lastName'],
            'name' => $fullName,
        ]);

        return new UserResource($user->fresh());
    }

    /**
     * Change the authenticated user's own password after confirming the current
     * one.
     */
    public function updatePassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'currentPassword' => ['required', 'string'],
            'password' => [
                'required',
                'confirmed',
                'string',
                'min:8',
                'regex:/[A-Z]/',
                'regex:/\d/',
            ],
        ], [
            'password.min' => 'Password must be at least 8 characters.',
            'password.regex' => 'Password must include an uppercase letter and a number.',
            'password.confirmed' => 'Password and confirmation do not match.',
        ]);

        $user = $request->user();

        if (! Hash::check($data['currentPassword'], $user->password)) {
            throw ValidationException::withMessages([
                'currentPassword' => 'Your current password is incorrect.',
            ]);
        }

        $user->update(['password' => $data['password']]);

        return response()->json(['message' => 'Your password has been updated.']);
    }
}
