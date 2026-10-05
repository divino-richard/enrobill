import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { formatPeso } from '@/lib/money';
import { getErrorMessage } from '@/lib/get-error-message';
import type { Bill } from '@/features/bills/types';
import { COMPONENTS, philippinesToday, saveArrangement, saveClassification, type DroppingComponent } from './api';

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
    {(bill.previousBalance ?? 0) > 0 && <p className="text-sm text-muted-foreground">Previous balances remain on their original bills. Pay them or arrange payment with the school before a returning enrollment can activate.</p>}
    {hasCredit && <section className="space-y-2 border-t pt-4"><h3 className="text-sm font-semibold">Student credit history</h3><ul className="divide-y">{bill.creditHistory?.map(credit => <li key={credit.id} className="space-y-2 py-3 first:pt-0 last:pb-0"><div className="flex flex-wrap items-center justify-between gap-2 text-sm"><Link className="text-primary underline underline-offset-4" to={`${staff ? '/admin/billing' : '/portal/bills'}/${credit.sourceBillId}`}>From bill #{credit.sourceBillId}</Link><span className="font-medium tabular-nums">{formatPeso(credit.amount)} issued</span></div><p className="text-xs text-muted-foreground">{formatPeso(credit.allocated)} used · {formatPeso(credit.remaining)} available</p>{credit.allocations.length > 0 && <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">{credit.allocations.map(allocation => <li key={allocation.id}><Link className="text-primary underline underline-offset-4" to={`${staff ? '/admin/billing' : '/portal/bills'}/${allocation.billId}`}>Bill #{allocation.billId}: {formatPeso(allocation.amount - allocation.releasedAmount)} used</Link>{allocation.releasedAmount > 0 && <span className="text-muted-foreground"> · {formatPeso(allocation.releasedAmount)} released</span>}</li>)}</ul>}</li>)}</ul><p className="text-xs text-muted-foreground">Student credit comes from earlier payments. It is not a discount or another cash payment.</p></section>}
    {bill.paymentArrangement && <section className="space-y-2 border-t pt-4"><h3 className="text-sm font-semibold">Approved payment arrangement</h3><p className="text-sm whitespace-pre-wrap">{bill.paymentArrangement.remarks}</p><ul className="space-y-1 text-sm">{bill.paymentArrangement.installments.map((row, index) => <li className="flex justify-between gap-3" key={index}><span>Due {row.dueDate}</span><span className="tabular-nums">{formatPeso(row.amount)}</span></li>)}</ul><p className="text-xs text-muted-foreground">Keep these payments up to date to meet the returning-enrollment requirement.</p></section>}
  </CardContent></Card>;
}

export function ClassificationDialog({ bill }: { bill: Bill }) {
  const [open, setOpen] = useState(false);
  const busy = useIsMutating({ mutationKey: ['bill-finance-save', bill.id] }) > 0;
  return <Dialog open={open} onOpenChange={next => { if (!busy) setOpen(next); }}><Button variant="outline" size="sm" onClick={() => setOpen(true)} disabled={!!bill.droppingAssessment}>Classify fees</Button><DialogContent showCloseButton={!busy} className="w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Dropping fee classifications</DialogTitle><DialogDescription>Classify the original bill items once. Registration and laboratory fees must be separate from miscellaneous fees.</DialogDescription></DialogHeader>{open && <ClassificationForm bill={bill} onClose={() => setOpen(false)} />}</DialogContent></Dialog>;
}
function ClassificationForm({ bill, onClose }: { bill: Bill; onClose: () => void }) {
  const cache = useQueryClient();
  const [mapping, setMapping] = useState<Record<number, DroppingComponent | ''>>(() => Object.fromEntries(bill.items.filter(item => item.id != null).map(item => [item.id!, item.droppingComponent ?? ''])));
  const complete = bill.items.every(item => item.id != null && !!mapping[item.id]);
  const save = useMutation({ mutationKey: ['bill-finance-save', bill.id], mutationFn: () => saveClassification(bill.id, bill.items.map(item => ({ id: item.id!, component: mapping[item.id!] as DroppingComponent }))), onSuccess: () => { void cache.invalidateQueries(); onClose(); } });
  return <form className="space-y-4" onSubmit={e => { e.preventDefault(); save.mutate(); }}><div className="divide-y">{bill.items.map(item => <div key={item.id ?? item.name} className="grid items-center gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_12rem]"><div className="min-w-0"><Label htmlFor={`component-${item.id}`}>{item.name}</Label><p className="mt-1 text-xs text-muted-foreground tabular-nums">{formatPeso(item.amount)}</p></div><Select value={mapping[item.id!] ?? ''} onValueChange={value => setMapping({ ...mapping, [item.id!]: value as DroppingComponent })} disabled={save.isPending || item.id == null}><SelectTrigger id={`component-${item.id}`} className="w-full"><SelectValue placeholder="Choose classification" /></SelectTrigger><SelectContent>{COMPONENTS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent></Select></div>)}</div>{save.isError && <p role="alert" className="text-sm text-destructive">{getErrorMessage(save.error)}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={save.isPending} onClick={onClose}>Cancel</Button><Button disabled={!complete || save.isPending}>{save.isPending ? 'Saving…' : 'Save classifications'}</Button></div></form>;
}

export function PaymentArrangementDialog({ bill }: { bill: Bill }) {
  const [open, setOpen] = useState(false);
  const busy = useIsMutating({ mutationKey: ['bill-finance-save', bill.id] }) > 0;
  return <Dialog open={open} onOpenChange={next => { if (!busy) setOpen(next); }}><Button variant="outline" size="sm" disabled={bill.balance <= 0} onClick={() => setOpen(true)}>{bill.paymentArrangement ? 'Update arrangement' : 'Arrange payment'}</Button><DialogContent showCloseButton={!busy} className="w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Payment arrangement</DialogTitle><DialogDescription>Replace the remaining schedule for this bill. Cover the entire outstanding balance of {formatPeso(bill.balance)}.</DialogDescription></DialogHeader>{open && <ArrangementForm bill={bill} onClose={() => setOpen(false)} />}</DialogContent></Dialog>;
}
function ArrangementForm({ bill, onClose }: { bill: Bill; onClose: () => void }) {
  const cache = useQueryClient();
  const [remarks, setRemarks] = useState('');
  const [rows, setRows] = useState([{ dueDate: '', amount: bill.balance.toFixed(2) }]);
  const sum = rows.reduce((total, row) => total + Math.round(Number(row.amount || 0) * 100), 0);
  const valid = rows.length > 0 && rows.every(row => row.dueDate >= philippinesToday() && Number(row.amount) > 0) && new Set(rows.map(row => row.dueDate)).size === rows.length && sum === Math.round(bill.balance * 100) && !!remarks.trim();
  const save = useMutation({ mutationKey: ['bill-finance-save', bill.id], mutationFn: () => saveArrangement(bill.id, { remarks, installments: rows.map(row => ({ dueDate: row.dueDate, amount: Number(row.amount) })) }), onSuccess: () => { void cache.invalidateQueries(); onClose(); } });
  return <form className="space-y-4" onSubmit={e => { e.preventDefault(); save.mutate(); }}><div className="space-y-3">{rows.map((row, index) => <div className="flex items-end gap-2" key={index}><div className="min-w-0 flex-1 space-y-1.5"><Label htmlFor={`arrangement-date-${index}`}>Due date</Label><Input id={`arrangement-date-${index}`} type="date" required min={philippinesToday()} value={row.dueDate} disabled={save.isPending} onChange={e => setRows(rows.map((r, i) => i === index ? { ...r, dueDate: e.target.value } : r))} /></div><div className="min-w-0 flex-1 space-y-1.5"><Label htmlFor={`arrangement-amount-${index}`}>Amount</Label><Input id={`arrangement-amount-${index}`} type="number" step="0.01" min="0.01" required value={row.amount} disabled={save.isPending} onChange={e => setRows(rows.map((r, i) => i === index ? { ...r, amount: e.target.value } : r))} /></div><Button type="button" variant="ghost" size="icon" disabled={save.isPending || rows.length === 1} aria-label={`Remove installment ${index + 1}`} onClick={() => setRows(rows.filter((_, i) => i !== index))}><Trash2Icon /></Button></div>)}</div><div className="flex flex-wrap items-center justify-between gap-3"><Button type="button" variant="outline" size="sm" disabled={save.isPending || rows.length >= 24} onClick={() => setRows([...rows, { dueDate: '', amount: '' }])}><PlusIcon />Add installment</Button><p className="text-sm tabular-nums" role="status">{formatPeso(sum / 100)} of {formatPeso(bill.balance)}</p></div><p className="text-xs text-muted-foreground">Use a different due date for each installment, starting today or later.</p><div className="space-y-2"><Label htmlFor="arrangement-remarks">Arrangement notes</Label><Textarea id="arrangement-remarks" required maxLength={2000} value={remarks} disabled={save.isPending} onChange={e => setRemarks(e.target.value)} /></div>{save.isError && <p role="alert" className="text-sm text-destructive">{getErrorMessage(save.error)}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={save.isPending} onClick={onClose}>Cancel</Button><Button disabled={!valid || save.isPending}>{save.isPending ? 'Saving…' : 'Approve arrangement'}</Button></div></form>;
}
