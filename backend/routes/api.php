<?php

use App\Http\Controllers\ApplicationController;
use App\Http\Controllers\ApplicationDocumentController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\EmailVerificationController;
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

// Email verification — opened from the signed link in the verification email.
Route::get('/email/verify/{id}/{hash}', [EmailVerificationController::class, 'verify'])
    ->middleware('signed')
    ->name('verification.verify');

// Resend the verification email (rate-limited).
Route::post('/email/resend', [EmailVerificationController::class, 'resend'])
    ->middleware('throttle:6,1')
    ->name('verification.resend');

// Authentication — single login for all users; issues a Sanctum token.
Route::post('/login', [AuthController::class, 'login']);

// Routes that require a valid Sanctum token.
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);

    // The current authenticated user (any role may read their own record).
    Route::get('/me', fn (Request $request) => new UserResource($request->user()));

    // Application document uploads — issue a pre-signed S3 URL so the browser
    // uploads verification documents directly to the bucket.
    Route::post('/applications/documents/presign', [ApplicationDocumentController::class, 'presign']);

    // Short-lived URL to view a previously uploaded document.
    Route::get('/applications/{application}/documents/{document}', [ApplicationDocumentController::class, 'viewUrl']);

    // Enrollment applications for the authenticated applicant.
    Route::get('/applications', [ApplicationController::class, 'index']);
    Route::post('/applications', [ApplicationController::class, 'store']);
    Route::get('/applications/{application}', [ApplicationController::class, 'show']);
    Route::put('/applications/{application}', [ApplicationController::class, 'update']);

    // User management — admins only.
    Route::middleware('role:admin')->group(function () {
        Route::get('/users', [UserController::class, 'index']);
        Route::get('/users/{user}', [UserController::class, 'show']);
    });
});
