import { useState, type ReactNode } from "react";
import {
  CheckCircle2Icon,
  Clock3Icon,
  EyeOffIcon,
  MoreHorizontalIcon,
  PlusIcon,
  SendIcon,
  Trash2Icon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TimePicker } from "@/components/ui/time-picker";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTerms } from "@/features/terms/hooks";
import { useSections } from "@/features/sections/hooks";
import type { Section } from "@/features/sections/types";
import {
  useClassSchedule,
  useChangeSchedule,
} from "@/features/scheduling/hooks";
import { WeeklyTimetable } from "@/features/scheduling/weekly-timetable";
import {
  SCHEDULE_DAYS,
  classMinutes,
  scheduleDuration,
  scheduleTime,
  type ClassEntry,
} from "@/features/scheduling/types";
import { getErrorMessage } from "@/lib/get-error-message";
import { useUsers } from "@/features/users/hooks";

function sectionLabel(section: Section) {
  return `${section.program.toUpperCase()} · Grade ${section.yearLevel === "grade_11" ? "11" : "12"} · ${section.name}`;
}

export default function SchedulingPage() {
  const terms = useTerms();
  const [selectedYear, setSelectedYear] = useState("");
  const yearId =
    Number(selectedYear) ||
    terms.data?.find((term) => term.isActive)?.id ||
    terms.data?.[0]?.id;
  const sections = useSections({ schoolYearId: yearId });
  const [selectedSection, setSelectedSection] = useState("");
  const section =
    sections.data?.find((item) => String(item.id) === selectedSection) ??
    sections.data?.[0];
  const selectionControls = (
    <div className="grid min-w-0 gap-2 sm:flex sm:flex-wrap">
      <div className="min-w-0 sm:w-44">
        <Label htmlFor="schedule-year" className="sr-only">
          School year
        </Label>
        <Select
          value={yearId ? String(yearId) : ""}
          onValueChange={(value) => {
            setSelectedYear(value);
            setSelectedSection("");
          }}
          disabled={terms.isLoading || terms.isError}
        >
          <SelectTrigger id="schedule-year" className="w-full">
            <SelectValue placeholder="Select school year" />
          </SelectTrigger>
          <SelectContent>
            {terms.data?.map((item) => (
              <SelectItem key={item.id} value={String(item.id)}>
                SY {item.schoolYear}
                {item.isActive ? " · Active" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="min-w-0 sm:w-64">
        <Label htmlFor="schedule-section" className="sr-only">
          Section
        </Label>
        <Select
          value={section ? String(section.id) : ""}
          onValueChange={setSelectedSection}
          disabled={sections.isLoading || sections.isError}
        >
          <SelectTrigger id="schedule-section" className="w-full">
            <SelectValue placeholder="Select section" />
          </SelectTrigger>
          <SelectContent>
            {sections.data?.map((item) => (
              <SelectItem key={item.id} value={String(item.id)}>
                {sectionLabel(item)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  return (
    <div className="min-w-0 space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        Class scheduling
      </h1>
      {(terms.isError ||
        sections.isError ||
        terms.isLoading ||
        sections.isLoading ||
        !yearId ||
        !section) &&
        selectionControls}
      {terms.isError || sections.isError ? (
        <div role="alert" className="space-y-3 rounded-lg border p-6">
          <p>We couldn't load school years or sections.</p>
          <Button
            variant="outline"
            onClick={() => {
              void terms.refetch();
              void sections.refetch();
            }}
          >
            Try again
          </Button>
        </div>
      ) : terms.isLoading || sections.isLoading ? (
        <p role="status">Loading sections…</p>
      ) : !yearId ? (
        <p className="text-muted-foreground rounded-lg border p-6">
          Create a school year in Academic Years before scheduling classes.
        </p>
      ) : !section ? (
        <p className="text-muted-foreground rounded-lg border p-6">
          No sections in this school year. Create a section in Class Sections
          first.
        </p>
      ) : (
        <SectionSchedule
          key={section.id}
          section={section}
          selectionControls={selectionControls}
        />
      )}
    </div>
  );
}

function SectionSchedule({
  section,
  selectionControls,
}: {
  section: Section;
  selectionControls: ReactNode;
}) {
  const query = useClassSchedule(section.id);
  const change = useChangeSchedule(section.id);
  const teachers = useUsers({
    role: "teacher",
    perPage: 100,
    sort: "name",
    dir: "asc",
  });
  const [draft, setDraft] = useState<ClassEntry | null>(null);
  const [editing, setEditing] = useState(false);
  const [initialDraft, setInitialDraft] = useState<ClassEntry | null>(null);
  const [confirm, setConfirm] = useState<
    "publish" | "unpublish" | "remove" | "discard" | null
  >(null);
  const [notice, setNotice] = useState("");
  const [expectedVersion, setExpectedVersion] = useState(0);
  const schedule = query.data;

  function startEdit(entry?: ClassEntry, day = 1) {
    change.reset();
    setNotice("");
    setExpectedVersion(schedule?.version ?? 0);
    setEditing(Boolean(entry));
    const next = entry
      ? { ...entry }
      : {
          id: crypto.randomUUID(),
          day,
          startTime: "07:30",
          endTime: "08:30",
          subject: "",
          teacherId: undefined,
          teacher: "",
          room: "",
        };
    setDraft(next);
    setInitialDraft(next);
  }

  function closeEditor() {
    if (change.isPending) return;
    if (draft && JSON.stringify(draft) !== JSON.stringify(initialDraft)) {
      setConfirm("discard");
    } else {
      setDraft(null);
      change.reset();
    }
  }

  async function saveEntry() {
    if (!draft || !schedule) return;
    const entries = [
      ...schedule.entries.filter((entry) => entry.id !== draft.id),
      draft,
    ];
    try {
      await change.mutateAsync({
        action: "save",
        version: expectedVersion,
        entries,
      });
      setDraft(null);
      setNotice(
        "Draft saved. Publish when the schedule is ready for students.",
      );
    } catch {
      /* Inline feedback preserves the form. */
    }
  }

  async function confirmChange() {
    if (!schedule || !confirm) return;
    if (confirm === "discard") {
      setDraft(null);
      setConfirm(null);
      change.reset();
      return;
    }
    try {
      if (confirm === "remove") {
        if (!draft) return;
        await change.mutateAsync({
          action: "save",
          version: expectedVersion,
          entries: schedule.entries.filter((entry) => entry.id !== draft.id),
        });
        setDraft(null);
        setNotice(
          "Class removed from the draft. Publish to update the student schedule.",
        );
      } else {
        await change.mutateAsync({ action: confirm, version: expectedVersion });
        setNotice(
          confirm === "publish"
            ? "Schedule published. Students in this section can now view it."
            : "Schedule unpublished. The saved draft is kept.",
        );
      }
      setConfirm(null);
    } catch {
      /* Inline feedback preserves the action. */
    }
  }

  function reload() {
    setDraft(null);
    setConfirm(null);
    change.reset();
    void query.refetch();
  }

  const error = change.isError ? (
    <div role="alert" className="space-y-2 text-sm">
      <p className="text-destructive">
        {getErrorMessage(
          change.error,
          "We couldn't save this schedule. Please try again.",
        )}
      </p>
      <Button type="button" size="sm" variant="outline" onClick={reload}>
        Discard edits & reload
      </Button>
    </div>
  ) : null;

  if (query.isLoading)
    return (
      <div className="space-y-4">
        {selectionControls}
        <p role="status">Loading timetable…</p>
      </div>
    );
  if (query.isError || !schedule)
    return (
      <div role="alert" className="space-y-3 rounded-lg border p-6">
        {selectionControls}
        <p>We couldn't load this section's schedule.</p>
        <Button
          variant="outline"
          disabled={query.isFetching}
          onClick={() => query.refetch()}
        >
          Try again
        </Button>
      </div>
    );

  return (
    <>
      <section aria-label="Section timetable" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            {selectionControls}
            <Badge variant={schedule.adviser ? "secondary" : "outline"}>
              Adviser: {schedule.adviser?.name ?? "Not assigned"}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => startEdit()}
              disabled={change.isPending}
            >
              <PlusIcon />
              Add class
            </Button>
            <Button
              disabled={
                change.isPending ||
                !schedule.entries.length ||
                Boolean(schedule.publishedAt && !schedule.hasUnpublishedChanges)
              }
              onClick={() => {
                change.reset();
                setExpectedVersion(schedule.version);
                setConfirm("publish");
              }}
            >
              <SendIcon aria-hidden="true" />
              {schedule.publishedAt ? "Publish changes" : "Publish schedule"}
            </Button>
            {schedule.publishedAt && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={change.isPending}
                    aria-label="Schedule options"
                  >
                    <MoreHorizontalIcon aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-full max-w-56">
                  <div className="text-muted-foreground px-2 py-1.5 text-xs">
                    Published {new Date(schedule.publishedAt).toLocaleString()}
                  </div>
                  <DropdownMenuItem
                    onSelect={() => {
                      change.reset();
                      setExpectedVersion(schedule.version);
                      setConfirm("unpublish");
                    }}
                  >
                    <EyeOffIcon aria-hidden="true" />
                    Unpublish schedule
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        <div className="space-y-3">
          <div role="status" className={notice ? undefined : "sr-only"}>
            {notice && (
              <p className="flex items-start gap-2 text-sm">
                <CheckCircle2Icon
                  aria-hidden="true"
                  className="text-primary mt-0.5 size-4 shrink-0"
                />
                {notice}
              </p>
            )}
          </div>
          {!draft && !confirm && error}
          <WeeklyTimetable
            entries={schedule.entries}
            onEdit={startEdit}
            onAdd={(day) => startEdit(undefined, day)}
            disabled={change.isPending}
            summary={
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <Badge
                  variant="secondary"
                  className={
                    schedule.publishedAt && !schedule.hasUnpublishedChanges
                      ? "bg-primary/10 text-primary"
                      : ""
                  }
                >
                  {schedule.publishedAt
                    ? schedule.hasUnpublishedChanges
                      ? "Unpublished changes"
                      : "Published"
                    : "Draft · Only admins"}
                </Badge>
                <span className="text-muted-foreground">
                  {schedule.entries.length}{" "}
                  {schedule.entries.length === 1 ? "class" : "classes"} ·{" "}
                  {scheduleDuration(
                    schedule.entries.reduce(
                      (total, entry) => total + classMinutes(entry),
                      0,
                    ),
                  )}
                </span>
                {schedule.publishedAt && schedule.hasUnpublishedChanges && (
                  <span className="text-muted-foreground">
                    Students see the last published version.
                  </span>
                )}
              </div>
            }
          />
        </div>
      </section>

      <Dialog
        open={draft !== null}
        onOpenChange={(open) => {
          if (!open) closeEditor();
        }}
      >
        <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-xl p-5 sm:p-6">
          <DialogHeader className="text-left">
            <DialogTitle className="pr-6 text-lg">
              {editing ? "Edit class" : "Add class"}
            </DialogTitle>
            <DialogDescription>
              {sectionLabel(section)}. All fields are required.
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void saveEntry();
              }}
              className="space-y-5"
            >
              <fieldset
                disabled={change.isPending}
                className="grid gap-4 sm:grid-cols-2"
              >
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="class-subject">Subject</Label>
                  <Input
                    id="class-subject"
                    required
                    maxLength={150}
                    placeholder="e.g. General Mathematics"
                    autoFocus
                    value={draft.subject}
                    onChange={(e) =>
                      setDraft({ ...draft, subject: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="class-day">Day</Label>
                  <Select
                    disabled={change.isPending}
                    value={String(draft.day)}
                    onValueChange={(v) =>
                      setDraft({ ...draft, day: Number(v) })
                    }
                  >
                    <SelectTrigger id="class-day" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SCHEDULE_DAYS.map((day, i) => (
                        <SelectItem key={day} value={String(i + 1)}>
                          {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor="class-start">Start time</Label>
                  <TimePicker
                    id="class-start"
                    label="Start time"
                    disabled={change.isPending}
                    value={draft.startTime}
                    onValueChange={(value) =>
                      setDraft({ ...draft, startTime: value })
                    }
                  />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor="class-end">End time</Label>
                  <TimePicker
                    id="class-end"
                    label="End time"
                    disabled={change.isPending}
                    value={draft.endTime}
                    onValueChange={(value) =>
                      setDraft({ ...draft, endTime: value })
                    }
                  />
                </div>
                <div className="bg-muted/40 col-span-full flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm">
                  <Clock3Icon
                    aria-hidden="true"
                    className="text-muted-foreground size-4 shrink-0"
                  />
                  <p>
                    {draft.endTime > draft.startTime ? (
                      <>
                        <span className="font-medium">
                          {scheduleDuration(classMinutes(draft))}
                        </span>
                        <span className="text-muted-foreground">
                          {" "}
                          · {SCHEDULE_DAYS[draft.day - 1]} ·{" "}
                          {scheduleTime(draft.startTime)} –{" "}
                          {scheduleTime(draft.endTime)}
                        </span>
                      </>
                    ) : (
                      "Choose an end time after the start time."
                    )}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="class-teacher">Teacher</Label>
                  <Select
                    value={draft.teacherId ? String(draft.teacherId) : ""}
                    onValueChange={(value) => {
                      const teacher = teachers.data?.rows.find(
                        (item) => item.id === Number(value),
                      );
                      setDraft({
                        ...draft,
                        teacherId: Number(value),
                        teacher: teacher?.name ?? "",
                      });
                    }}
                    disabled={teachers.isLoading || teachers.isError}
                  >
                    <SelectTrigger id="class-teacher" className="w-full">
                      <SelectValue placeholder="Select teacher" />
                    </SelectTrigger>
                    <SelectContent>
                      {teachers.data?.rows.map((teacher) => (
                        <SelectItem key={teacher.id} value={String(teacher.id)}>
                          {teacher.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {teachers.isError && (
                    <p className="text-destructive text-xs">
                      Teachers could not be loaded. Reopen this class to retry.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="class-room">Room</Label>
                  <Input
                    id="class-room"
                    required
                    maxLength={80}
                    placeholder="e.g. Room 201"
                    value={draft.room}
                    onChange={(e) =>
                      setDraft({ ...draft, room: e.target.value })
                    }
                  />
                </div>
              </fieldset>
              <p className="text-muted-foreground text-xs">
                Grade access begins after this schedule is published. Scheduling
                conflicts are checked when you save.
              </p>
              {draft.endTime <= draft.startTime && (
                <p role="alert" className="text-destructive text-sm">
                  End time must be after start time.
                </p>
              )}
              {!confirm && error}
              <DialogFooter className="gap-2 border-t pt-4">
                {editing && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-destructive sm:mr-auto"
                    disabled={change.isPending}
                    onClick={() => {
                      change.reset();
                      setConfirm("remove");
                    }}
                  >
                    <Trash2Icon />
                    Remove
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  disabled={change.isPending}
                  onClick={closeEditor}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    change.isPending ||
                    draft.endTime <= draft.startTime ||
                    !draft.subject.trim() ||
                    !draft.teacherId ||
                    !draft.room.trim()
                  }
                >
                  {change.isPending
                    ? "Saving…"
                    : editing
                      ? "Save changes"
                      : "Add to draft"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open && !change.isPending) {
            setConfirm(null);
            change.reset();
          }
        }}
      >
        <DialogContent className="w-[calc(100%-2rem)] rounded-xl">
          <DialogHeader>
            <DialogTitle>
              {confirm === "discard"
                ? "Discard unsaved changes?"
                : confirm === "publish"
                  ? "Publish this schedule?"
                  : confirm === "unpublish"
                    ? "Unpublish this schedule?"
                    : "Remove this class?"}
            </DialogTitle>
            <DialogDescription>
              {confirm === "discard"
                ? "Your changes to this class haven't been saved. The saved timetable will stay unchanged."
                : confirm === "publish"
                  ? "Students assigned to this section will see the saved draft. Any previously published timetable is replaced."
                  : confirm === "unpublish"
                    ? "Students will no longer see this timetable. Your draft classes are kept."
                    : "This removes the class from the saved draft. The published schedule stays unchanged until you publish again."}
            </DialogDescription>
          </DialogHeader>
          {confirm !== "discard" && error}
          {confirm === "remove" && draft && (
            <p className="bg-muted/40 rounded-lg p-3 text-sm">
              <span className="font-medium">{draft.subject}</span>
              <br />
              <span className="text-muted-foreground">
                {SCHEDULE_DAYS[draft.day - 1]} · {scheduleTime(draft.startTime)}{" "}
                – {scheduleTime(draft.endTime)}
              </span>
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={change.isPending}
              onClick={() => {
                setConfirm(null);
                change.reset();
              }}
            >
              {confirm === "discard" ? "Keep editing" : "Cancel"}
            </Button>
            <Button
              variant={
                confirm === "remove" || confirm === "discard"
                  ? "destructive"
                  : "default"
              }
              disabled={change.isPending}
              onClick={() => void confirmChange()}
            >
              {change.isPending
                ? "Saving…"
                : confirm === "discard"
                  ? "Discard changes"
                  : confirm === "publish"
                    ? "Publish"
                    : confirm === "unpublish"
                      ? "Unpublish"
                      : "Remove class"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
