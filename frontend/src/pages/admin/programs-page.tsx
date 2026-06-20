import { useState } from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
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
import { FieldLabel } from "@/components/form/field-label";
import { getErrorMessage } from "@/lib/get-error-message";
import {
  useAdminPrograms,
  useCreateProgram,
  useDeleteProgram,
  useUpdateProgram,
  useUpdateProgramFeeItems,
} from "@/features/programs/hooks";
import { YEAR_LEVEL_OPTIONS } from "@/features/applications/types";
import type { Program } from "@/features/programs/types";

function ProgramDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Program | null;
}) {
  const create = useCreateProgram();
  const update = useUpdateProgram(editing?.id ?? 0);
  const mutation = editing ? update : create;

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [isActive, setIsActive] = useState(true);

  function syncFromProps() {
    setName(editing?.name ?? "");
    setCategory(editing?.category ?? "");
    setIsActive(editing?.isActive ?? true);
    mutation.reset();
  }

  async function handleSave() {
    if (!name.trim() || !category.trim()) return;
    try {
      await mutation.mutateAsync({
        name: name.trim(),
        category: category.trim(),
        isActive,
      });
      onOpenChange(false);
    } catch {
      // Surfaced via mutation.isError.
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) syncFromProps();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit program" : "New program"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update the program's name, grouping and availability."
              : "Add a track or strand. Its code is derived from the name and stays fixed."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <FieldLabel htmlFor="name" required>
              Name
            </FieldLabel>
            <Input
              id="name"
              value={name}
              placeholder="e.g. ICT (Information & Communications Technology)"
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor="category" required>
              Category / grouping
            </FieldLabel>
            <Input
              id="category"
              value={category}
              placeholder="e.g. TechVoc Track"
              onChange={(event) => setCategory(event.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={isActive}
              onCheckedChange={(checked) => setIsActive(checked === true)}
            />
            Active (available for selection)
          </label>
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
          <Button
            onClick={handleSave}
            disabled={!name.trim() || !category.trim() || mutation.isPending}
          >
            {mutation.isPending
              ? "Saving…"
              : editing
                ? "Save changes"
                : "Create program"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ItemRow {
  name: string;
  // Amount input (string) keyed by year level code.
  amounts: Record<string, string>;
}

function FeeItemsForm({
  program,
  levels,
  onClose,
}: {
  program: Program;
  levels: { value: string; label: string }[];
  onClose: () => void;
}) {
  const save = useUpdateProgramFeeItems(program.id);

  const emptyRow = (): ItemRow => ({
    name: "",
    amounts: Object.fromEntries(levels.map((l) => [l.value, ""])),
  });

  const [rows, setRows] = useState<ItemRow[]>(() => {
    const items = program.feeItems ?? [];
    if (items.length === 0) return [emptyRow()];
    return items.map((item) => ({
      name: item.name,
      amounts: Object.fromEntries(
        levels.map((l) => [
          l.value,
          item.amounts[l.value] !== undefined ? String(item.amounts[l.value]) : "",
        ]),
      ),
    }));
  });

  function updateName(index: number, name: string) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, name } : row)),
    );
  }

  function updateAmount(index: number, code: string, value: string) {
    setRows((prev) =>
      prev.map((row, i) =>
        i === index
          ? { ...row, amounts: { ...row.amounts, [code]: value } }
          : row,
      ),
    );
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    const items = rows
      .filter((row) => row.name.trim() !== "")
      .map((row) => ({
        name: row.name.trim(),
        amounts: Object.fromEntries(
          levels.map((l) => [
            l.value,
            row.amounts[l.value]?.trim() ? Number(row.amounts[l.value]) : null,
          ]),
        ),
      }));
    try {
      await save.mutateAsync(items);
      onClose();
    } catch {
      // Surfaced via save.isError.
    }
  }

  return (
    <>
      <p className="text-muted-foreground text-xs">
        Leave a level blank if the item isn't charged for it.
      </p>
      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={index} className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              {index === 0 && <FieldLabel>Item</FieldLabel>}
              <Input
                value={row.name}
                placeholder="e.g. Tuition Fee"
                onChange={(e) => updateName(index, e.target.value)}
              />
            </div>
            {levels.map((level) => (
              <div key={level.value} className="w-28 space-y-1">
                {index === 0 && <FieldLabel>{level.label}</FieldLabel>}
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="—"
                  value={row.amounts[level.value] ?? ""}
                  onChange={(e) =>
                    updateAmount(index, level.value, e.target.value)
                  }
                />
              </div>
            ))}
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive size-9 shrink-0"
              onClick={() => removeRow(index)}
            >
              <Trash2Icon className="size-4" />
              <span className="sr-only">Remove item</span>
            </Button>
          </div>
        ))}
        <Button variant="ghost" size="sm" onClick={addRow}>
          <PlusIcon />
          Add item
        </Button>
      </div>

      {save.isError && (
        <p className="text-destructive text-sm">{getErrorMessage(save.error)}</p>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={save.isPending}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save fee items"}
        </Button>
      </DialogFooter>
    </>
  );
}

function FeeItemsDialog({
  program,
  onOpenChange,
}: {
  program: Program | null;
  onOpenChange: (open: boolean) => void;
}) {
  const levels = YEAR_LEVEL_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
  }));

  return (
    <Dialog open={program !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Default fee items</DialogTitle>
          <DialogDescription>
            {program
              ? `Per-year-level amounts new fee structures for ${program.name} are pre-filled with.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        {program && (
          <FeeItemsForm
            program={program}
            levels={levels}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ProgramsPage() {
  const { data, isLoading, isError, refetch } = useAdminPrograms();
  const programs = data ?? [];
  const remove = useDeleteProgram();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);
  const [itemsFor, setItemsFor] = useState<Program | null>(null);
  const [deleting, setDeleting] = useState<Program | null>(null);

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(program: Program) {
    setEditing(program);
    setDialogOpen(true);
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      setDeleting(null);
    } catch {
      // Keep the dialog open; surfaced via remove.isError.
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Programs</h1>
          <p className="text-muted-foreground text-sm">
            Tracks and strands offered, and the default fee items each one seeds
            into new fee structures.
          </p>
        </div>
        <Button onClick={openNew}>
          <PlusIcon />
          New program
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-11 w-full rounded-md" />
          <Skeleton className="h-11 w-full rounded-md" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground text-sm">
            We couldn't load programs. Please try again.
          </p>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : programs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <p className="font-medium">No programs yet</p>
          <p className="text-muted-foreground text-sm">
            Add the tracks and strands your school offers.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Program</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Default items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {programs.map((program) => {
                const items = program.feeItems ?? [];
                return (
                  <TableRow key={program.id}>
                    <TableCell className="font-medium">{program.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {program.category}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {items.length > 0
                        ? `${items.length} ${items.length === 1 ? "item" : "items"}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          program.isActive
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                            : "text-muted-foreground"
                        }
                      >
                        {program.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setItemsFor(program)}
                        >
                          Fee items
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(program)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive size-8"
                          onClick={() => setDeleting(program)}
                        >
                          <Trash2Icon className="size-4" />
                          <span className="sr-only">Delete program</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <ProgramDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
      />

      <FeeItemsDialog
        program={itemsFor}
        onOpenChange={(open) => {
          if (!open) setItemsFor(null);
        }}
      />

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this program?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? `"${deleting.name}" will be removed. If it's used by students, applications or fee structures, deactivate it instead.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {remove.isError && (
            <p className="text-destructive text-sm">
              {getErrorMessage(remove.error)}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
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

export default ProgramsPage;
