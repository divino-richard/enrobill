<?php

use App\Http\Controllers\AccountController;
use App\Http\Controllers\Admin\ApplicationController as AdminApplicationController;
use App\Http\Controllers\Admin\BillAdjustmentController as AdminBillAdjustmentController;
use App\Http\Controllers\Admin\BillController as AdminBillController;
use App\Http\Controllers\Admin\DashboardController as AdminDashboardController;
use App\Http\Controllers\Admin\DiscountController as AdminDiscountController;
use App\Http\Controllers\Admin\EnrollmentController as AdminEnrollmentController;
use App\Http\Controllers\Admin\FeeController as AdminFeeController;
use App\Http\Controllers\Admin\PaymentChannelController as AdminPaymentChannelController;
use App\Http\Controllers\Admin\PaymentController as AdminPaymentController;
use App\Http\Controllers\Admin\ProgramController as AdminProgramController;
use App\Http\Controllers\Admin\ProgressionController as AdminProgressionController;
use App\Http\Controllers\Admin\SchoolYearController as AdminSchoolYearController;
use App\Http\Controllers\Admin\StudentController as AdminStudentController;
use App\Http\Controllers\ApplicationController;
use App\Http\Controllers\ApplicationDocumentController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\EmailVerificationController;
use App\Http\Controllers\PaymentChannelController;
use App\Http\Controllers\ProgramController;
use App\Http\Controllers\SchoolYearController;
use App\Http\Controllers\StudentBillController;
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

    // Self-service account management — available to every role.
    Route::put('/me/profile', [AccountController::class, 'updateProfile']);
    Route::put('/me/password', [AccountController::class, 'updatePassword']);

    // The current user's own student record (once accepted).
    Route::get('/me/student', [StudentProfileController::class, 'show']);

    // The current student's bill for the open term + self-service payment.
    Route::get('/me/bill', [StudentBillController::class, 'show']);
    // All of the student's bills (current + history).
    Route::get('/me/bills', [StudentBillController::class, 'index']);
    // The student's per-term enrollment (program/level/semester) + history.
    Route::get('/me/enrollments', [StudentBillController::class, 'enrollments']);
    Route::post('/me/bill/payments/presign', [StudentBillController::class, 'presign']);
    Route::post('/me/bill/payments', [StudentBillController::class, 'storePayment']);

    // Active payment channels (QR codes) students can pay to.
    Route::get('/payment-channels', [PaymentChannelController::class, 'index']);

    // Active programs, for selection in the application form and other pickers.
    Route::get('/programs', [ProgramController::class, 'index']);

    // The school year currently admitting (or null) — gates applications.
    Route::get('/open-term', [SchoolYearController::class, 'open']);

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
        Route::post('/admin/students', [AdminStudentController::class, 'store']);
        Route::get('/admin/students/{student}', [AdminStudentController::class, 'show']);
        Route::put('/admin/students/{student}', [AdminStudentController::class, 'update']);

        // A student's bill for the open term.
        Route::get('/admin/students/{student}/bill', [AdminBillController::class, 'showForStudent']);

        // A student's per-term enrollments + status management.
        Route::get('/admin/students/{student}/enrollments', [AdminEnrollmentController::class, 'index']);
        Route::put('/admin/enrollments/{enrollment}', [AdminEnrollmentController::class, 'update']);

        // Year-end progression decisions (read endpoint is shared below).
        Route::post('/admin/progression', [AdminProgressionController::class, 'store']);
        Route::post('/admin/progression/retain', [AdminProgressionController::class, 'retain']);
        Route::post('/admin/progression/revert', [AdminProgressionController::class, 'revert']);
        Route::post('/admin/progression/graduate', [AdminProgressionController::class, 'graduate']);

        // School years — managing periods (read endpoint is shared below).
        Route::post('/admin/school-years', [AdminSchoolYearController::class, 'store']);
        Route::put('/admin/school-years/{schoolYear}', [AdminSchoolYearController::class, 'update']);
        Route::put('/admin/school-years/{schoolYear}/installment-policy', [AdminSchoolYearController::class, 'updatePolicy']);
        Route::delete('/admin/school-years/{schoolYear}', [AdminSchoolYearController::class, 'destroy']);

        // Programs (tracks/strands).
        Route::get('/admin/programs', [AdminProgramController::class, 'index']);
        Route::post('/admin/programs', [AdminProgramController::class, 'store']);
        Route::put('/admin/programs/{program}', [AdminProgramController::class, 'update']);
        Route::delete('/admin/programs/{program}', [AdminProgramController::class, 'destroy']);
    });

    // Accounting endpoints — available to admins and cashiers.
    Route::middleware('role:admin,cashier')->group(function () {
        // Staff dashboard stats (finance for all staff; enrollment for admins).
        Route::get('/admin/dashboard', [AdminDashboardController::class, 'index']);

        // Read-only supporting data the finance screens depend on.
        Route::get('/admin/school-years', [AdminSchoolYearController::class, 'index']);
        Route::get('/admin/progression', [AdminProgressionController::class, 'index']);

        // Global per-school-year fee schedule (by year level).
        Route::get('/admin/fees', [AdminFeeController::class, 'index']);
        Route::post('/admin/fees', [AdminFeeController::class, 'store']);
        Route::post('/admin/fees/copy', [AdminFeeController::class, 'copy']);
        Route::put('/admin/fees/{fee}', [AdminFeeController::class, 'update']);
        Route::delete('/admin/fees/{fee}', [AdminFeeController::class, 'destroy']);

        // Discount catalog (reusable discounts, scholarships, vouchers).
        Route::get('/admin/discounts', [AdminDiscountController::class, 'index']);
        Route::post('/admin/discounts', [AdminDiscountController::class, 'store']);
        Route::put('/admin/discounts/{discount}', [AdminDiscountController::class, 'update']);
        Route::delete('/admin/discounts/{discount}', [AdminDiscountController::class, 'destroy']);

        // Billing — bills for the open term.
        Route::get('/admin/bills', [AdminBillController::class, 'index']);
        Route::post('/admin/bills/generate', [AdminBillController::class, 'generate']);
        Route::get('/admin/bills/{bill}', [AdminBillController::class, 'show']);

        // Apply or remove a catalog discount on a bill.
        Route::post('/admin/bills/{bill}/adjustments', [AdminBillAdjustmentController::class, 'store']);
        Route::delete('/admin/bills/{bill}/adjustments/{adjustment}', [AdminBillAdjustmentController::class, 'destroy']);

        // Record, verify, reject or void payments against a bill.
        Route::post('/admin/bills/{bill}/payments', [AdminPaymentController::class, 'store']);
        Route::post('/admin/bills/{bill}/payments/{payment}/verify', [AdminPaymentController::class, 'verify']);
        Route::post('/admin/bills/{bill}/payments/{payment}/reject', [AdminPaymentController::class, 'reject']);
        Route::delete('/admin/bills/{bill}/payments/{payment}', [AdminPaymentController::class, 'destroy']);

        // Payment channels (GCash / Maya QR codes).
        Route::get('/admin/payment-channels', [AdminPaymentChannelController::class, 'index']);
        Route::put('/admin/payment-channels/{paymentChannel}', [AdminPaymentChannelController::class, 'update']);
        Route::post('/admin/payment-channels/{paymentChannel}/presign', [AdminPaymentChannelController::class, 'presign']);
    });
});
