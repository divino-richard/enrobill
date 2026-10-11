<?php

namespace Tests\Concurrency;

use App\Enums\Role;
use App\Models\Bill;
use App\Models\DroppingPolicy;
use App\Models\DroppingRequest;
use App\Models\Enrollment;
use App\Models\Program;
use App\Models\SchoolYear;
use App\Models\Student;
use App\Models\User;
use App\Services\DroppingFinance;
use App\Services\StudentCreditService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Process\Process;
use Tests\Feature\DroppingPolicyConfigurationTest;
use Tests\TestCase;

/** Opt-in MySQL test, always creates and removes its own disposable schema. */
class DroppingFinanceConcurrencyTest extends TestCase
{
    private ?\PDO $server = null;

    private ?string $testDatabase = null;

    protected function setUp(): void
    {
        parent::setUp();
        if (getenv('FINANCE_MYSQL_CONCURRENCY') !== '1') {
            $this->markTestSkipped('Set FINANCE_MYSQL_CONCURRENCY=1 and local MySQL credentials to run.');
        }
        $config = config('database.connections.mysql');
        $this->assertContains($config['host'], ['127.0.0.1', 'localhost'], 'Concurrency tests require a local database server.');
        $this->server = new \PDO("mysql:host={$config['host']};port={$config['port']}", $config['username'], $config['password'], [\PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION]);
        $this->testDatabase = 'enrobill_finance_test_'.bin2hex(random_bytes(6));
        $this->server->exec("CREATE DATABASE `{$this->testDatabase}`");
        config(['database.default' => 'mysql', 'database.connections.mysql.database' => $this->testDatabase, 'database.connections.mysql.url' => null]);
        DB::purge('mysql');
        Artisan::call('migrate', ['--force' => true]);
        $this->travelTo(Carbon::parse('2026-09-30 12:00:00', 'Asia/Manila'));
    }

    protected function tearDown(): void
    {
        if ($this->server && $this->testDatabase) {
            DB::disconnect('mysql');
            $this->server->exec("DROP DATABASE `{$this->testDatabase}`");
        }
        parent::tearDown();
    }

    private function fixture(int $paid): array
    {
        $user = User::factory()->create(['role' => Role::Student]);
        $student = Student::create(['user_id' => $user->id, 'student_number' => 'RACE-'.$user->id, 'first_name' => 'Test', 'last_name' => 'Student', 'status' => 'enrolled']);
        $year = SchoolYear::firstOrCreate(['school_year' => '2026-2027'], ['start_date' => '2026-06-01', 'end_date' => '2027-03-31', 'is_active' => true]);
        $enrollment = Enrollment::create(['student_id' => $student->id, 'school_year_id' => $year->id, 'status' => 'enrolled', 'track' => 'stem', 'year_level' => 'grade_11', 'dropping_category' => 'paying', 'enrolled_at' => '2026-05-01']);
        $bill = Bill::create(['student_id' => $student->id, 'enrollment_id' => $enrollment->id, 'school_year_id' => $year->id, 'total' => 11000, 'amount_paid' => $paid, 'status' => $paid ? 'partial' : 'unpaid']);
        foreach (['registration' => 1000, 'miscellaneous' => 2000, 'laboratory' => 1000, 'tuition' => 6000, 'other' => 1000] as $component => $amount) {
            $bill->items()->create(['name' => $component, 'category' => 'other', 'dropping_component' => $component, 'amount' => $amount]);
        }
        if ($paid) {
            $bill->payments()->create(['amount' => $paid, 'method' => 'cash', 'status' => 'verified', 'paid_at' => now()]);
        }
        $drop = DroppingRequest::create(['student_id' => $student->id, 'enrollment_id' => $enrollment->id, 'active_enrollment_id' => $enrollment->id, 'status' => 'submitted', 'snapshot' => [], 'events' => [], 'submissions' => [['version' => 1, 'files' => []]]]);
        DroppingPolicy::firstOrCreate(['school_year_id' => $year->id, 'version' => 1], ['enabled' => true, 'periods' => DroppingPolicyConfigurationTest::periods()]);

        return [$drop, $bill];
    }

