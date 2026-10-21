import { DashboardMetricStrip } from "@/components/dashboard/dashboard-primitives";
import { CompactProgramLabel } from "@/components/compact-program-label";
import { PageHeader } from "@/components/page-header";
import { useMemo, useRef, useState } from "react";
import {
  MoreHorizontalIcon,
  MoreVerticalIcon,
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
  DialogTrigger,
  DialogClose,
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
import { useUsers } from "@/features/users/hooks";
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
import { getSectionAssignmentState } from "@/features/sections/assignment-state";
import { AddStudentsContent } from "@/features/sections/add-students-content";
import { MoveStudentForm } from "@/features/sections/move-student-form";

type Selection = number | "unsectioned" | null;

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit section" : "New section"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update the section name, capacity, or adviser."
              : "Sections are scoped to a program and grade within the selected school year."}
          </DialogDescription>
        </DialogHeader>
        {/* Mounted fresh per open, and re-keyed per target, so the fields seed
            straight from `editing` instead of an effect syncing them after. */}
        {open && (
          <SectionForm
            key={editing?.id ?? "new"}
            schoolYearId={schoolYearId}
            editing={editing}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SectionForm({
  schoolYearId,
  editing,
  onDone,
}: {
  schoolYearId: number | null;
  editing: Section | null;
  onDone: () => void;
}) {
  const groups = useProgramGroups();
  const teachers = useUsers({ role: "teacher", perPage: 100, sort: "name", dir: "asc" });
  const create = useCreateSection();
  const update = useUpdateSection(editing?.id ?? 0);
  const mutation = editing ? update : create;

  const [program, setProgram] = useState(editing?.program ?? "");
  const [yearLevel, setYearLevel] = useState(editing?.yearLevel ?? "");
  const [name, setName] = useState(editing?.name ?? "");
  const [capacity, setCapacity] = useState(String(editing?.capacity ?? 30));
  const [adviserTeacherId, setAdviserTeacherId] = useState(
    editing?.adviser ? String(editing.adviser.id) : "none",
  );

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
        await update.mutateAsync({
          name: name.trim(),
          capacity: capacityNum,
          adviserTeacherId: adviserTeacherId === "none" ? null : Number(adviserTeacherId),
        });
      } else {
        if (!schoolYearId) return;
        await create.mutateAsync({
          schoolYearId,
          program,
          yearLevel,
          name: name.trim(),
          capacity: capacityNum,
          adviserTeacherId: adviserTeacherId === "none" ? null : Number(adviserTeacherId),
        });
      }
      onDone();
    } catch {
      // Surfaced via mutation.isError.
    }
  }

  return (
    <>
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

          <div className="space-y-1.5 sm:col-span-2">
            <FieldLabel>Section adviser</FieldLabel>
            <Select
              value={adviserTeacherId}
              onValueChange={setAdviserTeacherId}
              disabled={teachers.isLoading || teachers.isError}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select adviser" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No adviser assigned</SelectItem>
                {teachers.data?.rows.map((teacher) => (
                  <SelectItem key={teacher.id} value={String(teacher.id)}>
                    {teacher.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              Only the adviser can view this roster and upload student grade slips.
            </p>
            {teachers.isError && (
              <p className="text-destructive text-xs">Teachers could not be loaded.</p>
            )}
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
            onClick={onDone}
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
    </>
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
        "w-full rounded-lg border border-l-4 border-l-chart-3 p-3 text-left transition-colors",
        selected
          ? "border-primary border-l-chart-3 bg-primary/5"
          : "bg-card hover:bg-muted/50 border-border border-l-chart-3",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">
          <CompactProgramLabel label={programLabel(section.program)} /> · {section.name}
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
      <p className="text-muted-foreground mt-0.5 truncate text-xs">
        {section.adviser?.name ?? "No adviser"}
      </p>
      <OccupancyBar
        used={section.assignedCount}
        total={section.capacity}
        className="mt-2"
      />
    </button>
  );
}

// The detail panel for a selected section: identity, actions and roster.
function SectionDetail({
  section,
  allSections,
  unsectioned,
  studentsLoading,
  studentsError,
  onRetryStudents,
  onEdit,
  onDelete,
}: {
  section: Section;
  allSections: Section[];
  unsectioned: UnsectionedStudent[];
  studentsLoading: boolean;
  studentsError: string | null;
  onRetryStudents: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const programLabel = useProgramLabel();
  const assign = useAssignSection();
  const [addOpen, setAddOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [assignmentAction, setAssignmentAction] = useState<{
    kind: "move" | "remove";
    student: SectionStudent;
  } | null>(null);
  const [destinationId, setDestinationId] = useState<number | null>(null);
  const assignmentTrigger = useRef<HTMLButtonElement | null>(null);
  const addTrigger = useRef<HTMLButtonElement>(null);
  const sectionProgramName = programLabel(section.program);
  const compactProgramName = sectionProgramName.replace(/\s*\([^)]*\)/g, "").trim() || sectionProgramName;

  const { moveTargets, addable, moveUnavailableTitle, moveUnavailableReason } = getSectionAssignmentState(
    section, allSections, unsectioned,
  );

  async function changeAssignment(student: SectionStudent | UnsectionedStudent, sectionId: number | null) {
    if (assign.isPending) return;
    setFeedback("");
    try {
      await assign.mutateAsync({ enrollmentId: student.enrollmentId, sectionId });
      const target = allSections.find(candidate => candidate.id === sectionId);
      setFeedback(sectionId === null
        ? `${student.name} is now unsectioned and remains enrolled.`
        : `${student.name} was assigned to ${programLabel(target?.program)} · ${target?.name}.`);
      setAddOpen(false);
      setAssignmentAction(null);
    } catch {
      // Keep the dialog open and show the server's validation error.
    }
  }

  function openAssignmentAction(kind: "move" | "remove", student: SectionStudent, trigger: HTMLButtonElement | null) {
    assign.reset();
    assignmentTrigger.current = trigger;
    setDestinationId(null);
    setAssignmentAction({ kind, student });
  }

  function restoreAssignmentFocus(event: Event) {
    event.preventDefault();
    const trigger = assignmentTrigger.current;
    if (trigger?.isConnected) trigger.focus();
    else addTrigger.current?.focus();
  }

  return (
    <Card className="gap-0 overflow-hidden rounded-none border-0 py-0 shadow-none">
      <header className="@container/section-header border-b px-4 py-4">
        <div className="grid items-start gap-4 @xl/section-header:grid-cols-[minmax(0,1fr)_auto] @xl/section-header:gap-6">
          <div className="min-w-0">
            <h2 className="break-words text-lg leading-6 font-semibold">
              <span title={sectionProgramName} aria-label={sectionProgramName}>{compactProgramName}</span> · {section.name}
            </h2>
            <p className="mt-1 flex items-baseline gap-2 text-sm leading-5">
              <span className="shrink-0 text-muted-foreground">Adviser</span>
              <span className="min-w-0 break-words">{section.adviser?.name ?? "Not assigned"}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
          <Dialog open={addOpen} onOpenChange={open => {
            if (assign.isPending) return;
            setAddOpen(open);
            if (open) assign.reset();
          }}>
            <DialogTrigger asChild>
              <Button ref={addTrigger} variant="outline" size="sm" disabled={assign.isPending}><UserPlusIcon />Add students</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90svh] w-[calc(100%-2rem)] overflow-y-auto" showCloseButton={!assign.isPending}>
              <DialogHeader>
                <DialogTitle>Add students to {compactProgramName} · {section.name}</DialogTitle>
                <DialogDescription>
                  {compactProgramName} · {labelFor(YEAR_LEVEL_OPTIONS, section.yearLevel)}
                </DialogDescription>
              </DialogHeader>
              <div aria-busy={assign.isPending}>
                <AddStudentsContent
                  students={addable}
                  availableSeats={Math.max(0, section.capacity - section.assignedCount)}
                  loading={studentsLoading}
                  error={studentsError}
                  busy={assign.isPending}
                  onRetry={onRetryStudents}
                  onAdd={student => void changeAssignment(student, section.id)}
                />
                {assign.isPending && <p role="status" className="mt-3 text-sm text-muted-foreground">Adding student…</p>}
                {assign.isError && <p role="alert" className="mt-3 text-sm text-destructive">{getErrorMessage(assign.error)}</p>}
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline" disabled={assign.isPending}>Close</Button></DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" disabled={assign.isPending} aria-label={`Section settings for ${compactProgramName} · ${section.name}`}><MoreVerticalIcon /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              <DropdownMenuItem onClick={onEdit}><PencilIcon />Edit section</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} variant="destructive"><Trash2Icon />Delete section</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>
        <p role="status" className={feedback ? "mt-3 text-sm text-muted-foreground" : "sr-only"}>{feedback}</p>
        {assign.isError && !addOpen && !assignmentAction && <p role="alert" className="mt-3 text-sm text-destructive">{getErrorMessage(assign.error)}</p>}
      </header>
      <CardContent className="px-0 pb-0">
        {section.students.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <div className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full">
              <UsersIcon className="size-5" />
            </div>
            <p className="text-sm font-medium">No students yet</p>
            <p className="text-muted-foreground max-w-xs text-xs">
              Students are placed here automatically when they enroll, or add them
              from the unsectioned list.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20 text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {section.students.map((student) => (
                <RosterRow
                  key={student.enrollmentId}
                  student={student}
                  busy={assign.isPending}
                  onMove={trigger => openAssignmentAction("move", student, trigger)}
                  onRemove={trigger => openAssignmentAction("remove", student, trigger)}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <Dialog
        open={assignmentAction?.kind === "move"}
        onOpenChange={open => { if (!open && !assign.isPending) setAssignmentAction(null); }}
      >
        <DialogContent
          className="max-h-[90svh] w-[calc(100%-2rem)] overflow-y-auto"
          showCloseButton={!assign.isPending}
          onCloseAutoFocus={restoreAssignmentFocus}
        >
          <DialogHeader>
            <DialogTitle>Move to another section</DialogTitle>
            <DialogDescription>
              {assignmentAction?.student.name} is currently in {compactProgramName} · {section.name}.
              {moveTargets.length > 0 && " Choose their new section below."}
            </DialogDescription>
          </DialogHeader>
          <MoveStudentForm
            targets={moveTargets}
            unavailableTitle={moveUnavailableTitle}
            unavailableReason={moveUnavailableReason}
            selectedId={destinationId}
            busy={assign.isPending}
            error={assign.isError ? getErrorMessage(assign.error) : null}
            onSelect={setDestinationId}
            onCancel={() => setAssignmentAction(null)}
            onMove={sectionId => {
              if (assignmentAction) void changeAssignment(assignmentAction.student, sectionId);
            }}
          />
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={assignmentAction?.kind === "remove"}
        onOpenChange={open => { if (!open && !assign.isPending) setAssignmentAction(null); }}
      >
        <AlertDialogContent onCloseAutoFocus={restoreAssignmentFocus}>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this section assignment?</AlertDialogTitle>
            <AlertDialogDescription>
              {assignmentAction?.student.name} will leave {section.program.toUpperCase()} · {section.name} and
              return to the Unsectioned list. They will stay enrolled and can be assigned to another matching section.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {assign.isError && <p role="alert" className="text-sm text-destructive">{getErrorMessage(assign.error)}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={assign.isPending}>Keep assignment</AlertDialogCancel>
            <AlertDialogAction
              disabled={assign.isPending}
              onClick={event => {
                event.preventDefault();
                if (assignmentAction) void changeAssignment(assignmentAction.student, null);
              }}
            >{assign.isPending ? "Removing…" : "Remove from section"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function RosterRow({
  student,
  busy,
  onMove,
  onRemove,
}: {
  student: SectionStudent;
  busy: boolean;
  onMove: (trigger: HTMLButtonElement | null) => void;
  onRemove: (trigger: HTMLButtonElement | null) => void;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const openingDialog = useRef(false);
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
      <TableCell className="w-20 text-center">
        <DropdownMenu onOpenChange={open => { if (open) openingDialog.current = false; }}>
          <DropdownMenuTrigger asChild disabled={busy}>
            <Button
              ref={trigger}
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground"
              aria-label={`Actions for ${student.name}`}
            >
              <MoreHorizontalIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-44 max-w-[calc(100vw-2rem)]"
            onCloseAutoFocus={event => { if (openingDialog.current) event.preventDefault(); }}
          >
            <DropdownMenuItem onSelect={() => {
              openingDialog.current = true;
              onMove(trigger.current);
            }} className="min-h-11">
              <ArrowRightLeftIcon />Move
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => {
              openingDialog.current = true;
              onRemove(trigger.current);
            }} className="min-h-11">
              <UserMinusIcon />Remove
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

function SchoolYearLabel({ schoolYear, isActive }: { schoolYear: string; isActive: boolean }) {
  return (
    <span className="inline-flex items-center gap-2" title={isActive ? "Active school year" : undefined}>
      <span>SY {schoolYear}</span>
      {isActive && <>
        <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
        <span className="sr-only"> (active)</span>
      </>}
    </span>
  );
}

function SectionsPage() {
  const { data: terms } = useTerms();
  const schoolYears = useMemo(() => terms ?? [], [terms]);
  const programGroups = useProgramGroups();

  // What the user explicitly picked; `null` means "hasn't picked yet".
  const [pickedSchoolYearId, setPickedSchoolYearId] = useState<number | null>(
    null,
  );
  const [program, setProgram] = useState<string>("all");
  const [yearLevel, setYearLevel] = useState<string>("all");
  const [picked, setPicked] = useState<Selection>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Section | null>(null);
  const [deleting, setDeleting] = useState<Section | null>(null);

  // Default to the active school year. Derived while rendering rather than
  // backfilled by an effect, so there is no render pass with no year selected.
  const schoolYearId =
    pickedSchoolYearId ??
    (schoolYears.find((sy) => sy.isActive) ?? schoolYears[0])?.id ??
    null;
  const selectedSchoolYear = schoolYears.find(sy => sy.id === schoolYearId);

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

  // The selection falls back to the first section (then the unsectioned bucket)
  // whenever the user's pick isn't in the current data — a filter change can strand
  // it. Derived while rendering, so a stale pick is never shown even for one frame.
  const pickIsValid =
    (typeof picked === "number" && sections.some((s) => s.id === picked)) ||
    (picked === "unsectioned" && unsectioned.length > 0);
  const selected: Selection = pickIsValid
    ? picked
    : sections.length > 0
      ? sections[0].id
      : unsectioned.length > 0
        ? "unsectioned"
        : null;

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
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <PageHeader title="Sections" />
        </div>
        <Button onClick={openCreate} disabled={!schoolYearId}>
          <PlusIcon />
          New section
        </Button>
      </div>

      <DashboardMetricStrip metrics={[
        { label: "Sections", value: sections.length, detail: "In the selected scope" },
        { label: "Seats", value: totals.capacity, detail: "Total capacity" },
        { label: "Assigned", value: totals.assigned, detail: "Students assigned to sections" },
        { label: "Unsectioned", value: unsectioned.length, detail: "Students awaiting a section" },
      ]} />

      {/* Section workspace */}
      <div className="bg-card overflow-hidden rounded-xl border">
      <div className="flex flex-wrap items-center gap-3 border-b p-3">
        <Select
          value={schoolYearId ? String(schoolYearId) : ""}
          onValueChange={(v) => setPickedSchoolYearId(Number(v))}
        >
          <SelectTrigger className="w-fit min-w-44">
            <SelectValue placeholder="School year">
              {selectedSchoolYear && <SchoolYearLabel {...selectedSchoolYear} />}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {schoolYears.map((sy) => (
              <SelectItem key={sy.id} value={String(sy.id)} textValue={`SY ${sy.schoolYear}${sy.isActive ? " (active)" : ""}`}>
                <SchoolYearLabel {...sy} />
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
        <div className="grid items-stretch lg:grid-cols-[280px_minmax(0,1fr)]">
          {/* Sections list */}
          <div className="space-y-2 border-b bg-muted/20 p-3 lg:border-r lg:border-b-0">
            {unsectioned.length > 0 && (
              <button
                type="button"
                onClick={() => setPicked("unsectioned")}
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
                  onSelect={() => setPicked(section.id)}
                />
              ))
            )}
          </div>

          {/* Detail */}
          <div>
            {selectedSection ? (
              <SectionDetail
                key={selectedSection.id}
                section={selectedSection}
                allSections={sections}
                unsectioned={unsectioned}
                studentsLoading={unsectionedQuery.isPending}
                studentsError={unsectionedQuery.isError ? "Available students could not be loaded. Please try again." : null}
                onRetryStudents={() => void unsectionedQuery.refetch()}
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

      </div>

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
