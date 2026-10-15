<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Bill;
use App\Models\DroppingRequest;
use App\Models\Enrollment;
use App\Models\PaymentChannel;
use App\Models\SchoolYear;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class StudentPaymentSubmissionTest extends TestCase
{
    use RefreshDatabase;

    private function bill(): Bill
    {
        $this->travelTo(Carbon::parse('2026-10-13 00:30:00', 'Asia/Manila'));
        Storage::fake('s3')->buildTemporaryUrlsUsing(fn () => 'https://example.test/proof.png');
        $user = User::factory()->create(['role' => Role::Student]);
        $student = Student::create(['user_id' => $user->id, 'student_number' => 'PAY-'.$user->id, 'first_name' => 'Payment', 'last_name' => 'Student', 'status' => 'dropped']);
        $year = SchoolYear::create(['school_year' => '2026-2027', 'start_date' => '2026-06-01', 'end_date' => '2027-03-31', 'is_active' => true]);
        $enrollment = Enrollment::create(['student_id' => $student->id, 'school_year_id' => $year->id, 'status' => 'dropped', 'track' => 'stem', 'year_level' => 'grade_11']);
        DroppingRequest::create(['student_id' => $student->id, 'enrollment_id' => $enrollment->id, 'status' => 'confirmed', 'effective_date' => '2026-10-07', 'snapshot' => [], 'events' => [], 'submissions' => []]);
        $this->actingAs($user);

        return Bill::create(['student_id' => $student->id, 'school_year_id' => $year->id, 'enrollment_id' => $enrollment->id, 'total' => 1930, 'amount_paid' => 0, 'status' => 'unpaid']);
    }

    private function payment(array $changes = []): array
    {
        return array_merge(['amount' => 500, 'method' => 'gcash', 'reference' => 'GC-001234', 'paidAt' => '2026-10-13', 'proofKey' => 'proof.png'], $changes);
    }

    public function test_manila_today_is_accepted_before_utc_midnight_and_balance_waits_for_verification(): void
    {
        $bill = $this->bill();
        $this->postJson("/api/me/bills/{$bill->id}/payments", $this->payment())->assertSuccessful();
        $this->assertSame(1930.0, $bill->fresh()->balance());
        $this->assertSame('pending', $bill->payments()->first()->status);
        $this->postJson("/api/me/bills/{$bill->id}/payments", $this->payment())->assertUnprocessable()->assertJsonValidationErrors('payment');
        $this->assertSame(1, $bill->payments()->count());
    }

    public function test_future_blank_and_invalid_dates_cannot_create_payment_records(): void
    {
        $bill = $this->bill();
        foreach (['2026-10-14', '', '2026-02-30', '2026-10-13T12:00:00Z'] as $date) {
            $this->postJson("/api/me/bills/{$bill->id}/payments", $this->payment(['paidAt' => $date]))->assertUnprocessable()->assertJsonValidationErrors('paidAt');
        }
        $this->assertSame(0, $bill->payments()->count());
    }

    public static function optionalReferences(): array
    {
        return [
            'omitted' => [[]],
            'null' => [['reference' => null]],
            'empty' => [['reference' => '']],
            'whitespace' => [['reference' => '   ']],
        ];
    }

    #[DataProvider('optionalReferences')]
    public function test_reference_is_optional_and_blank_values_are_stored_as_null(array $reference): void
    {
        $bill = $this->bill();
        $payment = $this->payment();
        unset($payment['reference']);

        $this->postJson("/api/me/bills/{$bill->id}/payments", array_merge($payment, $reference))->assertSuccessful();
        $this->assertSame(1, $bill->payments()->count());
        $this->assertNull($bill->payments()->firstOrFail()->reference);
        $this->assertSame('pending', $bill->payments()->firstOrFail()->status);
        $this->assertSame(1930.0, $bill->fresh()->balance());
    }

    public function test_provided_reference_must_be_a_string_within_the_limit_and_preserves_leading_zeroes(): void
    {
        $bill = $this->bill();
        $url = "/api/me/bills/{$bill->id}/payments";
        foreach ([1234, ['invalid'], str_repeat('r', 101)] as $reference) {
            $this->postJson($url, $this->payment(['reference' => $reference]))->assertUnprocessable()->assertJsonValidationErrors('reference');
        }
        $this->assertSame(0, $bill->payments()->count());
        $reference = '00'.str_repeat('1', 98);
        $this->postJson($url, $this->payment(['reference' => " {$reference} "]))->assertSuccessful();
        $this->assertSame($reference, $bill->payments()->firstOrFail()->reference);
    }

    public function test_receipt_presign_enforces_the_displayed_file_limits(): void
    {
        $this->bill();
        foreach ([['image/png', 0], ['image/jpeg', 5 * 1024 * 1024 + 1], ['application/pdf', 1024]] as [$type, $size]) {
            $this->postJson('/api/me/bill/payments/presign', ['contentType' => $type, 'size' => $size])->assertUnprocessable();
        }
    }

    public function test_qr_download_requires_authentication_and_an_active_channel_with_an_existing_qr(): void
    {
        Storage::fake('s3')->put('qr/payment.png', 'qr-image');
        $channel = PaymentChannel::updateOrCreate(['code' => 'gcash'], ['label' => 'GCash', 'is_active' => true, 'qr_key' => 'qr/payment.png']);
        $url = "/api/payment-channels/{$channel->id}/qr";
        $this->getJson($url)->assertUnauthorized();
        $this->actingAs(User::factory()->create(['role' => Role::Student]))->get($url)->assertOk()->assertDownload('payment.png');
        $channel->update(['is_active' => false]);
        $this->get($url)->assertNotFound();
        $channel->update(['is_active' => true, 'qr_key' => 'qr/missing.png']);
        $this->get($url)->assertNotFound();
    }
}