    private function race(array $operations, User $actor): array
    {
        $gate = sys_get_temp_dir().'/'.$this->testDatabase.'-'.bin2hex(random_bytes(4));
        $workers = [];
        try {
            foreach ($operations as $operation) {
                $worker = new Process([PHP_BINARY, __DIR__.'/worker.php'], base_path(), [
                    'APP_ENV' => 'testing', 'DB_CONNECTION' => 'mysql', 'DB_DATABASE' => $this->testDatabase,
                    'DB_USERNAME' => config('database.connections.mysql.username'), 'DB_PASSWORD' => config('database.connections.mysql.password'),
                    'DB_HOST' => config('database.connections.mysql.host'), 'DB_PORT' => (string) config('database.connections.mysql.port'), 'DB_URL' => '',
                ]);
                $worker->setInput(json_encode([...$operation, 'actor' => $actor->id, 'database' => $this->testDatabase, 'gate' => $gate], JSON_THROW_ON_ERROR));
                $worker->setTimeout(30)->start();
                $workers[] = $worker;
            }
            $deadline = microtime(true) + 15;
            foreach ($workers as $worker) {
                while (! str_contains($worker->getOutput(), 'ready')) {
                    $this->assertTrue($worker->isRunning() && microtime(true) < $deadline, $worker->getErrorOutput().$worker->getOutput());
                    usleep(10000);
                }
            }
            touch($gate);

            return array_map(function (Process $worker) {
                $worker->wait();
                $this->assertTrue($worker->isSuccessful(), $worker->getErrorOutput().$worker->getOutput());

                return json_decode(trim(str_replace("ready\n", '', $worker->getOutput())), true, flags: JSON_THROW_ON_ERROR)['status'];
            }, $workers);
        } finally {
            foreach ($workers as $worker) {
                if ($worker->isRunning()) {
                    $worker->stop();
                }
            }
            if (file_exists($gate)) {
                unlink($gate);
            }
        }
    }

    public function test_duplicate_returns_and_simultaneous_verification_activate_only_once(): void
    {
        $admin = User::factory()->create(['role' => Role::Admin]);
        $cashier = User::factory()->create(['role' => Role::Cashier]);
        [$drop, $bill] = $this->fixture(0);
        $preview = app(DroppingFinance::class)->preview($drop, '2026-09-30');
        $approve = ['action' => 'confirm', 'id' => $drop->id, 'payload' => ['effectiveDate' => '2026-09-30', 'version' => 1, 'assessmentFingerprint' => $preview['fingerprint']]];
        $this->assertSame([200], $this->race([$approve], $admin));
        Program::firstOrCreate(['code' => 'stem'], ['name' => 'STEM', 'category' => 'academic', 'is_active' => true]);
        $year = SchoolYear::create(['school_year' => '2027-2028', 'start_date' => '2027-06-01', 'end_date' => '2028-03-31', 'downpayment_type' => 'fixed', 'downpayment_value' => 200, 'installment_count' => 4]);
        $year->fees()->create(['name' => 'Tuition', 'category' => 'tuition', 'type' => 'default', 'year_level' => 'all', 'amount' => 1000]);
        $create = ['action' => 'return', 'id' => $bill->student_id, 'payload' => ['schoolYearId' => $year->id, 'program' => 'stem', 'yearLevel' => 'grade_11', 'discountId' => null]];
        $this->assertSame([200, 200], $this->race([$create, $create], $admin));
        $this->assertSame(1, Enrollment::where('school_year_id', $year->id)->count());
        $return = Enrollment::where('school_year_id', $year->id)->firstOrFail();
        $this->assertSame('pending', $return->status);
        $this->assertSame([200], $this->race([['action' => 'pay', 'id' => $return->bill->id, 'payload' => ['amount' => 200, 'method' => 'cash', 'paidAt' => '2026-09-30']]], $cashier));
        $this->assertSame('pending', $return->fresh()->status);
        $payment = $bill->payments()->create(['amount' => 6000, 'status' => 'pending', 'method' => 'bank', 'paid_at' => now()]);
        $verify = ['action' => 'verify', 'id' => $bill->id, 'paymentId' => $payment->id];
        $this->assertSame([200, 200], $this->race([$verify, $verify], $cashier));
        $this->assertSame(0.0, $bill->fresh()->balance());
        $this->assertSame('enrolled', $return->fresh()->status);
        $this->assertSame(1, $bill->student->notifications()->where('title', 'Enrollment status: Enrolled')->count());
        $this->assertSame('dropped', $drop->enrollment->fresh()->status);
    }

    public function test_simultaneous_student_returns_create_one_enrollment_bill_and_notification(): void
    {
        $admin = User::factory()->create(['role' => Role::Admin]);
        [$drop, $bill] = $this->fixture(0);
        $preview = app(DroppingFinance::class)->preview($drop, '2026-09-30');
        $this->assertSame([200], $this->race([['action' => 'confirm', 'id' => $drop->id, 'payload' => ['effectiveDate' => '2026-09-30', 'version' => 1, 'assessmentFingerprint' => $preview['fingerprint']]]], $admin));
        Program::firstOrCreate(['code' => 'stem'], ['name' => 'STEM', 'category' => 'academic', 'is_active' => true]);
        SchoolYear::query()->update(['is_active' => false]);
        $year = SchoolYear::create(['school_year' => '2027-2028', 'start_date' => '2027-06-01', 'end_date' => '2028-03-31', 'is_active' => true, 'admission_open' => true, 'downpayment_type' => 'fixed', 'downpayment_value' => 200, 'installment_count' => 4]);
        $year->fees()->create(['name' => 'Tuition', 'category' => 'tuition', 'type' => 'default', 'year_level' => 'all', 'amount' => 1000]);
        $create = ['action' => 'student-return', 'payload' => ['schoolYearId' => $year->id]];
        $this->assertSame([200, 200], $this->race([$create, $create], $bill->student->user));
        $this->assertSame(1, Enrollment::where('school_year_id', $year->id)->count());
        $this->assertSame(1, Bill::where('school_year_id', $year->id)->count());
        $this->assertSame(1, $bill->student->notifications()->where('dedupe_key', 'like', 'returning-started:%')->count());
    }

