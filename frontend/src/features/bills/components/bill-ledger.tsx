import { Fragment, useState } from "react";
import { ArrowUpRightIcon, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatPeso } from "@/lib/money";
import { formatDate } from "@/features/applications/utils";
import { FEE_CATEGORY_OPTIONS, feeCategoryLabel } from "@/features/fees/types";
import { isOverdue, nextOutstandingInstallment } from "../utils";
import { PaymentProofDialog } from "./payment-proof-dialog";
import {
  INSTALLMENT_STATUS_META,
  PAYMENT_STATUS_META,
  paymentMethodLabel,
  type Bill,
  type BillAdjustment,
  type BillInstallment,
  type BillItem,
  type BillPayment,
} from "../types";

const HEAD =
  "text-muted-foreground h-9 text-[11px] font-medium tracking-wide uppercase";

const discountLabel = (adjustment: BillAdjustment) =>
  adjustment.type === "percentage"
    ? `${adjustment.label} (${adjustment.value}%)`
    : adjustment.label;

function groupFees(items: BillItem[]) {
  const order = FEE_CATEGORY_OPTIONS.map((option) => option.value as string);
  const groups = new Map<string, BillItem[]>();
  for (const item of items) {
    const list = groups.get(item.category) ?? [];
    list.push(item);
    groups.set(item.category, list);
  }
  const rank = (category: string) => {
    const index = order.indexOf(category);
    return index === -1 ? order.length : index;
  };
  return [...groups.entries()]
    .sort(([left], [right]) => rank(left) - rank(right))
    .map(([category, list]) => ({
      category,
      items: list,
      subtotal: list.reduce((sum, item) => sum + item.amount, 0),
    }));
}

function TotalRow({
  label,
  value,
  muted,
  strong,
  divide,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
  divide?: boolean;
}) {
  return (
    <TableRow
      className={cn(
        "border-0 hover:bg-transparent",
        divide && "border-border border-t",
      )}
    >
      <TableCell
        className={cn(
          "py-1.5 pr-3 text-right font-normal",
          strong ? "text-foreground font-semibold" : "text-muted-foreground",
        )}
      >
        {label}
      </TableCell>
      <TableCell
        className={cn(
          "w-px py-1.5 pr-6 text-right whitespace-nowrap tabular-nums",
          strong ? "text-base font-semibold" : "font-medium",
          muted && "text-emerald-600 dark:text-emerald-400",
        )}
      >
        {value}
      </TableCell>
    </TableRow>
  );
}

