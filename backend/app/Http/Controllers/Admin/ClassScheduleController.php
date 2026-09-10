<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClassTimetable;
use App\Models\SchoolYear;
use App\Models\Section;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ClassScheduleController extends Controller
{
    public function show(Section $section): JsonResponse
    {
        return $this->response($section, ClassTimetable::where('section_id', $section->id)->first());
    }

    public function update(Request $request, Section $section): JsonResponse
    {
        $input = $request->validate([
            'version' => ['required', 'integer', 'min:0'],
            'entries' => ['present', 'array', 'max:100'],
            'entries.*' => ['required', 'array:id,day,startTime,endTime,subject,teacherId,teacher,room'],
            'entries.*.id' => ['required', 'uuid', 'distinct'],
            'entries.*.day' => ['required', 'integer', 'between:1,7'],
            'entries.*.startTime' => ['required', 'date_format:H:i'],
            'entries.*.endTime' => ['required', 'date_format:H:i'],
            'entries.*.subject' => ['required', 'string', 'max:150'],
            'entries.*.teacherId' => [
                'required',
                'integer',
                Rule::exists('users', 'id')->where('role', 'teacher'),
            ],
            'entries.*.teacher' => ['sometimes', 'nullable', 'string', 'max:120'],
            'entries.*.room' => ['required', 'string', 'max:80'],
        ]);
        $teachers = User::query()
            ->whereIn('id', collect($input['entries'])->pluck('teacherId'))
            ->where('role', 'teacher')
            ->get()
            ->keyBy('id');

        $entries = collect($input['entries'])->map(function (array $entry) use ($teachers) {
            foreach (['subject', 'room'] as $field) {
                $entry[$field] = Str::squish($entry[$field]);
                if ($entry[$field] === '') {
                    throw ValidationException::withMessages(['entries' => 'Subject and room must not be blank.']);
                }
            }
            $entry['teacherId'] = (int) $entry['teacherId'];
            $entry['teacher'] = $teachers->get($entry['teacherId'])?->name;
            $entry['day'] = (int) $entry['day'];
            if ($entry['endTime'] <= $entry['startTime']) {
                throw ValidationException::withMessages(['entries' => 'Each class must end after its start time on the same day.']);
            }

            return $entry;
        })->sortBy([['day', 'asc'], ['startTime', 'asc'], ['id', 'asc']])->values()->all();

        return $this->mutate($request, $section, function (ClassTimetable $timetable) use ($section, $entries) {
            $this->checkConflicts($section, $entries);
            $timetable->entries = $entries;
        });
    }

    public function publish(Request $request, Section $section): JsonResponse
    {
        $request->validate(['version' => ['required', 'integer', 'min:0']]);

        return $this->mutate($request, $section, function (ClassTimetable $timetable) use ($request, $section) {
            $entries = $timetable->entries ?? [];
            if ($entries === []) {
                throw ValidationException::withMessages(['entries' => 'Add at least one class before publishing.']);
            }
            $entries = $this->requireLinkedTeachers($entries);
            $this->checkConflicts($section, $entries);
            $timetable->entries = $entries;
            $timetable->published_entries = $entries;
            $timetable->published_at = now();
            $timetable->published_by = $request->user()->id;
        });
    }

    public function unpublish(Request $request, Section $section): JsonResponse
    {
        $request->validate(['version' => ['required', 'integer', 'min:0']]);

        return $this->mutate($request, $section, function (ClassTimetable $timetable) {
            $timetable->published_entries = null;
            $timetable->published_at = null;
            $timetable->published_by = null;
        });
    }

    private function mutate(Request $request, Section $section, callable $change): JsonResponse
    {
        return DB::transaction(function () use ($request, $section, $change) {
            // Serialize all scheduling changes in one academic year, including
            // first saves, so simultaneous cross-section edits cannot double-book.
            SchoolYear::whereKey($section->school_year_id)->lockForUpdate()->firstOrFail();
            $section = Section::whereKey($section->id)->lockForUpdate()->firstOrFail();
            $timetable = ClassTimetable::firstOrCreate(
                ['section_id' => $section->id],
                ['version' => 0, 'entries' => []],
            );
            abort_if($timetable->version !== $request->integer('version'), 409,
                'This schedule changed in another session. Reload the schedule before saving again.');
            $change($timetable);
            $timetable->version++;
            $timetable->updated_by = $request->user()->id;
            $timetable->save();

            return $this->response($section, $timetable);
        }, 3);
    }

    private function checkConflicts(Section $section, array $entries): void
    {
        foreach ($entries as $index => $entry) {
            foreach (array_slice($entries, $index + 1) as $other) {
                if ($this->overlaps($entry, $other)) {
                    throw ValidationException::withMessages(['entries' => "{$entry['subject']} overlaps {$other['subject']} in this section."]);
                }
            }
        }

        $others = ClassTimetable::whereHas('section', fn ($query) => $query
            ->where('school_year_id', $section->school_year_id)->whereKeyNot($section->id))
            ->with('section')->get();
        foreach ($others as $timetable) {
            // Published slots stay reserved until that section republishes or
            // unpublishes; unsent edits must not invalidate a student's timetable.
            $reserved = array_merge($timetable->entries ?? [], $timetable->published_entries ?? []);
            foreach ($entries as $entry) {
                foreach ($reserved as $other) {
                    if (! $this->overlaps($entry, $other)) {
                        continue;
                    }
                    $sameTeacher = isset($entry['teacherId'], $other['teacherId'])
                        ? (int) $entry['teacherId'] === (int) $other['teacherId']
                        : Str::lower(Str::squish($entry['teacher'] ?? '')) === Str::lower(Str::squish($other['teacher'] ?? ''));
                    if ($sameTeacher) {
                        throw ValidationException::withMessages(['entries' => "Teacher {$entry['teacher']} is already scheduled in {$timetable->section->program} {$timetable->section->name} at this time."]);
                    }
                    if (Str::lower(Str::squish($entry['room'])) === Str::lower(Str::squish($other['room'] ?? ''))) {
                        throw ValidationException::withMessages(['entries' => "Room {$entry['room']} is already scheduled in {$timetable->section->program} {$timetable->section->name} at this time."]);
                    }
                }
            }
        }
    }

    private function overlaps(array $a, array $b): bool
    {
        return $a['day'] === $b['day'] && $a['startTime'] < $b['endTime'] && $a['endTime'] > $b['startTime'];
    }

    private function response(Section $section, ?ClassTimetable $timetable): JsonResponse
    {
        $entries = $this->currentTeacherNames($timetable?->entries ?? []);
        $section->loadMissing('adviser');

        return response()->json(['data' => [
            'sectionId' => $section->id,
            'adviser' => $section->adviser
                ? ['id' => $section->adviser->id, 'name' => $section->adviser->name]
                : null,
            'version' => $timetable?->version ?? 0,
            'entries' => $entries,
            'publishedAt' => $timetable?->published_at?->toIso8601String(),
            'hasUnpublishedChanges' => ($timetable?->entries ?? []) !== ($timetable?->published_entries ?? []),
        ]]);
    }

    private function requireLinkedTeachers(array $entries): array
    {
        $teacherIds = collect($entries)->pluck('teacherId')->filter()->unique();
        $teachers = User::query()
            ->whereIn('id', $teacherIds)
            ->where('role', 'teacher')
            ->get()
            ->keyBy('id');

        foreach ($entries as &$entry) {
            $teacher = $teachers->get((int) ($entry['teacherId'] ?? 0));
            if ($teacher === null) {
                throw ValidationException::withMessages([
                    'entries' => 'Every class must be linked to an active Teacher account before publishing.',
                ]);
            }
            $entry['teacherId'] = $teacher->id;
            $entry['teacher'] = $teacher->name;
        }
        unset($entry);

        return $entries;
    }

    private function currentTeacherNames(array $entries): array
    {
        $teachers = User::query()
            ->whereIn('id', collect($entries)->pluck('teacherId')->filter())
            ->where('role', 'teacher')
            ->pluck('name', 'id');

        foreach ($entries as &$entry) {
            $currentName = $teachers->get((int) ($entry['teacherId'] ?? 0));
            if ($currentName !== null) {
                $entry['teacher'] = $currentName;
            }
        }
        unset($entry);

        return $entries;
    }
}
