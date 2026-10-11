import { billStatusMeta } from '@/features/bills/collection';
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ReceiptTextIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPeso } from "@/lib/money";
import { useStudentBill } from "../hooks";

interface BillCardProps {
  studentId: number;
}

export function BillCard({ studentId }: BillCardProps) {
  const query = useStudentBill(studentId);
  const bill = query.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Billing</CardTitle>
        <CardDescription>
          {bill ? `SY ${bill.schoolYear} · Bill #${bill.id}` : "Current enrollment billing"}
        </CardDescription>
        {bill && (
          <CardAction>
            <Badge
              variant="outline"
              className={billStatusMeta(bill).className}
            >
              {billStatusMeta(bill).label}
            </Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <Skeleton className="h-40 w-full rounded-md" />
        ) : bill ? (
          <div className="space-y-4">
            <div className="grid gap-4 border-y py-4 sm:grid-cols-3">
              {[{label: "Net total", value: bill.netTotal}, {label: "Verified payments", value: bill.amountPaid}, {label: "Outstanding balance", value: bill.balance}].map((item) => <div key={item.label}><p className="text-muted-foreground text-sm">{item.label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{formatPeso(item.value)}</p></div>)}
            </div>
            <Button asChild variant="outline"><Link to={`/admin/billing/${bill.id}`}>View bill and installment plan</Link></Button>
            <details className="rounded-xl border p-4"><summary className="cursor-pointer text-sm font-medium">Fee breakdown · {bill.items.length} items</summary>
            <dl className="mt-4 divide-y text-sm">
              {bill.items.map((item) => (
                <div key={item.id} className="flex justify-between gap-4 py-2">
                  <dt className="text-muted-foreground">{item.name}</dt>
                  <dd className="font-medium">{formatPeso(item.amount)}</dd>
                </div>
              ))}
              {bill.items.length === 0 && (
                <p className="text-muted-foreground">No fee items.</p>
              )}
            </dl></details>

            <div className="space-y-2 border-t pt-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gross total</span>
                <span className="font-medium">{formatPeso(bill.total)}</span>
              </div>
              {bill.discountTotal > 0 && (
                <div className="flex justify-between">
                  <span className="text-emerald-600 dark:text-emerald-400">
                    Discounts
                  </span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    − {formatPeso(bill.discountTotal)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Net total</span>
                <span className="font-medium">{formatPeso(bill.netTotal)}</span>
              </div>
              {bill.amountPaid > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paid</span>
                  <span className="font-medium">
                    {formatPeso(bill.amountPaid)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-base">
                <span className="font-semibold">Balance</span>
                <span className="font-semibold">{formatPeso(bill.balance)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
            <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
              <ReceiptTextIcon className="size-6" />
            </div>
            <div className="space-y-1">
              <p className="font-medium">Not billed yet</p>
              <p className="text-muted-foreground mx-auto max-w-sm text-sm">
                Generate bills for the open term from the Billing page.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
