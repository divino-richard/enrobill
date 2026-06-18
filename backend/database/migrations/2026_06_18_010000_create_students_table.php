<?php

use App\Models\Application;
use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('students', function (Blueprint $table) {
            $table->id();
            // One student record per user; the application that admitted them.
            $table->foreignIdFor(User::class)->unique()->constrained()->cascadeOnDelete();
            $table->foreignIdFor(Application::class)->nullable()->constrained()->nullOnDelete();
            $table->string('student_number')->unique();
            $table->string('status')->default('admitted')->index();

            // Identity — copied from the accepted application at admission, but
            // the canonical, editable record from here on.
            $table->string('first_name');
            $table->string('middle_name')->nullable();
            $table->string('last_name');
            $table->string('extension')->nullable();
            $table->date('date_of_birth')->nullable();
            $table->string('gender')->nullable();
            $table->string('nationality')->nullable();
            $table->string('civil_status')->nullable();
            $table->string('place_of_birth')->nullable();
            $table->string('religion')->nullable();

            // Contact
            $table->string('email')->nullable();
            $table->string('phone_number')->nullable();

            // Address
            $table->string('address_province')->nullable();
            $table->string('address_city')->nullable();
            $table->string('address_barangay')->nullable();
            $table->string('address_street')->nullable();

            // Admitted program
            $table->string('track_or_strand')->nullable()->index();
            $table->string('year_level')->nullable();
            $table->string('school_year')->nullable()->index();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('students');
    }
};
