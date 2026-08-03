<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The reason a registrar sends a clearance/grades file back to the
     * student for changes. Set only when the matching flag is returned to
     * false after having been reviewed; cleared once accepted or replaced.
     */
    public function up(): void
    {
        Schema::table('semester_standings', function (Blueprint $table) {
            $table->text('clearance_note')->nullable()->after('clearance_cleared');
            $table->text('grades_note')->nullable()->after('grades_passed');
        });
    }

    public function down(): void
    {
        Schema::table('semester_standings', function (Blueprint $table) {
            $table->dropColumn(['clearance_note', 'grades_note']);
        });
    }
};