    public function test_admissions_closed_after_the_transaction_snapshot_blocks_student_return(): void
    {
        [$drop, $bill] = $this->fixture(0);
        $drop->update(['status' => 'confirmed', 'effective_date' => '2026-09-30', 'confirmed_at' => now()]);
        $drop->enrollment->update(['status' => 'dropped']);
        Program::firstOrCreate(['code' => 'stem'], ['name' => 'STEM', 'category' => 'academic', 'is_active' => true]);
        SchoolYear::query()->update(['is_active' => false]);
        $year = SchoolYear::create(['school_year' => '2027-2028', 'start_date' => '2027-06-01', 'end_date' => '2028-03-31', 'is_active' => true, 'admission_open' => true, 'downpayment_type' => 'fixed', 'downpayment_value' => 200, 'installment_count' => 4]);
        $year->fees()->create(['name' => 'Tuition', 'category' => 'tuition', 'type' => 'default', 'year_level' => 'all', 'amount' => 1000]);
        $closed = false;
        // A second committed connection closes admissions after the return has
        // established its read snapshot, but before it locks the calendar.
        DB::listen(function (\Illuminate\Database\Events\QueryExecuted $query) use (&$closed, $year) {
            if (! $closed && str_starts_with($query->sql, 'select') && str_contains($query->sql, 'from `enrollments`')
                && str_contains($query->sql, '`school_year_id` =') && ! str_contains($query->sql, 'for update')) {
                $closed = true;
                $this->server->exec("UPDATE `{$this->testDatabase}`.`school_years` SET admission_open = 0 WHERE id = {$year->id}");
            }
        });
        $this->actingAs($bill->student->user)->postJson('/api/me/re-enrollment', ['schoolYearId' => $year->id])->assertUnprocessable();
        $this->assertTrue($closed, 'The concurrent admissions update was exercised.');
        $this->assertSame(0, Enrollment::where('school_year_id', $year->id)->count());
        $this->assertSame(0, Bill::where('school_year_id', $year->id)->count());
    }

    public function test_simultaneous_approvals_payments_and_credit_allocations_are_serialized(): void
    {
        $actor = User::factory()->create(['role' => Role::Admin]);
        [$drop, $bill] = $this->fixture(7000);
        $preview = app(DroppingFinance::class)->preview($drop, '2026-09-30');
        $approve = ['action' => 'confirm', 'id' => $drop->id, 'payload' => ['effectiveDate' => '2026-09-30', 'version' => 1, 'assessmentFingerprint' => $preview['fingerprint']]];
        $this->assertSame([200, 200], $this->race([$approve, $approve], $actor));
        $this->assertDatabaseCount('dropping_assessments', 1);
        $this->assertDatabaseCount('student_credits', 1);
        $this->assertSame(1000.0, app(StudentCreditService::class)->availableFor($bill->student_id));
        $this->assertSame('confirmed', $drop->fresh()->status);

        $year = SchoolYear::create(['school_year' => '2027-2028', 'start_date' => '2027-06-01', 'end_date' => '2028-03-31']);
        $enrollment = Enrollment::create(['student_id' => $bill->student_id, 'school_year_id' => $year->id, 'status' => 'pending']);
        $target = Bill::create(['student_id' => $bill->student_id, 'enrollment_id' => $enrollment->id, 'school_year_id' => $year->id, 'total' => 1000, 'amount_paid' => 0, 'status' => 'unpaid']);
        $allocate = ['action' => 'allocate', 'id' => $target->id];
        $this->assertSame([200, 200], $this->race([$allocate, $allocate], $actor));
        $this->assertSame(1000.0, $target->fresh()->creditApplied());
        $this->assertDatabaseCount('student_credit_allocations', 1);
        $this->assertSame(0.0, app(StudentCreditService::class)->availableFor($bill->student_id));

        [$drop, $bill] = $this->fixture(0);
        $preview = app(DroppingFinance::class)->preview($drop, '2026-09-30');
        $approve = ['action' => 'confirm', 'id' => $drop->id, 'payload' => ['effectiveDate' => '2026-09-30', 'version' => 1, 'assessmentFingerprint' => $preview['fingerprint']]];
        $pay = ['action' => 'pay', 'id' => $bill->id, 'payload' => ['amount' => 7000, 'method' => 'cash', 'paidAt' => '2026-09-30']];
        $outcomes = $this->race([$approve, $pay], $actor);
        $this->assertContains($outcomes, [[200, 422], [409, 200]]);
        if ($outcomes[0] === 200) {
            $this->assertSame(6000.0, $bill->fresh()->balance());
            $this->assertSame(0, $bill->payments()->count());
        } else {
            $this->assertSame('submitted', $drop->fresh()->status);
            $this->assertEquals(7000, $bill->fresh()->amount_paid);
        }
    }
}
