import { useMemo, useState } from "react";
import {
  CoinsIcon,
  GraduationCapIcon,
  LibraryIcon,
  PencilIcon,
  PlusIcon,
  ReceiptTextIcon,
  Trash2Icon,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatTile } from "@/components/stat-tile";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldLabel } from "@/components/form/field-label";
import { formatPeso } from "@/lib/money";
import { getErrorMessage } from "@/lib/get-error-message";
import { useTerms } from "@/features/terms/hooks";
import {
  useCreateFee,
  useDeleteFee,
  useFees,
  useUpdateFee,
} from "@/features/fees/hooks";
import {
  FEE_CATEGORY_OPTIONS,
  FEE_TYPE_OPTIONS,
  FEE_YEAR_LEVEL_OPTIONS,
  feeYearLevelLabel,
  type FeeCategory,
  type FeeInput,
  type FeeType,
  type FeeYearLevel,
  type SchoolYearFee,
} from "@/features/fees/types";

interface FeeFormState {
  yearLevel: FeeYearLevel;
  category: FeeCategory;
  name: string;
  type: FeeType;
  amount: string;
}

const EMPTY_FEE: FeeFormState = {
  yearLevel: "all",
  category: "other",
  name: "",
  type: "default",
  amount: "",
};

// Per-category presentation (icon + colour chip) for the breakdown cards.
const CATEGORY_META: Record<string, { icon: LucideIcon }> = {
  tuition: { icon: GraduationCapIcon },
  miscellaneous: { icon: LibraryIcon },
  other: { icon: CoinsIcon },
};

