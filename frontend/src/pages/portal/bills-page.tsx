import { useNavigate } from "react-router-dom";
import {
  ChevronRightIcon,
  HistoryIcon,
  ReceiptTextIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatPeso } from "@/lib/money";
import { EmptyState } from "@/features/bills/components/bill-ledger";
import { useMyBill, useMyBills } from "@/features/bills/hooks";
import { BILL_STATUS_META, type Bill } from "@/features/bills/types";
import { termTitle } from "@/features/bills/utils";

function BillsMobileList({
  bills,
  currentId,
  onView,
}: {
  bills: Bill[];
  currentId?: number;
  onView: (bill: Bill) => void;
}) {
  return (
    <div className="divide-y md:hidden">
      {bills.map((bill) => {
        const meta = BILL_STATUS_META[bill.status];
        return (
          <button
            key={bill.id}
            type="button"
            onClick={() => onView(bill)}
            className="hover:bg-muted/30 flex w-full flex-col gap-4 px-4 py-4 text-left transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{termTitle(bill)}</p>
                  {bill.id === currentId && (
                    <Badge variant="secondary" className="font-normal">
                      Current
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground text-sm">
                  {bill.semester ?? "Term bill"}
                </p>
              </div>
              <ChevronRightIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            </div>

            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="space-y-1">
                <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                  Balance
                </p>
                <p className="font-semibold tabular-nums">
                  {formatPeso(bill.balance)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                  Paid
                </p>
                <p className="tabular-nums">{formatPeso(bill.amountPaid)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                  Status
                </p>
                <Badge
                  variant="outline"
                  className={cn("justify-center", meta.className)}
                >
                  {meta.label}
                </Badge>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function BillsTable({
  bills,
  currentId,
  onView,
}: {
  bills: Bill[];
  currentId?: number;
  onView: (bill: Bill) => void;
}) {
  const head =
    "text-muted-foreground h-9 text-[11px] font-medium tracking-wide uppercase";

  return (
    <div className="hidden md:block">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={cn(head, "pl-6")}>Term</TableHead>
            <TableHead className={cn(head, "text-right")}>Net total</TableHead>
            <TableHead className={cn(head, "text-right")}>Paid</TableHead>
            <TableHead className={cn(head, "text-right")}>Balance</TableHead>
            <TableHead className={cn(head, "pr-6 text-right")}>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bills.map((bill) => {
            const meta = BILL_STATUS_META[bill.status];
            return (
              <TableRow
                key={bill.id}
                role="button"
                tabIndex={0}
                onClick={() => onView(bill)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onView(bill);
                  }
                }}
                className="cursor-pointer"
              >
                <TableCell className="py-2.5 pl-6 font-medium">
                  <span className="inline-flex items-center gap-2">
                    {termTitle(bill)}
                    {bill.id === currentId && (
                      <Badge variant="secondary" className="font-normal">
                        Current
                      </Badge>
                    )}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground py-2.5 text-right tabular-nums">
                  {formatPeso(bill.netTotal)}
                </TableCell>
                <TableCell className="text-muted-foreground py-2.5 text-right tabular-nums">
                  {formatPeso(bill.amountPaid)}
                </TableCell>
                <TableCell className="py-2.5 text-right font-medium tabular-nums">
                  {formatPeso(bill.balance)}
                </TableCell>
                <TableCell className="py-2.5 pr-6 text-right">
                  <span className="inline-flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn("w-28 justify-center", meta.className)}
                    >
                      {meta.label}
                    </Badge>
                    <ChevronRightIcon className="text-muted-foreground size-4" />
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function BillsListCard({
  bills,
  currentId,
  onView,
}: {
  bills: Bill[];
  currentId?: number;
  onView: (bill: Bill) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/20">
        <CardTitle className="text-base">My bills</CardTitle>
        <CardDescription>
          Open any bill to review the breakdown, payment schedule, and payment
          actions.
        </CardDescription>
      </CardHeader>
      <CardContent className={cn(bills.length > 0 && "p-0")}>
        {bills.length === 0 ? (
          <EmptyState
            icon={HistoryIcon}
            title="No bills yet"
            message="Your bills will be listed here as terms are billed."
          />
        ) : (
          <>
            <BillsMobileList bills={bills} currentId={currentId} onView={onView} />
            <BillsTable bills={bills} currentId={currentId} onView={onView} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function BillsPage() {
  const navigate = useNavigate();
  const { data: currentBill } = useMyBill();
  const { data: allBills, isLoading } = useMyBills();

  const bills = allBills ?? [];
  const openBill = (bill: Bill) => navigate(`/portal/bills/${bill.id}`);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-40 rounded-md" />
        <Skeleton className="h-9 w-72 rounded-md" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Bills</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Select a bill to view the full breakdown, pay the current term, and
          download receipts.
        </p>
      </div>

      {bills.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={ReceiptTextIcon}
              title="No bills yet"
              message="Your bill for the current term hasn't been issued yet. Please check back later."
            />
          </CardContent>
        </Card>
      ) : (
        <BillsListCard
          bills={bills}
          currentId={currentBill?.id}
          onView={openBill}
        />
      )}
    </div>
  );
}

export default BillsPage;
