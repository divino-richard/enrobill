import { useState } from 'react';
import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getErrorMessage } from '@/lib/get-error-message';
import { formatPeso } from '@/lib/money';
import { termsQueryKey } from '@/features/terms/hooks';
import { discountsQueryKey } from '@/features/discounts/hooks';
import { fetchTerms } from '@/features/terms/api';
import { fetchPrograms } from '@/features/programs/api';
import { fetchAllDiscounts } from '@/features/discounts/api';
import { createReturningEnrollment, fetchReturningSummary } from './api';

export function ReturningEnrollmentDialog({ studentId }: { studentId: number }) {
  const [open, setOpen] = useState(false);
  const busy = useIsMutating({ mutationKey: ['returning-enrollment-save', studentId] }) > 0;
  return <Dialog open={open} onOpenChange={next => { if (!busy) setOpen(next); }}><Button variant="outline" size="sm" onClick={() => setOpen(true)}>Enroll again</Button><DialogContent showCloseButton={!busy} className="w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Enroll for a new school year</DialogTitle><DialogDescription>Keep the same student number and account. Previous enrollment records stay unchanged.</DialogDescription></DialogHeader>{open && <ReturningForm studentId={studentId} onClose={() => setOpen(false)} />}</DialogContent></Dialog>;
}
function ReturningForm({ studentId, onClose }: { studentId: number; onClose: () => void }) {
  const cache = useQueryClient();
  const summary = useQuery({ queryKey: ['returning-summary', studentId], queryFn: () => fetchReturningSummary(studentId) });
  const terms = useQuery({ queryKey: termsQueryKey, queryFn: fetchTerms });
  const programs = useQuery({ queryKey: ['programs'], queryFn: fetchPrograms });
  const discounts = useQuery({ queryKey: [...discountsQueryKey, 'all'], queryFn: fetchAllDiscounts });
  const [schoolYearId, setSchoolYearId] = useState('');
  const [program, setProgram] = useState('');
  const [yearLevel, setYearLevel] = useState('');
  const [discountId, setDiscountId] = useState('none');
  const save = useMutation({ mutationKey: ['returning-enrollment-save', studentId], mutationFn: () => createReturningEnrollment(studentId, { schoolYearId: Number(schoolYearId), program, yearLevel, discountId: discountId === 'none' ? null : Number(discountId) }), onSuccess: () => { void cache.invalidateQueries(); onClose(); } });
  const queryError = summary.error || terms.error || programs.error || discounts.error;
  if (queryError) return <div className="space-y-3"><p role="alert" className="text-sm text-destructive">{getErrorMessage(queryError)}</p><Button variant="outline" onClick={() => { void summary.refetch(); void terms.refetch(); void programs.refetch(); void discounts.refetch(); }}>Try again</Button></div>;
  if (summary.isPending || terms.isPending || programs.isPending || discounts.isPending) return <p role="status" className="text-sm">Loading enrollment options…</p>;
  const eligibleYears = (terms.data ?? []).filter(t => !summary.data.latestSchoolYear || t.schoolYear > summary.data.latestSchoolYear);
  const selectedYear = terms.data?.find(t => String(t.id) === schoolYearId);
  return <form className="space-y-4" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
    {summary.data.returnDeadline && <div className="space-y-1 border-b pb-4"><p className="text-sm font-semibold">Complete by {new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' }).format(new Date(`${summary.data.returnDeadline}T00:00:00+08:00`))}</p><p className="text-xs leading-relaxed text-muted-foreground">Enrollment must become active by this date, in Asia/Manila time. Starting now does not extend the deadline.</p></div>}
    <dl className="space-y-2 rounded-lg bg-muted/40 p-3 text-sm"><div className="flex justify-between gap-3"><dt>Previous dropping balance</dt><dd className="font-medium tabular-nums">{formatPeso(summary.data.previousBalance)}</dd></div><div className="flex justify-between gap-3"><dt>Available student credit</dt><dd className="font-medium tabular-nums">{formatPeso(summary.data.availableCredit)}</dd></div></dl>
    {!summary.data.eligible && <div role="status" className="space-y-1 text-sm text-destructive">{summary.data.blockers.map(issue => <p key={issue}>{issue}</p>)}</div>}
    <div className="space-y-2"><Label htmlFor="return-year">School year</Label><Select value={schoolYearId} onValueChange={setSchoolYearId} disabled={save.isPending}><SelectTrigger id="return-year" className="w-full"><SelectValue placeholder="Choose a later school year" /></SelectTrigger><SelectContent>{eligibleYears.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.schoolYear}</SelectItem>)}</SelectContent></Select>{eligibleYears.length === 0 && <p className="text-xs text-muted-foreground">Add a later academic year before creating this enrollment.</p>}</div>
    <div className="space-y-2"><Label htmlFor="return-program">Program</Label><Select value={program} onValueChange={setProgram} disabled={save.isPending}><SelectTrigger id="return-program" className="w-full"><SelectValue placeholder="Choose program" /></SelectTrigger><SelectContent>{programs.data?.filter(p => p.isActive).map(p => <SelectItem key={p.id} value={p.code}>{p.name}</SelectItem>)}</SelectContent></Select></div>
    <div className="space-y-2"><Label htmlFor="return-grade">Grade level</Label><Select value={yearLevel} onValueChange={setYearLevel} disabled={save.isPending}><SelectTrigger id="return-grade" className="w-full"><SelectValue placeholder="Choose grade level" /></SelectTrigger><SelectContent><SelectItem value="grade_11">Grade 11</SelectItem><SelectItem value="grade_12">Grade 12</SelectItem></SelectContent></Select></div>
    <div className="space-y-2"><Label htmlFor="return-voucher">New voucher eligibility</Label><Select value={discountId} onValueChange={setDiscountId} disabled={save.isPending}><SelectTrigger id="return-voucher" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No voucher</SelectItem>{discounts.data?.filter(d => d.isActive && d.category === 'voucher').map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground">Voucher eligibility is assessed for the new school year.</p></div>
    {selectedYear && <section className="space-y-1 border-t pt-4 text-sm"><h3 className="font-medium">New school year’s payment requirement</h3><p>{discountId !== 'none' ? 'Downpayment waived with an eligible voucher.' : selectedYear.downpaymentValue <= 0 ? 'The first installment, confirmed on the new bill.' : selectedYear.downpaymentType === 'percentage' ? `${selectedYear.downpaymentValue}% of the new bill’s assessment.` : `${formatPeso(selectedYear.downpaymentValue)} downpayment, capped at the new bill total.`}</p><p className="text-xs leading-relaxed text-muted-foreground">The new bill confirms the amount after applicable benefits and student credits.</p></section>}
    <p className="text-xs leading-relaxed text-muted-foreground">Full previous settlement and the new bill’s payment requirement are both needed for activation. Only verified payments and applied credits count; payment arrangements do not qualify.</p>
    {save.isError && <p role="alert" className="text-sm text-destructive">{getErrorMessage(save.error)}</p>}
    <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={save.isPending} onClick={onClose}>Cancel</Button><Button disabled={!summary.data.eligible || !schoolYearId || !program || !yearLevel || save.isPending}>{save.isPending ? 'Creating…' : 'Create enrollment'}</Button></div>
  </form>;
}