function FeeDialog({
  open,
  schoolYearId,
  editing,
  onOpenChange,
}: {
  open: boolean;
  schoolYearId: number | null;
  editing: SchoolYearFee | null;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateFee();
  const update = useUpdateFee(editing?.id ?? 0);
  const mutation = editing ? update : create;

  const [form, setForm] = useState<FeeFormState>(
    editing
      ? {
          yearLevel: editing.yearLevel,
          category: editing.category,
          name: editing.name,
          type: editing.type,
          amount: String(editing.amount),
        }
      : EMPTY_FEE,
  );

  const valid = form.name.trim() !== "" && form.amount !== "";

  async function handleSave() {
    if (!valid) return;
    const payload: FeeInput = {
      yearLevel: form.yearLevel,
      category: form.category,
      name: form.name.trim(),
      type: form.type,
      amount: Number(form.amount),
      ...(editing ? {} : { schoolYearId: schoolYearId ?? undefined }),
    };
    try {
      await mutation.mutateAsync(payload);
      onOpenChange(false);
    } catch {
      // Surfaced via mutation.isError.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit fee" : "Add fee"}</DialogTitle>
          <DialogDescription>
            Fees apply by year level. Use “All levels” for fees everyone pays, or
            target a level (e.g. a Grade 12 add-on).
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <FieldLabel required>Category</FieldLabel>
            <Select
              value={form.category}
              onValueChange={(v) =>
                setForm((prev) => ({ ...prev, category: v as FeeCategory }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FEE_CATEGORY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Year level</FieldLabel>
            <Select
              value={form.yearLevel}
              onValueChange={(v) =>
                setForm((prev) => ({ ...prev, yearLevel: v as FeeYearLevel }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FEE_YEAR_LEVEL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Type</FieldLabel>
            <Select
              value={form.type}
              onValueChange={(v) =>
                setForm((prev) => ({ ...prev, type: v as FeeType }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FEE_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <FieldLabel required>Fee name</FieldLabel>
            <Input
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Tuition"
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Amount (₱)</FieldLabel>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.amount}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, amount: e.target.value }))
              }
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
          <Button onClick={handleSave} disabled={!valid || mutation.isPending}>
            {mutation.isPending ? "Saving…" : editing ? "Save" : "Add fee"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FeesPage() {
  const { data: terms } = useTerms();
  const schoolYears = terms ?? [];
  const activeYear = schoolYears.find((sy) => sy.isActive);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const effectiveId = selectedId ?? activeYear?.id ?? null;

  const { data, isLoading, isError, refetch } = useFees(
    effectiveId ?? undefined,
  );
  const fees = data ?? [];

  const remove = useDeleteFee();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolYearFee | null>(null);
  const [deleting, setDeleting] = useState<SchoolYearFee | null>(null);

  const totals = useMemo(() => {
    const rows = data ?? [];
    const grade11 = rows
      .filter((f) => f.yearLevel === "all" || f.yearLevel === "grade_11")
      .reduce((sum, f) => sum + f.amount, 0);
    const grade12 = rows
      .filter((f) => f.yearLevel === "all" || f.yearLevel === "grade_12")
      .reduce((sum, f) => sum + f.amount, 0);
    return { grade11, grade12 };
  }, [data]);

  // Fees grouped by category (in schedule order) with a subtotal each, mirroring
  // the official Schedule of Fees breakdown.
  const groups = useMemo(() => {
    const rows = data ?? [];
    return FEE_CATEGORY_OPTIONS.map((cat) => {
      const items = rows
        .filter((f) => f.category === cat.value)
        .sort((a, b) => a.sequence - b.sequence);
      return {
        ...cat,
        items,
        subtotal: items.reduce((sum, f) => sum + f.amount, 0),
      };
    }).filter((group) => group.items.length > 0);
  }, [data]);

  function openAdd() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(fee: SchoolYearFee) {
    setEditing(fee);
    setDialogOpen(true);
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
    } catch {
      // no-op
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Fees</h1>
          <p className="text-muted-foreground text-sm">
            The global fee schedule for a school year, by year level. Bills are
            generated from these.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1.5">
            <FieldLabel>School year</FieldLabel>
            <Select
              value={effectiveId ? String(effectiveId) : ""}
              onValueChange={(v) => setSelectedId(Number(v))}
            >
              <SelectTrigger className="min-w-44 w-fit">
                <SelectValue placeholder="Select year" />
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
          </div>
          <Button onClick={openAdd} disabled={effectiveId === null}>
            <PlusIcon />
            Add fee
          </Button>
        </div>
      </div>

      {effectiveId !== null && !isLoading && !isError && fees.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile
            label="Grade 11 / student"
            value={formatPeso(totals.grade11)}
            icon={GraduationCapIcon}
          />
          <StatTile
            label="Grade 12 / student"
            value={formatPeso(totals.grade12)}
            icon={GraduationCapIcon}
          />
          <StatTile
            label="Fee items"
            value={fees.length}
            hint={`across ${groups.length} ${groups.length === 1 ? "section" : "sections"}`}
            icon={ReceiptTextIcon}
          />
        </div>
      )}

      {effectiveId === null ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <p className="font-medium">No school year selected</p>
          <p className="text-muted-foreground text-sm">
            Create and activate a school year first.
          </p>
        </div>
      ) : isLoading ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground text-sm">
            We couldn't load fees. Please try again.
          </p>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : fees.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <p className="font-medium">No fees yet</p>
          <p className="text-muted-foreground text-sm">
            Add the fees for this school year so bills can be generated.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const meta = CATEGORY_META[group.value] ?? CATEGORY_META.other;
            const Icon = meta.icon;
            return (
              <Card key={group.value} className="gap-0 overflow-hidden py-0">
                <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                      <Icon className="size-4.5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">{group.label}</h3>
                      <p className="text-muted-foreground text-xs">
                        {group.items.length}{" "}
                        {group.items.length === 1 ? "item" : "items"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground text-[11px] tracking-wide uppercase">
                      Subtotal
                    </p>
                    <p className="text-sm font-semibold tabular-nums">
                      {formatPeso(group.subtotal)}
                    </p>
                  </div>
                </div>
                <ul className="divide-y">
                  {group.items.map((fee) => {
                    const tag = [
                      fee.yearLevel !== "all"
                        ? feeYearLevelLabel(fee.yearLevel)
                        : null,
                      fee.type === "add_on" ? "Add-on" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      <li
                        key={fee.id}
                        className="hover:bg-muted/40 group flex items-center gap-3 px-4 py-2.5 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {fee.name}
                          </p>
                          {tag && (
                            <p className="text-muted-foreground text-xs">
                              {tag}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">
                          {formatPeso(fee.amount)}
                        </span>
                        <div className="flex shrink-0 items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => openEdit(fee)}
                            aria-label={`Edit ${fee.name}`}
                          >
                            <PencilIcon className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive size-7"
                            onClick={() => setDeleting(fee)}
                            aria-label={`Delete ${fee.name}`}
                          >
                            <Trash2Icon className="size-3.5" />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}
        </div>
      )}

      {dialogOpen && (
        <FeeDialog
          open={dialogOpen}
          schoolYearId={effectiveId}
          editing={editing}
          onOpenChange={setDialogOpen}
        />
      )}

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this fee?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? `“${deleting.name}” will be removed from this school year's schedule. Existing bills already generated are unaffected.`
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

export default FeesPage;
