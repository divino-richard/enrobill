import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
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
} from "@/features/fees/hooks";
import {
  programLabel,
  structureTermLabel,
  type FeeStructure,
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

function FeesPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useFeeStructures();
  const structures = useMemo(() => data ?? [], [data]);
  const remove = useDeleteFeeStructure();

  const [newOpen, setNewOpen] = useState(false);
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
        <Button onClick={() => setNewOpen(true)}>
          <PlusIcon />
          New structure
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