function MobileValueRow({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span
        className={cn(
          "text-muted-foreground",
          strong && "text-foreground font-semibold",
          muted && "text-emerald-600 dark:text-emerald-400",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "tabular-nums",
          strong ? "text-base font-semibold" : "font-medium",
          muted && "text-emerald-600 dark:text-emerald-400",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function ProofLink({ href }: { href: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-primary inline-flex items-center gap-1 text-xs underline-offset-4 hover:underline"
      >
        View proof
      </button>
      <PaymentProofDialog
        url={open ? href : null}
        onOpenChange={(next) => setOpen(next)}
      />
    </>
  );
}

export function BillStatement({ bill }: { bill: Bill }) {
  const groups = groupFees(bill.items);
  const sectioned = groups.length > 1;
  const adjustments = bill.adjustments ?? [];

  return (
    <>
      <div className="md:hidden">
        <div className="divide-y">
          {groups.map(({ category, items, subtotal }) => (
            <section key={category} className="space-y-3 p-4">
              {sectioned && (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-foreground/70 text-[11px] font-semibold tracking-wide uppercase">
                    {feeCategoryLabel(category)}
                  </p>
                  <p className="text-muted-foreground text-xs font-medium tabular-nums">
                    {formatPeso(subtotal)}
                  </p>
                </div>
              )}
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id ?? item.name}
                    className="flex items-start justify-between gap-4 text-sm"
                  >
                    <span className="pr-2">{item.name}</span>
                    <span className="shrink-0 font-medium tabular-nums">
                      {formatPeso(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ))}

          <section className="space-y-2 bg-muted/20 p-4">
            <MobileValueRow label="Subtotal" value={formatPeso(bill.total)} />
            {adjustments.length > 0
              ? adjustments.map((adjustment) => (
                  <MobileValueRow
                    key={adjustment.id}
                    label={discountLabel(adjustment)}
                    value={`- ${formatPeso(adjustment.amount)}`}
                    muted
                  />
                ))
              : bill.discountTotal > 0 && (
                  <MobileValueRow
                    label="Discount"
                    value={`- ${formatPeso(bill.discountTotal)}`}
                    muted
                  />
                )}
            <MobileValueRow
              label="Net total"
              value={formatPeso(bill.netTotal)}
              strong
            />
            <MobileValueRow label="Paid" value={formatPeso(bill.amountPaid)} />
            <MobileValueRow
              label="Balance due"
              value={formatPeso(bill.balance)}
              strong
            />
          </section>
        </div>
      </div>

      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={cn(HEAD, "pl-6")}>Description</TableHead>
              <TableHead className={cn(HEAD, "pr-6 text-right")}>Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map(({ category, items, subtotal }) => (
              <Fragment key={category}>
                {sectioned && (
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableCell className="text-foreground/70 py-1.5 pl-6 text-[11px] font-semibold tracking-wide uppercase">
                      {feeCategoryLabel(category)}
                    </TableCell>
                    <TableCell className="text-muted-foreground py-1.5 pr-6 text-right text-xs font-medium tabular-nums">
                      {formatPeso(subtotal)}
                    </TableCell>
                  </TableRow>
                )}
                {items.map((item) => (
                  <TableRow key={item.id ?? item.name}>
                    <TableCell
                      className={cn("py-2.5", sectioned ? "pl-9" : "pl-6")}
                    >
                      {item.name}
                    </TableCell>
                    <TableCell className="py-2.5 pr-6 text-right font-medium tabular-nums">
                      {formatPeso(item.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </Fragment>
            ))}
          </TableBody>
          <TableFooter className="bg-transparent">
            <TotalRow label="Subtotal" value={formatPeso(bill.total)} divide />
            {adjustments.length > 0
              ? adjustments.map((adjustment) => (
                  <TotalRow
                    key={adjustment.id}
                    label={discountLabel(adjustment)}
                    value={`- ${formatPeso(adjustment.amount)}`}
                    muted
                  />
                ))
              : bill.discountTotal > 0 && (
                  <TotalRow
                    label="Discount"
                    value={`- ${formatPeso(bill.discountTotal)}`}
                    muted
                  />
                )}
            <TotalRow
              label="Net total"
              value={formatPeso(bill.netTotal)}
              divide
            />
            <TotalRow label="Paid" value={formatPeso(bill.amountPaid)} />
            <TotalRow
              label="Balance due"
              value={formatPeso(bill.balance)}
              strong
              divide
            />
          </TableFooter>
        </Table>
      </div>
    </>
  );
}

export function ScheduleTable({
  installments,
}: {
  installments: BillInstallment[];
}) {
  const focusInstallment = nextOutstandingInstallment(installments);
  const focusInstallmentId = focusInstallment?.id;
  const focusIsOverdue =
    focusInstallment?.status === "overdue" ||
    isOverdue(focusInstallment?.dueDate ?? null);
  const totalAmount = installments.reduce((sum, installment) => sum + installment.amount, 0);
  const totalPaid = installments.reduce(
    (sum, installment) => sum + installment.amountPaid,
    0,
  );
  const remaining = installments.reduce(
    (sum, installment) => sum + installment.balance,
    0,
  );

  return (
    <>
      <div className="md:hidden">
        <div className="divide-y">
          {installments.map((installment) => {
            const meta = INSTALLMENT_STATUS_META[installment.status];
            const overdue = installment.status === "overdue";
            const isFocus = installment.id === focusInstallmentId;
            return (
              <section
                key={installment.id}
                className={cn(
                  "space-y-3 p-4",
                  isFocus &&
                    (focusIsOverdue
                      ? "bg-red-50/60 dark:bg-red-950/20"
                      : "bg-primary/5"),
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{installment.label}</p>
                      {isFocus && (
                        <Badge variant="secondary" className="font-normal">
                          {focusIsOverdue ? "Oldest unpaid" : "Next"}
                        </Badge>
                      )}
                    </div>
                    <p
                      className={cn(
                        "text-sm",
                        overdue
                          ? "font-medium text-red-600 dark:text-red-400"
                          : "text-muted-foreground",
                      )}
                    >
                      Due {installment.dueDate ? formatDate(installment.dueDate) : "—"}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn("justify-center", meta.className)}
                  >
                    {meta.label}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                      Amount
                    </p>
                    <p className="font-medium tabular-nums">
                      {formatPeso(installment.amount)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                      Paid
                    </p>
                    <p className="font-medium tabular-nums">
                      {formatPeso(installment.amountPaid)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                      Left
                    </p>
                    <p className="font-semibold tabular-nums">
                      {formatPeso(installment.balance)}
                    </p>
                  </div>
                </div>
              </section>
            );
          })}

          <section className="space-y-2 bg-muted/20 p-4">
            <MobileValueRow label="Scheduled total" value={formatPeso(totalAmount)} />
            <MobileValueRow label="Paid total" value={formatPeso(totalPaid)} />
            <MobileValueRow label="Remaining" value={formatPeso(remaining)} strong />
          </section>
        </div>
      </div>

      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={cn(HEAD, "pl-6")}>Installment</TableHead>
              <TableHead className={HEAD}>Due date</TableHead>
              <TableHead className={cn(HEAD, "text-right")}>Amount</TableHead>
              <TableHead className={cn(HEAD, "text-right")}>Paid</TableHead>
              <TableHead className={cn(HEAD, "pr-6 text-right")}>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {installments.map((installment) => {
              const meta = INSTALLMENT_STATUS_META[installment.status];
              const overdue = installment.status === "overdue";
              const isFocus = installment.id === focusInstallmentId;
              return (
                <TableRow
                  key={installment.id}
                  className={cn(
                    isFocus &&
                      (focusIsOverdue
                        ? "bg-red-50/60 hover:bg-red-50/60 dark:bg-red-950/20 dark:hover:bg-red-950/20"
                        : "bg-primary/5 hover:bg-primary/5"),
                  )}
                >
                  <TableCell className="py-2.5 pl-6 font-medium">
                    {installment.label}
                    {isFocus && (
                      <span
                        className={cn(
                          "ml-2 text-[11px] font-medium",
                          focusIsOverdue
                            ? "text-red-600 dark:text-red-400"
                            : "text-primary",
                        )}
                      >
                        {focusIsOverdue ? "Oldest unpaid" : "Next"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "py-2.5",
                      overdue
                        ? "font-medium text-red-600 dark:text-red-400"
                        : "text-muted-foreground",
                    )}
                  >
                    {installment.dueDate ? formatDate(installment.dueDate) : "—"}
                  </TableCell>
                  <TableCell className="py-2.5 text-right font-medium tabular-nums">
                    {formatPeso(installment.amount)}
                  </TableCell>
                  <TableCell className="text-muted-foreground py-2.5 text-right tabular-nums">
                    {formatPeso(installment.amountPaid)}
                  </TableCell>
                  <TableCell className="py-2.5 pr-6 text-right">
                    <Badge
                      variant="outline"
                      className={cn("w-24 justify-center", meta.className)}
                    >
                      {meta.label}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter className="bg-transparent">
            <TableRow className="border-border border-t hover:bg-transparent">
              <TableCell className="py-2.5 pl-6 font-semibold">Total</TableCell>
              <TableCell />
              <TableCell className="py-2.5 text-right font-semibold tabular-nums">
                {formatPeso(totalAmount)}
              </TableCell>
              <TableCell className="text-muted-foreground py-2.5 text-right tabular-nums">
                {formatPeso(totalPaid)}
              </TableCell>
              <TableCell className="text-muted-foreground py-2.5 pr-6 text-right text-xs">
                {formatPeso(remaining)} left
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </>
  );
}

export function PaymentsTable({ payments }: { payments: BillPayment[] }) {
  const verified = payments
    .filter((payment) => payment.status === "verified")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const pending = payments
    .filter((payment) => payment.status === "pending")
    .reduce((sum, payment) => sum + payment.amount, 0);

  return (
    <>
      <div className="md:hidden">
        <div className="divide-y">
          {payments.map((payment) => {
            const meta = PAYMENT_STATUS_META[payment.status];
            return (
              <section key={payment.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-semibold tabular-nums">
                      {formatPeso(payment.amount)}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {formatDate(payment.paidAt)} · {paymentMethodLabel(payment.method)}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn("justify-center", meta.className)}
                  >
                    {meta.label}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                      Reference
                    </p>
                    <p>{payment.reference || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                      Proof
                    </p>
                    {payment.proofUrl ? <ProofLink href={payment.proofUrl} /> : <p>—</p>}
                  </div>
                </div>

                {payment.note && (
                  <div className="space-y-1 text-sm">
                    <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                      Note
                    </p>
                    <p>{payment.note}</p>
                  </div>
                )}
              </section>
            );
          })}

          <section className="space-y-2 bg-muted/20 p-4">
            <MobileValueRow label="Verified total" value={formatPeso(verified)} strong />
            {pending > 0 && (
              <MobileValueRow label="Pending review" value={formatPeso(pending)} />
            )}
          </section>
        </div>
      </div>

      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={cn(HEAD, "pl-6")}>Date paid</TableHead>
              <TableHead className={HEAD}>Method</TableHead>
              <TableHead className={HEAD}>Reference</TableHead>
              <TableHead className={cn(HEAD, "text-right")}>Amount</TableHead>
              <TableHead className={cn(HEAD, "pr-6 text-right")}>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment) => {
              const meta = PAYMENT_STATUS_META[payment.status];
              return (
                <TableRow key={payment.id}>
                  <TableCell className="py-2.5 pl-6 font-medium">
                    {formatDate(payment.paidAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground py-2.5">
                    {paymentMethodLabel(payment.method)}
                  </TableCell>
                  <TableCell className="text-muted-foreground py-2.5 whitespace-normal">
                    <div className="space-y-1">
                      <p>{payment.reference || "—"}</p>
                      {payment.proofUrl && <ProofLink href={payment.proofUrl} />}
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5 text-right font-medium tabular-nums">
                    {formatPeso(payment.amount)}
                  </TableCell>
                  <TableCell className="py-2.5 pr-6 text-right">
                    <Badge
                      variant="outline"
                      className={cn("w-20 justify-center", meta.className)}
                    >
                      {meta.label}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter className="bg-transparent">
            <TableRow className="border-border border-t hover:bg-transparent">
              <TableCell className="py-2.5 pl-6 font-semibold">
                Verified total
              </TableCell>
              <TableCell />
              <TableCell />
              <TableCell className="py-2.5 text-right font-semibold tabular-nums">
                {formatPeso(verified)}
              </TableCell>
              <TableCell className="text-muted-foreground py-2.5 pr-6 text-right text-xs">
                {pending > 0 ? `${formatPeso(pending)} pending` : ""}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </>
  );
}

export function TabCount({ n }: { n: number }) {
  return (
    <Badge
      variant="secondary"
      className="ml-0.5 h-5 min-w-5 justify-center px-1 font-normal tabular-nums"
    >
      {n}
    </Badge>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  message,
}: {
  icon: LucideIcon;
  title: string;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
        <Icon className="size-6" />
      </div>
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground mx-auto max-w-sm text-sm">
          {message}
        </p>
      </div>
    </div>
  );
}
