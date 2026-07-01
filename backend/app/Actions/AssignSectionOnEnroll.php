<?php

namespace App\Actions;

use App\Models\Enrollment;
use App\Models\Section;
use Illuminate\Support\Facades\DB;

class AssignSectionOnEnroll
{
    /**
     * Place a freshly-enrolled student into a section for their school year,
     * program and grade. Fills existing sections (by name order) until each hits
     * capacity, then automatically opens the next lettered section (A, B, C, …)
     * at the default capacity. No-op if the enrollment isn't enrolled or is
     * already sectioned.
     */
    public function __invoke(Enrollment $enrollment): void
    {
        if ($enrollment->status !== 'enrolled' || $enrollment->section_id !== null) {
            return;
        }

        // Serialize placement for this grade so two concurrent enrollments don't
        // both create the same next section or overfill one.
        DB::transaction(function () use ($enrollment) {
            $sections = Section::query()
                ->where('school_year_id', $enrollment->school_year_id)
                ->where('program', $enrollment->track)
                ->where('year_level', $enrollment->year_level)
                ->withCount('enrollments')
                ->orderBy('name')
                ->lockForUpdate()
                ->get();

            $section = $sections->first(fn (Section $s) => $s->enrollments_count < $s->capacity);

            // Every existing section is full (or none exist yet) — open the next one.
            if ($section === null) {
                $section = Section::create([
                    'school_year_id' => $enrollment->school_year_id,
                    'program' => $enrollment->track,
                    'year_level' => $enrollment->year_level,
                    'name' => $this->nextSectionName($sections->pluck('name')->all()),
                    'capacity' => Section::DEFAULT_CAPACITY,
                ]);
            }

            $enrollment->update(['section_id' => $section->id]);
        });
    }

    /**
     * The first spreadsheet-style letter name (A…Z, AA, AB, …) not already taken
     * by a section in this grade, so gaps from renamed/deleted sections are
     * reused before extending the sequence.
     *
     * @param  array<int, string>  $existing
     */
    private function nextSectionName(array $existing): string
    {
        for ($index = 0; ; $index++) {
            $name = $this->columnName($index);
            if (! in_array($name, $existing, true)) {
                return $name;
            }
        }
    }

    /**
     * Zero-based index to a spreadsheet-style column label (0 => A, 25 => Z,
     * 26 => AA, …).
     */
    private function columnName(int $index): string
    {
        $name = '';
        $index++;

        while ($index > 0) {
            $index--;
            $name = chr(ord('A') + ($index % 26)).$name;
            $index = intdiv($index, 26);
        }

        return $name;
    }
}
