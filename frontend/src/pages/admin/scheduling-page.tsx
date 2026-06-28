import { useMemo, useState } from "react";
import {
  CalendarClockIcon,
  MapPinIcon,
  PlusIcon,
  Trash2Icon,
  UserIcon,
  XIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldLabel } from "@/components/form/field-label";
import { cn } from "@/lib/utils";

// NOTE: This screen is a UI prototype. The timetable lives in local state only —
// there is no scheduling backend yet, so edits reset on refresh.

interface DummySection {
  id: string;
  label: string;
}

const SECTIONS: DummySection[] = [
  { id: "stem-11-a", label: "STEM 11 — A" },
  { id: "stem-11-b", label: "STEM 11 — B" },
  { id: "stem-12-a", label: "STEM 12 — A" },
  { id: "abm-11-a", label: "ABM 11 — A" },
  { id: "humss-12-a", label: "HUMSS 12 — A" },
];

const SECTION_GROUPS = [
  { label: "STEM", ids: ["stem-11-a", "stem-11-b", "stem-12-a"] },
  { label: "ABM", ids: ["abm-11-a"] },
  { label: "HUMSS", ids: ["humss-12-a"] },
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const TEACHING_SLOTS = [
  "7:30 – 8:30",
  "8:30 – 9:30",
  "9:30 – 10:30",
  "10:30 – 11:30",
  "1:00 – 2:00",
  "2:00 – 3:00",
  "3:00 – 4:00",
];
// Where the lunch break sits in the rendered rows.
const LUNCH_AFTER_INDEX = 3;

interface SubjectPreset {
  name: string;
  teacher: string;
  room: string;
  className: string;
}

const SUBJECTS: SubjectPreset[] = [
  { name: "General Mathematics", teacher: "Mr. Reyes", room: "Rm 201", className: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200" },
  { name: "Earth Science", teacher: "Ms. Santos", room: "Lab 1", className: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" },
  { name: "English", teacher: "Ms. Cruz", room: "Rm 203", className: "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-200" },
  { name: "Filipino", teacher: "Mr. Bautista", room: "Rm 205", className: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200" },
  { name: "PE & Health", teacher: "Coach Lim", room: "Gym", className: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200" },
  { name: "Practical Research", teacher: "Dr. Flores", room: "Rm 207", className: "border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-900 dark:bg-cyan-950 dark:text-cyan-200" },
  { name: "Empowerment Tech", teacher: "Mr. Tan", room: "Comp Lab", className: "border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-200" },
  { name: "Contemporary Arts", teacher: "Ms. Villar", room: "Rm 209", className: "border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-200" },
];

const CUSTOM_CLASS =
  "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200";

interface ClassEntry {
  subject: string;
  teacher: string;
  room: string;
  className: string;
}

// key = `${day}__${slot}` → entry
type Timetable = Record<string, ClassEntry>;

const cellKey = (day: string, slot: string) => `${day}__${slot}`;

// Time column + one column per weekday. Inline style so it never depends on
// Tailwind's arbitrary-value generation.
const GRID_COLUMNS = { gridTemplateColumns: "84px repeat(5, minmax(0, 1fr))" };

// A stable, distinct starting timetable per section from the subject pool, so
// the grid isn't empty on first view.
function seedTimetable(sectionId: string): Timetable {
  const seed = sectionId
    .split("")
    .reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const tt: Timetable = {};
  TEACHING_SLOTS.forEach((slot, slotIndex) => {
    DAYS.forEach((day, dayIndex) => {
      const subject = SUBJECTS[(seed + dayIndex * 3 + slotIndex) % SUBJECTS.length];
      tt[cellKey(day, slot)] = {
        subject: subject.name,
        teacher: subject.teacher,
        room: subject.room,
        className: subject.className,
      };
    });
  });
  return tt;
}

interface Draft {
  day: string;
  slot: string;
  originalKey: string | null;
  preset: string; // subject index as string, or "custom"
  subject: string;
  teacher: string;
  room: string;
}

function SchedulingPage() {
  const [sectionId, setSectionId] = useState(SECTIONS[0].id);
  const [schedules, setSchedules] = useState<Record<string, Timetable>>(() =>
    Object.fromEntries(SECTIONS.map((s) => [s.id, seedTimetable(s.id)])),
  );
  const [draft, setDraft] = useState<Draft | null>(null);

  const section = SECTIONS.find((s) => s.id === sectionId) ?? SECTIONS[0];
  const timetable = schedules[sectionId] ?? {};
  const classCount = Object.keys(timetable).length;

  const openAdd = () =>
    setDraft({
      day: DAYS[0],
      slot: TEACHING_SLOTS[0],
      originalKey: null,
      preset: "0",
      subject: SUBJECTS[0].name,
      teacher: SUBJECTS[0].teacher,
      room: SUBJECTS[0].room,
    });

  const openCell = (day: string, slot: string) => {
    const key = cellKey(day, slot);
    const entry = timetable[key];
    if (entry) {
      const idx = SUBJECTS.findIndex((s) => s.name === entry.subject);
      setDraft({
        day,
        slot,
        originalKey: key,
        preset: idx >= 0 ? String(idx) : "custom",
        subject: entry.subject,
        teacher: entry.teacher,
        room: entry.room,
      });
    } else {
      setDraft({
        day,
        slot,
        originalKey: null,
        preset: "0",
        subject: SUBJECTS[0].name,
        teacher: SUBJECTS[0].teacher,
        room: SUBJECTS[0].room,
      });
    }
  };

  const removeCell = (key: string) =>
    setSchedules((prev) => {
      const tt = { ...prev[sectionId] };
      delete tt[key];
      return { ...prev, [sectionId]: tt };
    });

  const saveDraft = () => {
    if (!draft || draft.subject.trim() === "") return;
    const className =
      draft.preset === "custom" ? CUSTOM_CLASS : SUBJECTS[Number(draft.preset)].className;
    const entry: ClassEntry = {
      subject: draft.subject.trim(),
      teacher: draft.teacher.trim() || "—",
      room: draft.room.trim() || "—",
      className,
    };
    const key = cellKey(draft.day, draft.slot);
    setSchedules((prev) => {
      const tt = { ...prev[sectionId] };
      if (draft.originalKey && draft.originalKey !== key) delete tt[draft.originalKey];
      tt[key] = entry;
      return { ...prev, [sectionId]: tt };
    });
    setDraft(null);
  };

  // Rows to render: teaching slots, with a lunch divider inserted.
  const rows = useMemo(() => {
    const out: ({ type: "slot"; slot: string } | { type: "lunch" })[] = [];
    TEACHING_SLOTS.forEach((slot, i) => {
      out.push({ type: "slot", slot });
      if (i === LUNCH_AFTER_INDEX) out.push({ type: "lunch" });
    });
    return out;
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            Scheduling
            <Badge variant="secondary" className="font-normal">
              Preview
            </Badge>
          </h1>
          <p className="text-muted-foreground text-sm">
            Build a weekly class timetable per section. UI preview with sample
            data — edits aren't saved to a backend yet.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={sectionId} onValueChange={setSectionId}>
            <SelectTrigger className="w-fit min-w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SECTION_GROUPS.map((group) => (
                <SelectGroup key={group.label}>
                  <SelectLabel>{group.label}</SelectLabel>
                  {group.ids.map((id) => (
                    <SelectItem key={id} value={id}>
                      {SECTIONS.find((x) => x.id === id)!.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={openAdd}>
            <PlusIcon />
            Add class
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClockIcon className="size-4" />
            {section.label}
          </CardTitle>
          <CardDescription>
            School Year 2026–2027 · {classCount}{" "}
            {classCount === 1 ? "class" : "classes"} scheduled
          </CardDescription>
          <CardAction>
            <span className="text-muted-foreground hidden text-xs sm:inline">
              Click a cell to edit
            </span>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div>
            <div className="grid gap-2" style={GRID_COLUMNS}>
              <div className="text-muted-foreground px-1 py-2 text-xs font-medium tracking-wide uppercase">
                Time
              </div>
              {DAYS.map((day) => (
                <div
                  key={day}
                  className="px-1 py-2 text-center text-xs font-semibold tracking-wide uppercase"
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="space-y-2">
                {rows.map((row) =>
                  row.type === "lunch" ? (
                    <div
                      key="lunch"
                      className="bg-muted/50 text-muted-foreground flex items-center justify-center rounded-md py-2 text-xs font-medium tracking-wide uppercase"
                    >
                      Lunch break · 12:00
                    </div>
                  ) : (
                    <div key={row.slot} className="grid gap-2" style={GRID_COLUMNS}>
                      <div className="text-muted-foreground flex items-center px-1 text-xs whitespace-nowrap">
                        {row.slot}
                      </div>
                      {DAYS.map((day) => {
                        const key = cellKey(day, row.slot);
                        const entry = timetable[key];
                        return (
                          <ScheduleCell
                            key={key}
                            entry={entry}
                            onClick={() => openCell(day, row.slot)}
                            onRemove={() => removeCell(key)}
                          />
                        );
                      })}
                    </div>
                  ),
                )}
            </div>
          </div>
        </CardContent>
      </Card>

      <ScheduleDialog
        draft={draft}
        onChange={setDraft}
        onClose={() => setDraft(null)}
        onSave={saveDraft}
        onRemove={
          draft?.originalKey
            ? () => {
                removeCell(draft.originalKey!);
                setDraft(null);
              }
            : undefined
        }
      />
    </div>
  );
}

function ScheduleCell({
  entry,
  onClick,
  onRemove,
}: {
  entry: ClassEntry | undefined;
  onClick: () => void;
  onRemove: () => void;
}) {
  // Drive hover with state instead of a `group-hover:` class — that avoids
  // depending on Tailwind's JIT having generated a brand-new utility.
  const [hovered, setHovered] = useState(false);

  if (!entry) {
    return (
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="text-muted-foreground/60 hover:text-foreground hover:border-foreground/40 flex min-h-18 items-center justify-center rounded-md border border-dashed transition-colors"
      >
        <PlusIcon
          className={cn(
            "size-4 transition-opacity",
            hovered ? "opacity-100" : "opacity-0",
          )}
        />
      </button>
    );
  }

  return (
    <div
      className={cn(
        "relative min-h-18 rounded-md border p-2 text-xs",
        entry.className,
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Full-cell edit hit-area, behind the text. */}
      <button
        type="button"
        onClick={onClick}
        className="absolute inset-0 z-0 rounded-md"
        aria-label={`Edit ${entry.subject}`}
      />

      {/* Class details — clicks fall through to the edit button behind. */}
      <div className="pointer-events-none relative z-10 flex h-full flex-col gap-0.5">
        <span className="pr-5 font-semibold leading-tight">{entry.subject}</span>
        <span className="mt-auto flex items-center gap-1 opacity-80">
          <UserIcon className="size-3 shrink-0" />
          <span className="truncate">{entry.teacher}</span>
        </span>
        <span className="flex items-center gap-1 opacity-80">
          <MapPinIcon className="size-3 shrink-0" />
          <span className="truncate">{entry.room}</span>
        </span>
      </div>

      {/* Remove: top-right corner, shown while the cell is hovered. */}
      {hovered && (
        <button
          type="button"
          onClick={onRemove}
          style={{ position: "absolute", top: "0.25rem", right: "0.25rem", zIndex: 20 }}
          className="border-border bg-background text-muted-foreground hover:text-destructive flex size-5 items-center justify-center rounded-full border shadow-sm"
          aria-label={`Remove ${entry.subject}`}
        >
          <XIcon className="size-3" />
        </button>
      )}
    </div>
  );
}

function ScheduleDialog({
  draft,
  onChange,
  onClose,
  onSave,
  onRemove,
}: {
  draft: Draft | null;
  onChange: (draft: Draft) => void;
  onClose: () => void;
  onSave: () => void;
  onRemove?: () => void;
}) {
  const set = (patch: Partial<Draft>) => draft && onChange({ ...draft, ...patch });

  const choosePreset = (value: string) => {
    if (!draft) return;
    if (value === "custom") {
      onChange({ ...draft, preset: "custom" });
      return;
    }
    const subject = SUBJECTS[Number(value)];
    onChange({
      ...draft,
      preset: value,
      subject: subject.name,
      teacher: subject.teacher,
      room: subject.room,
    });
  };

  return (
    <Dialog open={draft !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {draft?.originalKey ? "Edit class" : "Add class"}
          </DialogTitle>
          <DialogDescription>
            Place a class in the weekly timetable. (Local preview only.)
          </DialogDescription>
        </DialogHeader>

        {draft && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel required>Day</FieldLabel>
              <Select value={draft.day} onValueChange={(v) => set({ day: v })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((day) => (
                    <SelectItem key={day} value={day}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <FieldLabel required>Time</FieldLabel>
              <Select value={draft.slot} onValueChange={(v) => set({ slot: v })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEACHING_SLOTS.map((slot) => (
                    <SelectItem key={slot} value={slot}>
                      {slot}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <FieldLabel required>Subject</FieldLabel>
              <Select value={draft.preset} onValueChange={choosePreset}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECTS.map((subject, index) => (
                    <SelectItem key={subject.name} value={String(index)}>
                      {subject.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom…</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {draft.preset === "custom" && (
              <div className="space-y-1.5 sm:col-span-2">
                <FieldLabel required>Subject name</FieldLabel>
                <Input
                  value={draft.subject}
                  placeholder="e.g. Statistics & Probability"
                  onChange={(e) => set({ subject: e.target.value })}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <FieldLabel>Teacher</FieldLabel>
              <Input
                value={draft.teacher}
                onChange={(e) => set({ teacher: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Room</FieldLabel>
              <Input
                value={draft.room}
                onChange={(e) => set({ room: e.target.value })}
              />
            </div>
          </div>
        )}

        <DialogFooter className="sm:justify-between">
          {onRemove ? (
            <Button
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              onClick={onRemove}
            >
              <Trash2Icon />
              Remove
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={onSave}
              disabled={!draft || draft.subject.trim() === ""}
            >
              {draft?.originalKey ? "Save" : "Add class"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SchedulingPage;
