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
        Schema::create('applications', function (Blueprint $table) {
            $table->id();
            $table->foreignIdFor(User::class)->constrained()->cascadeOnDelete();
            $table->string('reference')->unique();
            $table->string('status')->default('submitted')->index();

            // Enrollment
            $table->string('enrollment_type')->index();

            // Personal
            $table->string('surname');
            $table->string('given_name');
            $table->string('middle_name')->nullable();
            $table->string('extension')->nullable();
            $table->date('date_of_birth')->nullable();
            $table->unsignedTinyInteger('age')->nullable();
            $table->string('gender')->nullable()->index();
            $table->string('nationality')->nullable();
            $table->string('civil_status')->nullable();
            $table->string('place_of_birth')->nullable();
            $table->string('religion')->nullable();
            $table->string('health_concerns')->nullable();

            // Permanent address (codes for province/city/barangay, text street)
            $table->string('address_street')->nullable();
            $table->string('address_barangay')->nullable();
            $table->string('address_city')->nullable()->index();
            $table->string('address_province')->nullable()->index();

            // Contact
            $table->string('home_address')->nullable();
            $table->string('mailing_address')->nullable();
            $table->string('phone_number')->nullable();
            $table->string('email_address')->nullable();
            $table->string('facebook_account')->nullable();

            // Guardian
            $table->string('guardian_name')->nullable();
            $table->string('guardian_relation')->nullable();
            $table->string('guardian_contact_number')->nullable();
            $table->string('guardian_address')->nullable();
            $table->string('guardian_occupation')->nullable();

            // Previous school
            $table->string('prev_school_name')->nullable();
            $table->string('prev_school_grade_level')->nullable();
            $table->string('prev_school_address')->nullable();
            $table->string('prev_school_year_graduated')->nullable();
            $table->string('prev_school_gpa')->nullable();
            $table->string('prev_school_type')->nullable();

            // Course & strand
            $table->string('track_or_strand')->index();
            $table->string('year_level')->index();
            $table->string('semester')->index();
            $table->string('school_year')->index();

            // Declaration
            $table->string('declaration_student_name')->nullable();
            $table->string('declaration_guardian_name')->nullable();
            $table->timestamp('date_signed')->nullable();
            $table->boolean('agreement_accepted')->default(false);

            $table->timestamp('submitted_at')->nullable();
            $table->timestamps();
        });

        Schema::create('application_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignIdFor(Application::class)->constrained()->cascadeOnDelete();
            $table->string('type')->index();
            $table->string('s3_key');
            $table->string('file_name');
            $table->unsignedBigInteger('size')->nullable();
            $table->string('content_type')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('application_documents');
        Schema::dropIfExists('applications');
    }
};
