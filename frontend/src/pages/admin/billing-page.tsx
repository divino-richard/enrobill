import { useNavigate } from "react-router-dom";
import { CheckCircle2Icon, CircleAlertIcon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatPeso } from "@/lib/money";
import { getErrorMessage } from "@/lib/get-error-message";
import { programLabel } from "@/features/fees/types";
import { useBills, useGenerateBills } from "@/features/bills/hooks";
import { BILL_STATUS_META } from "@/features/bills/types";

function BillingPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useBills();
  const bills = data ?? [];
  const generate = useGenerateBills();

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
          <p className="text-muted-foreground text-sm">
            Bills for the open enrollment term, generated from each program's fee
            structure.
          </p>
        </div>
        <Button
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
        >
          <SparklesIcon />
          {generate.isPending ? "Generating…" : "Generate bills"}
        </Button>
      </div>

      {generate.isSuccess && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
          <CheckCircle2Icon className="size-4 shrink-0" />
          {generate.data.created > 0
            ? `Generated ${generate.data.created} new ${generate.data.created === 1 ? "bill" : "bills"}.`
            : "Everyone eligible is already billed — no new bills."}
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
            We couldn't load bills. Please try again.
          </p>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : bills.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <p className="font-medium">No bills for the open term</p>
          <p className="text-muted-foreground text-sm">
            Use “Generate bills” to bill all eligible admitted students at once.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student No.</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Program</TableHead>
                <TableHead>Net total</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bills.map((bill) => (
                <TableRow key={bill.id}>
                  <TableCell className="font-medium whitespace-nowrap">
                    {bill.student?.studentNumber ?? "—"}
                  </TableCell>
                  <TableCell>{bill.student?.name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {bill.student
                      ? programLabel(bill.student.track, bill.student.yearLevel)
                      : "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatPeso(bill.netTotal)}
                    {bill.discountTotal > 0 && (
                      <span className="text-muted-foreground ml-1 text-xs">
                        (−{formatPeso(bill.discountTotal)})
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium whitespace-nowrap">
                    {formatPeso(bill.balance)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(BILL_STATUS_META[bill.status].className)}
                    >
                      {BILL_STATUS_META[bill.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/admin/billing/${bill.id}`)}
                    >
                      Manage
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export default BillingPage;
