<?php

use App\Actions\GenerateBillForEnrollment;
use App\Http\Controllers\Admin\PaymentController;
use App\Http\Controllers\Admin\ReturningEnrollmentController;
use App\Http\Controllers\DroppingRequestController;
use App\Models\Bill;
use App\Models\DroppingRequest;
use App\Models\Payment;
use App\Models\Student;
use App\Models\User;
use App\Services\StudentCreditService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

// Test-only subprocess. It refuses to connect to an application database.
require dirname(__DIR__, 2).'/vendor/autoload.php';
$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$input = json_decode(stream_get_contents(STDIN), true, flags: JSON_THROW_ON_ERROR);
if (! preg_match('/^enrobill_finance_test_[a-f0-9]{12}$/', $input['database'])) {
    throw new RuntimeException('A disposable finance test database is required.');
}
config(['database.default' => 'mysql', 'database.connections.mysql.database' => $input['database'],
    'database.connections.mysql.url' => null, 'cache.default' => 'array', 'session.driver' => 'array']);
DB::purge('mysql');
Carbon::setTestNow(Carbon::parse('2026-09-30 12:00:00', 'Asia/Manila'));
echo "ready\n";
flush();
$deadline = microtime(true) + 15;
while (! file_exists($input['gate'])) {
    if (microtime(true) > $deadline) {
        throw new RuntimeException('Test start barrier timed out.');
    }
    usleep(10000);
}
try {
    $user = User::findOrFail($input['actor']);
    $request = Request::create('/', 'POST', $input['payload'] ?? []);
    $request->setUserResolver(fn () => $user);
    if ($input['action'] === 'confirm') {
        app(DroppingRequestController::class)->confirm($request, DroppingRequest::findOrFail($input['id']));
    } elseif ($input['action'] === 'pay') {
        app(PaymentController::class)->store($request, Bill::findOrFail($input['id']));
    } elseif ($input['action'] === 'verify') {
        app(PaymentController::class)->verify(Bill::findOrFail($input['id']), Payment::findOrFail($input['paymentId']));
    } elseif ($input['action'] === 'return') {
        app(ReturningEnrollmentController::class)->store($request, Student::findOrFail($input['id']), app(GenerateBillForEnrollment::class));
    } elseif ($input['action'] === 'student-return') {
        app(\App\Http\Controllers\StudentReturningEnrollmentController::class)->store($request, app(\App\Services\StudentReturningEnrollment::class));
    } elseif ($input['action'] === 'allocate') {
        app(StudentCreditService::class)->applyToBill(Bill::findOrFail($input['id']), $user->id);
    } else {
        throw new RuntimeException('Unknown test operation.');
    }
    echo json_encode(['status' => 200]);
} catch (ValidationException $e) {
    echo json_encode(['status' => 422, 'message' => $e->getMessage()]);
} catch (HttpException $e) {
    echo json_encode(['status' => $e->getStatusCode(), 'message' => $e->getMessage()]);
}
