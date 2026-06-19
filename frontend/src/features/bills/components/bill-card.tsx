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
import { semesterLabel } from "@/features/terms/types";
import { useStudentBill } from "../hooks";
import { BILL_STATUS_META } from "../types";

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
          The student's bill for the open enrollment term.
        </CardDescription>
        {bill && (
          <CardAction>
            <Badge
              variant="outline"
              className={BILL_STATUS_META[bill.status].className}
            >
              {BILL_STATUS_META[bill.status].label}
            </Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <Skeleton className="h-40 w-full rounded-md" />
        ) : bill ? (
          <div className="space-y-4">
            <p className="text-muted-foreground text-xs">
              {semesterLabel(bill.semester ?? "")} · SY {bill.schoolYear}
            </p>

            <dl className="space-y-2 text-sm">
              {bill.items.map((item) => (
                <div key={item.id} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{item.name}</dt>
                  <dd className="font-medium">{formatPeso(item.amount)}</dd>
                </div>
              ))}
              {bill.items.length === 0 && (
                <p className="text-muted-foreground">No fee items.</p>
              )}
            </dl>

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
