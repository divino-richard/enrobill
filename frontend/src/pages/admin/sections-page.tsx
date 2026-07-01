import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  ArmchairIcon,
  ArrowRightLeftIcon,
  LayoutGridIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  UserMinusIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { getErrorMessage } from "@/lib/get-error-message";
import { useTerms } from "@/features/terms/hooks";
import { useProgramGroups, useProgramLabel } from "@/features/programs/hooks";
import { YEAR_LEVEL_OPTIONS, labelFor } from "@/features/applications/types";
import {
  useAssignSection,
  useCreateSection,
  useDeleteSection,
  useSections,
  useUnsectionedStudents,
  useUpdateSection,
} from "@/features/sections/hooks";
import type {
  Section,
  SectionStudent,
  UnsectionedStudent,
} from "@/features/sections/types";

type Selection = number | "unsectioned" | null;

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-card flex items-center gap-3 rounded-xl border p-4">
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          accent
            ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
            : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-4.5" />
      </div>
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {label}
        </p>
        <p
          className={cn(
            "text-lg leading-tight font-semibold tabular-nums",
            accent && "text-amber-600 dark:text-amber-400",
          )}
        >
          {value}
        </p>
        {hint && <p className="text-muted-foreground truncate text-xs">{hint}</p>}
      </div>
    </div>
  );
}

