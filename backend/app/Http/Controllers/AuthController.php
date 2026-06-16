<?php

namespace App\Http\Controllers;

use App\Enums\Role;
use App\Mail\VerifyEmailMail;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

use function Illuminate\Support\defer;

class AuthController extends Controller
{
    /**
     * Public registration for student aspirants (applicants). Creates an
     * applicant account and issues a token so they're signed in immediately.
     */
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'middle_name' => ['nullable', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
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
            'email.unique' => 'An account with this email already exists.',
        ]);

        $fullName = Str::squish(
            "{$data['first_name']} ".($data['middle_name'] ?? '')." {$data['last_name']}"
        );

        $user = User::create([
            'name' => $fullName,
            'first_name' => $data['first_name'],
            'middle_name' => $data['middle_name'] ?? null,
            'last_name' => $data['last_name'],
            'email' => $data['email'],
            'password' => $data['password'],
            'role' => Role::Applicant,
        ]);

        $token = $user->createToken('spa')->plainTextToken;

        // Signed, expiring link that verifies the applicant's email when opened.
        $verificationUrl = URL::temporarySignedRoute(
            'verification.verify',
            now()->addHours(48),
            [
                'id' => $user->getKey(),
                'hash' => sha1($user->getEmailForVerification()),
            ],
        );

        // Send the verification email after the response so registration never
        // waits on (or fails because of) the mail provider.
        defer(function () use ($user, $verificationUrl) {
            try {
                Mail::to($user->email, $user->name)
                    ->send(new VerifyEmailMail($user, $verificationUrl));
            } catch (\Throwable $e) {
                Log::warning('Verification email failed to send.', [
                    'email' => $user->email,
                    'error' => $e->getMessage(),
                ]);
            }
        });

        return response()->json([
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role->value,
            ],
        ], 201);
    }

    /**
     * Authenticate a user and issue a Sanctum API token.
     *
     * Single login for every role (admin, cashier, student, applicant); the
     * returned `user.role` tells the SPA which area to route the user into.
     */
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $credentials['email'])->first();

        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        $token = $user->createToken('spa')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role->value,
            ],
        ]);
    }

    /**
     * Revoke the token used for the current request.
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out.']);
    }
}
