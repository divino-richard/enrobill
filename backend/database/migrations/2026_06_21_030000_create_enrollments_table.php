<?php

use App\Models\Student;
use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The academic record: a student's enrollment in a program for one term.
        // Distinct from the bill (the financial artifact), which now points here.
        Schema::create('enrollments', function (Blueprint $table) {
            $table->id();
            $table->foreignIdFor(Student::class)->constrained()->cascadeOnDelete();
            $table->foreignId('term_id')->constrained('terms')->cascadeOnDelete();
            // Snapshot of the program at enrollment time (program code + level).
            $table->string('track')->nullable()->index();
            $table->string('year_level')->nullable();
            // pending → enrolled → completed; or dropped / withdrawn.
            $table->string('status')->default('pending')->index();
            $table->timestamp('enrolled_at')->nullable();
            $table->foreignIdFor(User::class, 'created_by')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();

            // One enrollment per student per term.
            $table->unique(['student_id', 'term_id']);
        });

        // Link each bill to the enrollment it bills for.
        Schema::table('bills', function (Blueprint $table) {
            $table->foreignId('enrollment_id')->nullable()->after('term_id')
                ->constrained()->nullOnDelete();
        });

        $this->backfill();
    }

    /**
     * Create an enrollment for every existing bill and link them, so prior data
     * keeps a complete academic history.
     */
    private function backfill(): void
    {
        $now = now();

        $bills = DB::table('bills')
            ->leftJoin('fee_structures', 'bills.fee_structure_id', '=', 'fee_structures.id')
            ->leftJoin('students', 'bills.student_id', '=', 'students.id')
            ->select(
                'bills.id as bill_id',
                'bills.student_id',
                'bills.term_id',
                'fee_structures.track as fs_track',
                'fee_structures.year_level as fs_year_level',
                'students.track_or_strand as student_track',
                'students.year_level as student_year_level',
                'students.status as student_status',
            )
            ->get();

        foreach ($bills as $bill) {
            // De-dupe in case a student somehow has two bills for a term.
            $existing = DB::table('enrollments')
                ->where('student_id', $bill->student_id)
                ->where('term_id', $bill->term_id)
                ->value('id');

            if ($existing !== null) {
                DB::table('bills')->where('id', $bill->bill_id)
                    ->update(['enrollment_id' => $existing]);

                continue;
            }

            $enrolled = $bill->student_status === 'enrolled';

            $enrollmentId = DB::table('enrollments')->insertGetId([
                'student_id' => $bill->student_id,
                'term_id' => $bill->term_id,
                'track' => $bill->fs_track ?? $bill->student_track,
                'year_level' => $bill->fs_year_level ?? $bill->student_year_level,
                'status' => $enrolled ? 'enrolled' : 'pending',
                'enrolled_at' => $enrolled ? $now : null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            DB::table('bills')->where('id', $bill->bill_id)
                ->update(['enrollment_id' => $enrollmentId]);
        }
    }

    public function down(): void
    {
        Schema::table('bills', function (Blueprint $table) {
            $table->dropConstrainedForeignId('enrollment_id');
        });

        Schema::dropIfExists('enrollments');
    }
};
