import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { formatPeso } from '@/lib/money';
import { INSTALLMENT_STATUS_META, type Bill } from '../types';
import { formatBillDate, upcomingInstallments } from '../staff-billing';

const disclosureClass = 'cursor-pointer rounded-sm text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring';

export function StaffBillSummary({ bill }: { bill: Bill }) {
  const adjustments = bill.adjustments ?? [];
  return <Card><CardHeader><h2 className="text-base font-semibold">Bill summary</h2></CardHeader><CardContent className="space-y-4">
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Fees</dt><dd className="font-medium tabular-nums">{formatPeso(bill.total)}</dd></div>
      {bill.discountTotal > 0 && <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Vouchers and incentives</dt><dd className="font-medium tabular-nums">−{formatPeso(bill.discountTotal)}</dd></div>}
      <div className="flex justify-between gap-4 border-t pt-2"><dt className="font-medium">Bill total</dt><dd className="font-semibold tabular-nums">{formatPeso(bill.netTotal)}</dd></div>
    </dl>
    <details className="border-t pt-4"><summary className={disclosureClass}>Fee breakdown · {bill.items.length} items</summary><dl className="mt-4 space-y-3 text-sm">{bill.items.map((item, index) => <div key={item.id ?? index} className="flex items-start justify-between gap-4"><dt className="min-w-0 break-words text-muted-foreground">{item.name}</dt><dd className="shrink-0 font-medium tabular-nums">{formatPeso(item.amount)}</dd></div>)}</dl></details>
    {adjustments.length === 0 ? <p className="text-sm text-muted-foreground">No vouchers or incentives applied.</p> : <details className="border-t pt-4"><summary className={disclosureClass}>Vouchers and incentives · {adjustments.length}</summary><ul className="mt-3 divide-y">{adjustments.map(adjustment => <li key={adjustment.id} className="flex justify-between gap-4 py-3 text-sm"><div className="min-w-0"><p className="break-words font-medium">{adjustment.label}</p><p className="text-muted-foreground">{adjustment.type === 'percentage' ? `${adjustment.value}%` : adjustment.type === 'full' ? 'Full coverage' : 'Fixed amount'}</p>{!!adjustment.reasons?.length && <p className="mt-1 break-words text-muted-foreground">{adjustment.reasons.join(' · ')}</p>}</div><span className="shrink-0 font-medium tabular-nums">−{formatPeso(adjustment.amount)}</span></li>)}</ul></details>}
  </CardContent></Card>;
}

export function StaffInstallmentPlan({ bill }: { bill: Bill }) {
  const [showAll, setShowAll] = useState(false);
  const installments = [...(bill.installments ?? [])].sort((a, b) => a.sequence - b.sequence);
  const outstanding = upcomingInstallments(installments);
  const visible = showAll ? installments : outstanding.slice(0, 3);
  const overdueCount = outstanding.filter(item => item.status === 'overdue').length;
  return <Card><CardHeader><h2 className="text-base font-semibold">Installment plan</h2><p className="text-sm text-muted-foreground">{bill.paymentArrangement ? 'Approved payment arrangement.' : bill.noDownpayment ? 'Down payment waived.' : 'Scheduled payments for this bill.'} {overdueCount > 0 ? `${overdueCount} overdue.` : ''}</p></CardHeader><CardContent className="space-y-3">
    {installments.length === 0 ? <p className="text-sm text-muted-foreground">No installment plan has been set.</p> : <>
      {!showAll && outstanding.length === 0 && <p className="text-sm text-muted-foreground">All installments are paid.</p>}
      <ul id="bill-installments" className="divide-y">{visible.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 first:pt-0"><div><p className="text-sm font-medium">{item.label}</p><p className="text-sm text-muted-foreground">{item.dueDate ? `Due ${formatBillDate(item.dueDate)}` : 'No due date set'}</p></div><div className="flex items-center gap-3"><div className="text-right text-sm tabular-nums"><p className="font-medium">{formatPeso(item.status === 'paid' ? item.amount : item.balance)}</p>{item.status === 'partial' && <p className="text-xs text-muted-foreground">Remaining of {formatPeso(item.amount)}</p>}</div><Badge variant="outline" className={INSTALLMENT_STATUS_META[item.status].className}>{INSTALLMENT_STATUS_META[item.status].label}</Badge></div></li>)}</ul>
      {(installments.length > visible.length || showAll) && <Button variant="outline" size="sm" aria-expanded={showAll} aria-controls="bill-installments" onClick={() => setShowAll(value => !value)}>{showAll ? 'Show upcoming only' : `View full schedule (${installments.length})`}</Button>}
    </>}
  </CardContent></Card>;
}
