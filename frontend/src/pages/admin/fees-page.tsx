import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2Icon,
  CircleAlertIcon,
  PlusIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
  WandSparklesIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { formatPeso } from "@/lib/money";
import { getErrorMessage } from "@/lib/get-error-message";
import {
  TRACK_STRAND_GROUPS,
  YEAR_LEVEL_OPTIONS,
} from "@/features/applications/types";
import { useTerms } from "@/features/terms/hooks";
import { termLabel } from "@/features/terms/types";
import {
  useCreateFeeStructure,
  useDeleteFeeStructure,
  useFeeStructures,
  useGenerateFeeStructures,
  useStandardFeeItems,
  useUpdateStandardFeeItems,
} from "@/features/fees/hooks";
import {
  programLabel,
  structureTermLabel,
  type FeeStructure,
  type StandardFeeItem,
} from "@/features/fees/types";

function NewStructureDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (structure: FeeStructure) => void;
}) {
  const { data: terms } = useTerms();
  const [termId, setTermId] = useState("");
  const [track, setTrack] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const create = useCreateFeeStructure();

  function reset() {
    setTermId("");
    setTrack("");
    setYearLevel("");
    create.reset();
  }

  async function handleCreate() {
    if (!termId || !track || !yearLevel) return;
    try {
      const structure = await create.mutateAsync({
        termId: Number(termId),
        track,
        yearLevel,
      });
      reset();
      onOpenChange(false);
      onCreated(structure);
    } catch {
      // Surfaced via create.isError.
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New fee structure</DialogTitle>
          <DialogDescription>
            Pick the term and program. You'll add the fee items next.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <FieldLabel htmlFor="term" required>
              Term
            </FieldLabel>
            <Select value={termId} onValueChange={setTermId}>
              <SelectTrigger id="term" className="w-full">
                <SelectValue placeholder="Select term" />
              </SelectTrigger>
              <SelectContent>
                {(terms ?? []).map((term) => (
                  <SelectItem key={term.id} value={String(term.id)}>
                    {termLabel(term)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel htmlFor="track" required>
                Track / Strand
              </FieldLabel>
              <Select value={track} onValueChange={setTrack}>
                <SelectTrigger id="track" className="w-full">
                  <SelectValue placeholder="Select track" />
                </SelectTrigger>
                <SelectContent>
                  {TRACK_STRAND_GROUPS.map((group) => (
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
              <FieldLabel htmlFor="yearLevel" required>
                Year Level
              </FieldLabel>
              <Select value={yearLevel} onValueChange={setYearLevel}>
                <SelectTrigger id="yearLevel" className="w-full">
                  <SelectValue placeholder="Select year level" />
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
          </div>
        </div>

        {create.isError && (
          <p className="text-destructive text-sm">
            {getErrorMessage(create.error)}
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={create.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!termId || !track || !yearLevel || create.isPending}
          >
            {create.isPending ? "Creating…" : "Create structure"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ItemRow {
  name: string;
  amount: string;
}

function StandardItemsForm({
  initialItems,
  save,
  onClose,
}: {
  initialItems: StandardFeeItem[];
  save: ReturnType<typeof useUpdateStandardFeeItems>;
  onClose: () => void;
}) {
  // Initialise straight from the loaded items — the form only mounts once the
  // query has resolved, so this always reflects what's saved.
  const [rows, setRows] = useState<ItemRow[]>(() =>
    initialItems.length > 0
      ? initialItems.map((item) => ({
          name: item.name,
          amount: String(item.amount),
        }))
      : [{ name: "", amount: "" }],
  );

  function updateRow(index: number, patch: Partial<ItemRow>) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function addRow() {
    setRows((prev) => [...prev, { name: "", amount: "" }]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    const items = rows
      .filter((row) => row.name.trim() !== "")
      .map((row) => ({ name: row.name.trim(), amount: Number(row.amount) || 0 }));
    try {
      await save.mutateAsync(items);
      onClose();
    } catch {
      // Surfaced via save.isError.
    }
  }

  return (
    <>
      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={index} className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              {index === 0 && <FieldLabel>Item</FieldLabel>}
              <Input
                value={row.name}
                placeholder="e.g. Tuition Fee"
                onChange={(e) => updateRow(index, { name: e.target.value })}
              />
            </div>
            <div className="w-36 space-y-1">
              {index === 0 && <FieldLabel>Default amount</FieldLabel>}
              <Input
                type="number"
                min={0}
                step="0.01"
                value={row.amount}
                onChange={(e) => updateRow(index, { amount: e.target.value })}
              />
            </div>
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
          {save.isPending ? "Saving…" : "Save standard items"}
        </Button>
      </DialogFooter>
    </>
  );
}

function StandardItemsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading } = useStandardFeeItems();
  const save = useUpdateStandardFeeItems();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) save.reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Standard fee items</DialogTitle>
          <DialogDescription>
            The default items every new fee structure is pre-filled with. Adjust
            amounts on individual structures afterwards.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <Skeleton className="h-32 w-full rounded-md" />
        ) : (
          <StandardItemsForm
            initialItems={data ?? []}
            save={save}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function FeesPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useFeeStructures();
  const structures = useMemo(() => data ?? [], [data]);
  const remove = useDeleteFeeStructure();
  const generate = useGenerateFeeStructures();

  const { data: terms } = useTerms();
  const openTerm = (terms ?? []).find((term) => term.isOpen) ?? null;

  const [newOpen, setNewOpen] = useState(false);
  const [standardOpen, setStandardOpen] = useState(false);
  const [termFilter, setTermFilter] = useState("all");
  const [deleting, setDeleting] = useState<FeeStructure | null>(null);

  // Distinct terms present, for the filter.
  const termOptions = useMemo(() => {
    const seen = new Map<number, string>();
    for (const structure of structures) {
      if (!seen.has(structure.termId)) {
        seen.set(structure.termId, structureTermLabel(structure));
      }
    }
    return [...seen.entries()].map(([id, label]) => ({ id, label }));
  }, [structures]);

  const visible = structures.filter(
    (structure) =>
      termFilter === "all" || String(structure.termId) === termFilter,
  );

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Fee Structures
          </h1>
          <p className="text-muted-foreground text-sm">
            Flat per-semester fees for each program. Bills are built from these.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setStandardOpen(true)}>
            <SlidersHorizontalIcon />
            Standard items
          </Button>
          <Button
            variant="outline"
            onClick={() => generate.mutate()}
            disabled={!openTerm || generate.isPending}
            title={
              openTerm
                ? `Generate for ${termLabel(openTerm)}`
                : "Open a term first"
            }
          >
            <WandSparklesIcon />
            {generate.isPending ? "Generating…" : "Generate structures"}
          </Button>
          <Button onClick={() => setNewOpen(true)}>
            <PlusIcon />
            New structure
          </Button>
        </div>
      </div>

      {generate.isSuccess && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
          <CheckCircle2Icon className="size-4 shrink-0" />
          {generate.data.created > 0
            ? `Generated ${generate.data.created} fee ${generate.data.created === 1 ? "structure" : "structures"} for ${openTerm ? termLabel(openTerm) : "the open term"}.`
            : "Every program already has a fee structure for the open term."}
        </div>
      )}

      {generate.isError && (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-3 rounded-lg border px-4 py-3 text-sm"
        >
          <CircleAlertIcon className="mt-0.5 size-5 shrink-0" />
          {getErrorMessage(generate.error)}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-11 w-full rounded-md" />
          <Skeleton className="h-11 w-full rounded-md" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground text-sm">
            We couldn't load fee structures. Please try again.
          </p>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : structures.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <p className="font-medium">No fee structures yet</p>
          <p className="text-muted-foreground text-sm">
            Create one per program to define what students owe.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {termOptions.length > 1 && (
            <Select value={termFilter} onValueChange={setTermFilter}>
              <SelectTrigger size="sm" className="w-[16rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All terms</SelectItem>
                {termOptions.map((term) => (
                  <SelectItem key={term.id} value={String(term.id)}>
                    {term.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Term</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((structure) => (
                  <TableRow key={structure.id}>
                    <TableCell className="whitespace-nowrap">
                      {structureTermLabel(structure)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {programLabel(structure.track, structure.yearLevel)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {structure.items.length}
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap">
                      {formatPeso(structure.total)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/admin/fees/${structure.id}`)}
                        >
                          Manage
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive size-8"
                          onClick={() => setDeleting(structure)}
                        >
                          <Trash2Icon className="size-4" />
                          <span className="sr-only">Delete structure</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <NewStructureDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={(structure) => navigate(`/admin/fees/${structure.id}`)}
      />

      <StandardItemsDialog open={standardOpen} onOpenChange={setStandardOpen} />

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this fee structure?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? `${programLabel(deleting.track, deleting.yearLevel)} — ${structureTermLabel(deleting)} and its items will be removed. This can't be undone.`
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
