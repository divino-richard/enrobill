import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  CircleAlertIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPeso } from "@/lib/money";
import { getErrorMessage } from "@/lib/get-error-message";
import {
  useFeeStructure,
  useUpdateFeeStructureItems,
} from "@/features/fees/hooks";
import {
  programLabel,
  structureTermLabel,
  type FeeStructure,
} from "@/features/fees/types";

interface ItemRow {
  name: string;
  amount: string;
}

function FeeStructureEditor({ structure }: { structure: FeeStructure }) {
  const initial = useMemo<ItemRow[]>(
    () =>
      structure.items.map((item) => ({
        name: item.name,
        amount: String(item.amount),
      })),
    [structure],
  );
  const [rows, setRows] = useState<ItemRow[]>(initial);
  const [saved, setSaved] = useState(false);
  const update = useUpdateFeeStructureItems(structure.id);

  const total = rows.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0);
  const dirty = JSON.stringify(rows) !== JSON.stringify(initial);

  function setRow(index: number, key: keyof ItemRow, value: string) {
    setSaved(false);
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    );
  }

  function addRow() {
    setSaved(false);
    setRows((prev) => [...prev, { name: "", amount: "" }]);
  }

  function removeRow(index: number) {
    setSaved(false);
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setSaved(false);
    const items = rows
      .filter((row) => row.name.trim() !== "")
      .map((row) => ({ name: row.name.trim(), amount: Number(row.amount) || 0 }));
    try {
      const updated = await update.mutateAsync(items);
      setRows(
        updated.items.map((item) => ({
          name: item.name,
          amount: String(item.amount),
        })),
      );
      setSaved(true);
    } catch {
      // Surfaced via update.isError.
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Fee items</CardTitle>
        <CardDescription>
          Add each fee for this program. The total is what a student is assessed
          for the semester.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">No items yet.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((row, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={row.name}
                  placeholder="Fee name (e.g. Tuition)"
                  onChange={(e) => setRow(index, "name", e.target.value)}
                  className="flex-1"
                />
                <Input
                  value={row.amount}
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="0.00"
                  onChange={(e) => setRow(index, "amount", e.target.value)}
                  className="w-40"
                />
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
          </div>
        )}

        <Button variant="outline" size="sm" onClick={addRow}>
          <PlusIcon />
          Add item
        </Button>

        <div className="flex items-center justify-between border-t pt-4">
          <span className="text-sm font-medium">Total</span>
          <span className="text-lg font-semibold">{formatPeso(total)}</span>
        </div>

        {update.isError && (
          <div
            role="alert"
            className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-3 rounded-lg border px-4 py-3"
          >
            <CircleAlertIcon className="mt-0.5 size-5 shrink-0" />
            <p className="text-sm">{getErrorMessage(update.error)}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 border-t pt-4">
          {saved && !dirty && (
            <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <CheckCircle2Icon className="size-4 text-emerald-600 dark:text-emerald-500" />
              Saved
            </span>
          )}
          <Button onClick={handleSave} disabled={!dirty || update.isPending}>
            {update.isPending ? "Saving…" : "Save fees"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FeeStructurePage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { data: structure, isLoading, isError, refetch } = useFeeStructure(
    Number(id),
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground -ml-2"
        onClick={() => navigate("/admin/fees")}
      >
        <ArrowLeftIcon />
        Back to Fee Structures
      </Button>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-72 w-full rounded-lg" />
        </div>
      ) : isError || !structure ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <p className="text-muted-foreground text-sm">
              We couldn't load this fee structure. Please try again.
            </p>
            <Button variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardDescription className="text-xs font-medium tracking-wide uppercase">
                {structureTermLabel(structure)}
              </CardDescription>
              <CardTitle className="text-lg">
                {programLabel(structure.track, structure.yearLevel)}
              </CardTitle>
            </CardHeader>
          </Card>

          <FeeStructureEditor key={structure.id} structure={structure} />
        </>
      )}
    </div>
  );
}

export default FeeStructurePage;
