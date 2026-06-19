<?php

use App\Http\Controllers\Admin\ApplicationController as AdminApplicationController;
use App\Http\Controllers\Admin\BillController as AdminBillController;
use App\Http\Controllers\Admin\FeeStructureController as AdminFeeStructureController;
use App\Http\Controllers\Admin\StudentController as AdminStudentController;
use App\Http\Controllers\Admin\TermController as AdminTermController;
use App\Http\Controllers\ApplicationController;
use App\Http\Controllers\ApplicationDocumentController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\EmailVerificationController;
use App\Http\Controllers\StudentProfileController;
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

    // The current user's own student record (once accepted).
    Route::get('/me/student', [StudentProfileController::class, 'show']);

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

    // Back-office endpoints — admins only.
    Route::middleware('role:admin')->group(function () {
        Route::get('/users', [UserController::class, 'index']);
        Route::get('/users/{user}', [UserController::class, 'show']);
        Route::put('/users/{user}', [UserController::class, 'update']);

        // All applications across every applicant.
        Route::get('/admin/applications', [AdminApplicationController::class, 'index']);
        Route::get('/admin/applications/{application}', [AdminApplicationController::class, 'show']);
        Route::post('/admin/applications/{application}/accept', [AdminApplicationController::class, 'accept']);
        Route::post('/admin/applications/{application}/reject', [AdminApplicationController::class, 'reject']);

        // Student records.
        Route::get('/admin/students', [AdminStudentController::class, 'index']);
        Route::get('/admin/students/{student}', [AdminStudentController::class, 'show']);
        Route::put('/admin/students/{student}', [AdminStudentController::class, 'update']);

        // A student's bill for the open term.
        Route::get('/admin/students/{student}/bill', [AdminBillController::class, 'showForStudent']);

        // Academic terms (enrollment periods).
        Route::get('/admin/terms', [AdminTermController::class, 'index']);
        Route::post('/admin/terms', [AdminTermController::class, 'store']);
        Route::put('/admin/terms/{term}', [AdminTermController::class, 'update']);
        Route::delete('/admin/terms/{term}', [AdminTermController::class, 'destroy']);

        // Fee structures (flat per-semester fees per program).
        Route::get('/admin/fee-structures', [AdminFeeStructureController::class, 'index']);
        Route::post('/admin/fee-structures', [AdminFeeStructureController::class, 'store']);
        Route::get('/admin/fee-structures/{feeStructure}', [AdminFeeStructureController::class, 'show']);
        Route::put('/admin/fee-structures/{feeStructure}', [AdminFeeStructureController::class, 'update']);
        Route::delete('/admin/fee-structures/{feeStructure}', [AdminFeeStructureController::class, 'destroy']);

        // Billing — bills for the open term.
        Route::get('/admin/bills', [AdminBillController::class, 'index']);
        Route::post('/admin/bills/generate', [AdminBillController::class, 'generate']);
    });
});