function OccupancyBar({
  used,
  total,
  className,
}: {
  used: number;
  total: number;
  className?: string;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const full = used >= total;
  return (
    <div
      className={cn("bg-muted h-1.5 w-full overflow-hidden rounded-full", className)}
    >
      <div
        className={cn("h-full rounded-full", full ? "bg-amber-500" : "bg-primary")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className="text-muted-foreground font-normal capitalize"
    >
      {status}
    </Badge>
  );
}

// Dropdown of candidate sections (same program/grade, with space).
function SectionPicker({
  label,
  targets,
  disabled,
  trigger,
  onPick,
}: {
  label: string;
  targets: Section[];
  disabled?: boolean;
  trigger: React.ReactNode;
  onPick: (sectionId: number) => void;
}) {
  const programLabel = useProgramLabel();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        {trigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52 w-fit">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {targets.length === 0 ? (
          <DropdownMenuItem disabled>No section with space</DropdownMenuItem>
        ) : (
          targets.map((target) => (
            <DropdownMenuItem key={target.id} onClick={() => onPick(target.id)}>
              {programLabel(target.program)} — {target.name}
              <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                {target.assignedCount}/{target.capacity}
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SectionFormDialog({
  open,
  onOpenChange,
  schoolYearId,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolYearId: number | null;
  editing: Section | null;
}) {
  const groups = useProgramGroups();
  const create = useCreateSection();
  const update = useUpdateSection(editing?.id ?? 0);
  const mutation = editing ? update : create;

  const [program, setProgram] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("40");

  useEffect(() => {
    if (!open) return;
    setProgram(editing?.program ?? "");
    setYearLevel(editing?.yearLevel ?? "");
    setName(editing?.name ?? "");
    setCapacity(String(editing?.capacity ?? 40));
    mutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const capacityNum = Number(capacity);
  const canSave =
    Boolean(program) &&
    Boolean(yearLevel) &&
    name.trim() !== "" &&
    capacityNum >= 1;

  async function handleSave() {
    if (!canSave) return;
    try {
      if (editing) {
        await update.mutateAsync({ name: name.trim(), capacity: capacityNum });
      } else {
        if (!schoolYearId) return;
        await create.mutateAsync({
          schoolYearId,
          program,
          yearLevel,
          name: name.trim(),
          capacity: capacityNum,
        });
      }
      onOpenChange(false);
    } catch {
      // Surfaced via mutation.isError.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit section" : "New section"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Rename the section or adjust its capacity."
              : "Sections are scoped to a program and grade within the selected school year."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <FieldLabel required>Program</FieldLabel>
            <Select
              value={program}
              onValueChange={setProgram}
              disabled={Boolean(editing)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select program" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((group) => (
                  <SelectGroup key={group.label}>
                    <SelectLabel>{group.label}</SelectLabel>
                    {group.options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Grade</FieldLabel>
            <Select
              value={yearLevel}
              onValueChange={setYearLevel}
              disabled={Boolean(editing)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select grade" />
              </SelectTrigger>
              <SelectContent>
                {YEAR_LEVEL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Section name</FieldLabel>
            <Input
              value={name}
              placeholder="e.g. A"
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Capacity</FieldLabel>
            <Input
              type="number"
              min={1}
              max={500}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
          </div>
        </div>

        {mutation.isError && (
          <p className="text-destructive text-sm">
            {getErrorMessage(mutation.error)}
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave || mutation.isPending}>
            {mutation.isPending
              ? "Saving…"
              : editing
                ? "Save changes"
                : "Create section"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// A selectable row in the left-hand sections list.
function SectionListItem({
  section,
  selected,
  onSelect,
}: {
  section: Section;
  selected: boolean;
  onSelect: () => void;
}) {
  const programLabel = useProgramLabel();
  const full = section.assignedCount >= section.capacity;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-lg border p-3 text-left transition-colors",
        selected
          ? "border-primary bg-primary/5"
          : "hover:bg-muted/50 border-border",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">
          {programLabel(section.program)} — {section.name}
        </span>
        <span
          className={cn(
            "shrink-0 text-xs tabular-nums",
            full ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
          )}
        >
          {section.assignedCount}/{section.capacity}
        </span>
      </div>
      <p className="text-muted-foreground mt-0.5 text-xs">
        {labelFor(YEAR_LEVEL_OPTIONS, section.yearLevel)}
      </p>
      <OccupancyBar
        used={section.assignedCount}
        total={section.capacity}
        className="mt-2"
      />
    </button>
  );
}

// The detail panel for a selected section: header stats + roster table.
function SectionDetail({
  section,
  allSections,
  unsectioned,
  onEdit,
  onDelete,
}: {
  section: Section;
  allSections: Section[];
  unsectioned: UnsectionedStudent[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const programLabel = useProgramLabel();
  const assign = useAssignSection();

  const moveTargets = allSections.filter(
    (s) =>
      s.id !== section.id &&
      s.program === section.program &&
      s.yearLevel === section.yearLevel &&
      s.assignedCount < s.capacity,
  );
  const addable = unsectioned.filter(
    (u) => u.program === section.program && u.yearLevel === section.yearLevel,
  );
  const hasSpace = section.assignedCount < section.capacity;
  const pct =
    section.capacity > 0
      ? Math.round((section.assignedCount / section.capacity) * 100)
      : 0;

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base">
              {programLabel(section.program)} — {section.name}
            </CardTitle>
            <CardDescription>
              {labelFor(YEAR_LEVEL_OPTIONS, section.yearLevel)} ·{" "}
              {section.assignedCount} of {section.capacity} seats filled ({pct}%)
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                asChild
                disabled={!hasSpace || addable.length === 0 || assign.isPending}
              >
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasSpace || addable.length === 0}
                >
                  <UserPlusIcon />
                  Add students
                  {addable.length > 0 && (
                    <Badge variant="secondary" className="ml-1 font-normal">
                      {addable.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-56 w-fit">
                <DropdownMenuLabel>Add to {section.name}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {addable.map((student) => (
                  <DropdownMenuItem
                    key={student.enrollmentId}
                    onClick={() =>
                      assign.mutate({
                        enrollmentId: student.enrollmentId,
                        sectionId: section.id,
                      })
                    }
                  >
                    {student.name}
                    <span className="text-muted-foreground ml-auto text-xs">
                      {student.studentNumber ?? "—"}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="icon-sm" onClick={onEdit}>
              <PencilIcon />
              <span className="sr-only">Edit section</span>
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2Icon />
              <span className="sr-only">Delete section</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {section.students.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <div className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full">
              <UsersIcon className="size-5" />
            </div>
            <p className="text-sm font-medium">No students yet</p>
            <p className="text-muted-foreground max-w-xs text-xs">
              Students are placed here automatically when they enrol, or add them
              from the unsectioned list.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Move</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {section.students.map((student) => (
                <RosterRow
                  key={student.enrollmentId}
                  student={student}
                  moveTargets={moveTargets}
                  busy={assign.isPending}
                  onMove={(sectionId) =>
                    assign.mutate({
                      enrollmentId: student.enrollmentId,
                      sectionId,
                    })
                  }
                />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function RosterRow({
  student,
  moveTargets,
  busy,
  onMove,
}: {
  student: SectionStudent;
  moveTargets: Section[];
  busy: boolean;
  onMove: (sectionId: number | null) => void;
}) {
  const programLabel = useProgramLabel();
  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium">{student.name}</span>
          <span className="text-muted-foreground text-xs">
            {student.studentNumber ?? "—"}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <StatusChip status={student.status} />
      </TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={busy}>
            <Button variant="ghost" size="icon-sm">
              <ArrowRightLeftIcon />
              <span className="sr-only">Move {student.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52 w-fit">
            <DropdownMenuLabel>Move to</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {moveTargets.length === 0 ? (
              <DropdownMenuItem disabled>
                No other section with space
              </DropdownMenuItem>
            ) : (
              moveTargets.map((target) => (
                <DropdownMenuItem
                  key={target.id}
                  onClick={() => onMove(target.id)}
                >
                  {programLabel(target.program)} — {target.name}
                  <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                    {target.assignedCount}/{target.capacity}
                  </span>
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => onMove(null)}>
              <UserMinusIcon />
              Remove from section
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

// The detail panel for the "Unsectioned" bucket.
function UnsectionedDetail({
  students,
  sections,
}: {
  students: UnsectionedStudent[];
  sections: Section[];
}) {
  const programLabel = useProgramLabel();
  const assign = useAssignSection();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Unsectioned students</CardTitle>
        <CardDescription>
          Enrolled students with no section yet — no matching section had space
          when they enrolled. Assign each to a section below.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Program / Grade</TableHead>
              <TableHead className="text-right">Assign</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((student) => {
              const targets = sections.filter(
                (s) =>
                  s.program === student.program &&
                  s.yearLevel === student.yearLevel &&
                  s.assignedCount < s.capacity,
              );
              return (
                <TableRow key={student.enrollmentId}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{student.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {student.studentNumber ?? "—"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {programLabel(student.program, student.yearLevel)}
                  </TableCell>
                  <TableCell className="text-right">
                    <SectionPicker
                      label="Assign to"
                      targets={targets}
                      disabled={assign.isPending}
                      onPick={(sectionId) =>
                        assign.mutate({
                          enrollmentId: student.enrollmentId,
                          sectionId,
                        })
                      }
                      trigger={
                        <Button variant="outline" size="sm">
                          <UserPlusIcon />
                          Assign
                        </Button>
                      }
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function SectionsPage() {
  const { data: terms } = useTerms();
  const schoolYears = terms ?? [];
  const programGroups = useProgramGroups();

  const [schoolYearId, setSchoolYearId] = useState<number | null>(null);
  const [program, setProgram] = useState<string>("all");
  const [yearLevel, setYearLevel] = useState<string>("all");
  const [selected, setSelected] = useState<Selection>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Section | null>(null);
  const [deleting, setDeleting] = useState<Section | null>(null);

  useEffect(() => {
    if (schoolYearId === null && schoolYears.length > 0) {
      const active = schoolYears.find((sy) => sy.isActive) ?? schoolYears[0];
      setSchoolYearId(active.id);
    }
  }, [schoolYears, schoolYearId]);

  const filters = useMemo(
    () => ({
      schoolYearId: schoolYearId ?? undefined,
      program: program === "all" ? undefined : program,
      yearLevel: yearLevel === "all" ? undefined : yearLevel,
    }),
    [schoolYearId, program, yearLevel],
  );

  const sectionsQuery = useSections(filters);
  const unsectionedQuery = useUnsectionedStudents(filters);
  const remove = useDeleteSection();

  const sections = useMemo(() => sectionsQuery.data ?? [], [sectionsQuery.data]);
  const unsectioned = useMemo(
    () => unsectionedQuery.data ?? [],
    [unsectionedQuery.data],
  );

  // Keep the current selection valid as data/filters change.
  useEffect(() => {
    const validSection =
      typeof selected === "number" && sections.some((s) => s.id === selected);
    if (validSection) return;
    if (selected === "unsectioned" && unsectioned.length > 0) return;
    if (sections.length > 0) setSelected(sections[0].id);
    else if (unsectioned.length > 0) setSelected("unsectioned");
    else setSelected(null);
  }, [sections, unsectioned, selected]);

  const totals = useMemo(() => {
    const capacity = sections.reduce((sum, s) => sum + s.capacity, 0);
    const assigned = sections.reduce((sum, s) => sum + s.assignedCount, 0);
    return { capacity, assigned };
  }, [sections]);

  const selectedSection =
    typeof selected === "number"
      ? sections.find((s) => s.id === selected)
      : undefined;

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(section: Section) {
    setEditing(section);
    setFormOpen(true);
  }

  const isLoading = sectionsQuery.isLoading;
  const isEmpty = !isLoading && sections.length === 0 && unsectioned.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sections</h1>
          <p className="text-muted-foreground text-sm">
            Class sections per program and grade. Students are placed
            automatically when they enrol; move them as needed.
          </p>
        </div>
        <Button onClick={openCreate} disabled={!schoolYearId}>
          <PlusIcon />
          New section
        </Button>
      </div>

      {/* At-a-glance */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={LayoutGridIcon}
          label="Sections"
          value={sections.length}
          hint="in this scope"
        />
        <StatTile
          icon={ArmchairIcon}
          label="Seats"
          value={totals.capacity}
          hint="total capacity"
        />
        <StatTile
          icon={UsersIcon}
          label="Assigned"
          value={totals.assigned}
          hint={
            totals.capacity > 0
              ? `${Math.round((totals.assigned / totals.capacity) * 100)}% of capacity`
              : "—"
          }
        />
        <StatTile
          icon={UserMinusIcon}
          label="Unsectioned"
          value={unsectioned.length}
          hint="awaiting a section"
          accent={unsectioned.length > 0}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={schoolYearId ? String(schoolYearId) : ""}
          onValueChange={(v) => setSchoolYearId(Number(v))}
        >
          <SelectTrigger className="w-fit min-w-44">
            <SelectValue placeholder="School year" />
          </SelectTrigger>
          <SelectContent>
            {schoolYears.map((sy) => (
              <SelectItem key={sy.id} value={String(sy.id)}>
                SY {sy.schoolYear}
                {sy.isActive ? " - active" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={program} onValueChange={setProgram}>
          <SelectTrigger className="w-fit min-w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All programs</SelectItem>
            {programGroups.map((group) => (
              <SelectGroup key={group.label}>
                <SelectLabel>{group.label}</SelectLabel>
                {group.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>

        <Select value={yearLevel} onValueChange={setYearLevel}>
          <SelectTrigger className="w-fit min-w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All grades</SelectItem>
            {YEAR_LEVEL_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="space-y-2">
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
            <LayoutGridIcon className="size-6" />
          </div>
          <div className="space-y-1">
            <p className="font-medium">No sections yet</p>
            <p className="text-muted-foreground mx-auto max-w-sm text-sm">
              Create a section for a program and grade, then enrolled students
              are placed into it automatically.
            </p>
          </div>
          <Button variant="outline" onClick={openCreate} disabled={!schoolYearId}>
            <PlusIcon />
            New section
          </Button>
        </div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[320px_1fr]">
          {/* Sections list */}
          <div className="space-y-2">
            {unsectioned.length > 0 && (
              <button
                type="button"
                onClick={() => setSelected("unsectioned")}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg border p-3 text-left transition-colors",
                  selected === "unsectioned"
                    ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40"
                    : "hover:bg-muted/50 border-dashed",
                )}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <UserMinusIcon className="size-4 text-amber-600 dark:text-amber-400" />
                  Unsectioned
                </span>
                <Badge
                  variant="outline"
                  className="border-amber-300 bg-amber-100 font-normal text-amber-700 tabular-nums dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
                >
                  {unsectioned.length}
                </Badge>
              </button>
            )}

            {sections.length === 0 ? (
              <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-6 text-center text-sm">
                No sections match these filters.
              </p>
            ) : (
              sections.map((section) => (
                <SectionListItem
                  key={section.id}
                  section={section}
                  selected={selected === section.id}
                  onSelect={() => setSelected(section.id)}
                />
              ))
            )}
          </div>

          {/* Detail */}
          <div>
            {selectedSection ? (
              <SectionDetail
                section={selectedSection}
                allSections={sections}
                unsectioned={unsectioned}
                onEdit={() => openEdit(selectedSection)}
                onDelete={() => setDeleting(selectedSection)}
              />
            ) : selected === "unsectioned" ? (
              <UnsectionedDetail students={unsectioned} sections={sections} />
            ) : (
              <Card>
                <CardContent className="text-muted-foreground py-16 text-center text-sm">
                  Select a section to view its roster.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      <SectionFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        schoolYearId={schoolYearId}
        editing={editing}
      />

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this section?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? `"${deleting.name}" will be removed and its ${deleting.assignedCount} student${deleting.assignedCount === 1 ? "" : "s"} returned to the unsectioned list.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (deleting) {
                  remove.mutate(deleting.id, {
                    onSuccess: () => setDeleting(null),
                  });
                }
              }}
            >
              {remove.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default SectionsPage;
