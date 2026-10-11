import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { formatPeso } from '@/lib/money';
import { getErrorMessage } from '@/lib/get-error-message';
import { useFees } from '@/features/fees/hooks';
import type { Bill } from '@/features/bills/types';
import { COMPONENTS, saveClassification, type DroppingComponent } from './api';

export function BillFinanceSummary({ bill, staff = false }: { bill: Bill; staff?: boolean }) {
  const assessment = bill.droppingAssessment;
  const hasCredit = (bill.creditHistory?.length ?? 0) > 0 || (bill.availableCredit ?? 0) > 0 || (bill.creditApplied ?? 0) > 0;
  if (!assessment && !hasCredit && !(bill.previousBalance ?? 0) && !bill.paymentArrangement) return null;
  return <Card><CardHeader><CardTitle className="text-base">{assessment ? 'Dropping assessment' : 'Student account'}</CardTitle></CardHeader><CardContent className="space-y-4">
    <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
      {assessment && <><div><dt className="text-muted-foreground">Original assessment</dt><dd className="mt-1 font-medium tabular-nums">{formatPeso(bill.assessmentOriginalTotal ?? assessment.originalTotal)}</dd></div><div><dt className="text-muted-foreground">Final dropping charge</dt><dd className="mt-1 font-semibold tabular-nums">{formatPeso(bill.netTotal)}</dd></div></>}
      {!assessment && <><div><dt className="text-muted-foreground">Previous balance</dt><dd className="mt-1 font-medium tabular-nums">{formatPeso(bill.previousBalance ?? 0)}</dd></div><div><dt className="text-muted-foreground">This school-year balance</dt><dd className="mt-1 font-semibold tabular-nums">{formatPeso(bill.balance)}</dd></div></>}
      <div><dt className="text-muted-foreground">Student credit used here</dt><dd className="mt-1 font-medium tabular-nums">{formatPeso(bill.creditApplied ?? 0)}</dd></div><div><dt className="text-muted-foreground">Available student credit</dt><dd className="mt-1 font-medium tabular-nums">{formatPeso(bill.availableCredit ?? 0)}</dd></div>
    </dl>
    {assessment && <p className="text-xs text-muted-foreground">Effective {assessment.effectiveDate} · Policy version {assessment.policyVersion}. Original vouchers and incentives are kept in history; they do not reduce this final charge.</p>}
    {(bill.previousBalance ?? 0) > 0 && <p className="text-sm text-muted-foreground">Previous balances remain on their original bills. Settle them fully before a returning enrollment can activate. Pending payments and payment arrangements do not meet this requirement.</p>}
    {hasCredit && <section className="space-y-2 border-t pt-4"><h3 className="text-sm font-semibold">Student credit history</h3><ul className="divide-y">{bill.creditHistory?.map(credit => <li key={credit.id} className="space-y-2 py-3 first:pt-0 last:pb-0"><div className="flex flex-wrap items-center justify-between gap-2 text-sm"><Link className="text-primary underline underline-offset-4" to={`${staff ? '/admin/billing' : '/portal/bills'}/${credit.sourceBillId}`}>From bill #{credit.sourceBillId}</Link><span className="font-medium tabular-nums">{formatPeso(credit.amount)} issued</span></div><p className="text-xs text-muted-foreground">{formatPeso(credit.allocated)} used · {formatPeso(credit.remaining)} available</p>{credit.allocations.length > 0 && <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">{credit.allocations.map(allocation => <li key={allocation.id}><Link className="text-primary underline underline-offset-4" to={`${staff ? '/admin/billing' : '/portal/bills'}/${allocation.billId}`}>Bill #{allocation.billId}: {formatPeso(allocation.amount - allocation.releasedAmount)} used</Link>{allocation.releasedAmount > 0 && <span className="text-muted-foreground"> · {formatPeso(allocation.releasedAmount)} released</span>}</li>)}</ul>}</li>)}</ul><p className="text-xs text-muted-foreground">Student credit comes from earlier payments. It is not a discount or another cash payment.</p></section>}

  </CardContent></Card>;
}

export function ClassificationDialog({ bill }: { bill: Bill }) {
  const [open, setOpen] = useState(false);
  const busy = useIsMutating({ mutationKey: ['bill-finance-save', bill.id] }) > 0;
  return <Dialog open={open} onOpenChange={next => { if (!busy) setOpen(next); }}><Button variant="outline" size="sm" onClick={() => setOpen(true)} disabled={!!bill.droppingAssessment}>Classify fees</Button><DialogContent showCloseButton={!busy} className="w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Original bill fees</DialogTitle><DialogDescription>Link original bill lines to the fee schedule. Category-based policies also require a classification.</DialogDescription></DialogHeader>{open && <ClassificationForm bill={bill} onClose={() => setOpen(false)} />}</DialogContent></Dialog>;
}
function ClassificationForm({ bill, onClose }: { bill: Bill; onClose: () => void }) {
  const cache = useQueryClient();
  const fees = useFees(bill.schoolYearId);
  const [sources, setSources] = useState<Record<number, number | null>>(() => Object.fromEntries(bill.items.map(item => [item.id!, item.sourceFeeId ?? null])));
  const [mapping, setMapping] = useState<Record<number, DroppingComponent | ''>>(() => Object.fromEntries(bill.items.filter(item => item.id != null).map(item => [item.id!, item.droppingComponent ?? ''])));
  const complete = bill.items.every(item => item.id != null && (!!mapping[item.id] || !!sources[item.id]));
  const save = useMutation({ mutationKey: ['bill-finance-save', bill.id], mutationFn: () => saveClassification(bill.id, bill.items.map(item => ({ id: item.id!, component: mapping[item.id!] || null, sourceFeeId: sources[item.id!] }))), onSuccess: () => { void cache.invalidateQueries(); onClose(); } });
  return <form className="space-y-4" onSubmit={e => { e.preventDefault(); save.mutate(); }}><div className="divide-y">{bill.items.map(item => <div key={item.id ?? item.name} className="grid items-center gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_12rem]"><div className="min-w-0"><Label htmlFor={`component-${item.id}`}>{item.name}</Label><p className="mt-1 text-xs text-muted-foreground tabular-nums">{formatPeso(item.amount)}</p></div><div className="space-y-2"><Label htmlFor={`source-${item.id}`} className="text-xs">Fee schedule item</Label><Select value={sources[item.id!] ? String(sources[item.id!]) : 'none'} onValueChange={value => setSources({ ...sources, [item.id!]: value === 'none' ? null : Number(value) })} disabled={save.isPending || fees.isPending || fees.isError}><SelectTrigger id={`source-${item.id}`} className="w-full"><SelectValue placeholder="Link a fee" /></SelectTrigger><SelectContent><SelectItem value="none">Not linked</SelectItem>{sources[item.id!] && !fees.data?.some(fee => fee.id === sources[item.id!]) && <SelectItem value={String(sources[item.id!])}>Previously linked fee</SelectItem>}{fees.data?.map(fee => <SelectItem key={fee.id} value={String(fee.id)}>{fee.name} · {fee.yearLevel.replaceAll('_', ' ')}</SelectItem>)}</SelectContent></Select><Label htmlFor={`component-${item.id}`} className="text-xs">Legacy classification</Label><Select value={mapping[item.id!] ?? ''} onValueChange={value => setMapping({ ...mapping, [item.id!]: value as DroppingComponent })} disabled={save.isPending || item.id == null}><SelectTrigger id={`component-${item.id}`} className="w-full"><SelectValue placeholder="Choose classification" /></SelectTrigger><SelectContent>{COMPONENTS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent></Select></div></div>)}</div>{fees.isError && <p role="alert" className="text-sm text-destructive">Unable to load fee schedule links. <button type="button" className="underline" onClick={() => fees.refetch()}>Try again</button></p>}{save.isError && <p role="alert" className="text-sm text-destructive">{getErrorMessage(save.error)}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={save.isPending} onClick={onClose}>Cancel</Button><Button disabled={!complete || save.isPending}>{save.isPending ? 'Saving…' : 'Save classifications'}</Button></div></form>;
}
