<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * `students.school_year` is the student's current-standing snapshot but, until
     * now, progression advanced their year level without advancing this field —
     * leaving it stuck at the admission year. Realign each student who has
     * enrollments to their latest enrollment's school year (the same "latest by
     * school-year key" rule used elsewhere). Students with no enrollments keep
     * their existing value.
     */
    public function up(): void
    {
        DB::table('students')
            ->whereExists(function ($query) {
                $query->select(DB::raw(1))
                    ->from('enrollments')
                    ->whereColumn('enrollments.student_id', 'students.id');
            })
            ->update([
                'school_year' => DB::raw(
                    '(select sy.school_year from enrollments e '
                    .'join school_years sy on sy.id = e.school_year_id '
                    .'where e.student_id = students.id '
                    .'order by sy.school_year desc limit 1)'
                ),
            ]);
    }

    public function down(): void
    {
        // The prior (admission-year) values can't be reconstructed — no-op.
    }
};
