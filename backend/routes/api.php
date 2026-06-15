<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\UserController;
use App\Http\Resources\UserResource;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| These routes are loaded with the "api" middleware group and are prefixed
| with "/api". This Laravel application is API-only: it exposes JSON
| endpoints that are consumed by the React (Vite) single-page application.
|
*/

// Simple health check — useful to confirm the API is reachable.
Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'service' => config('app.name'),
        'time' => now()->toIso8601String(),
    ]);
});

// Example public endpoint consumed by the SPA.
Route::get('/ping', function () {
    return response()->json([
        'message' => 'pong',
    ]);
});

// Public registration for student aspirants (applicants).
Route::post('/register', [AuthController::class, 'register']);

// Authentication — single login for all users; issues a Sanctum token.
Route::post('/login', [AuthController::class, 'login']);

// Routes that require a valid Sanctum token.
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);

    // The current authenticated user (any role may read their own record).
    Route::get('/me', fn (Request $request) => new UserResource($request->user()));

    // User management — admins only.
    Route::middleware('role:admin')->group(function () {
        Route::get('/users', [UserController::class, 'index']);
        Route::get('/users/{user}', [UserController::class, 'show']);
    });
});
