import { useRef, useState } from 'react';
import { useAuthStore } from '@/features/auth/store';
import type { Term } from '@/features/terms/types';
import { feeYearLevelLabel, type SchoolYearFee } from './types';
import { useFeePaymentPreview, useFeePublication } from './hooks';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { getErrorMessage } from '@/lib/get-error-message';
import { formatPeso } from '@/lib/money';

export function FeePublication({ term, fees }: { term: Term; fees?: SchoolYearFee[] }) {
  const isAdmin = useAuthStore(state => state.user?.role === 'admin');
  const mutation = useFeePublication();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  const published = Boolean(term.feesPublishedAt);
  const missingTuition = ['grade_11', 'grade_12'].filter(level =>
    !fees?.some(fee => fee.category === 'tuition' && (fee.yearLevel === 'all' || fee.yearLevel === level)),
  );
  const policyReady = term.downpaymentValue != null && Number.isFinite(term.downpaymentValue) && term.downpaymentValue >= 0
    && Number.isInteger(term.installmentCount) && term.installmentCount >= 1 && term.installmentCount <= 24;
  const preview = useFeePaymentPreview(term.id, open && !published);
  const ready = fees !== undefined && missingTuition.length === 0 && policyReady;

  async function confirm() {
    if (mutation.isPending || (!published && (!ready || preview.isPending || preview.isFetching || preview.isError || !preview.data))) return;
    const action = published ? 'draft' : 'publish';
    try {
      await mutation.mutateAsync({ id: term.id, action });
      setOpen(false);
      setNotice(action === 'publish'
        ? `Fees published for SY ${term.schoolYear}.`
        : 'Fees returned to draft. Admissions are closed and new bill generation is paused.');
    } catch { /* Keep the dialog open with the recovery message. */ }
  }

  return <>
    {isAdmin && <Button ref={trigger}  variant="outline" disabled={mutation.isPending || fees === undefined} onClick={() => { mutation.reset(); setNotice(''); setOpen(true); }}>
      {published ? 'Return to draft' : 'Review & publish'}
    </Button>}
    <span role="status" aria-atomic="true" className="sr-only">{notice}</span>

    <AlertDialog open={open} onOpenChange={value => { if (!mutation.isPending) setOpen(value); }}>
      <AlertDialogContent className="w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto" onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus(); }}>
        <AlertDialogHeader className="text-left">
          <AlertDialogTitle>{published ? 'Return fees to draft?' : `Publish fees for SY ${term.schoolYear}?`}</AlertDialogTitle>
          <AlertDialogDescription>{published
            ? 'Admissions will close and new bill generation will pause. Existing bills keep their amounts. Review your changes, publish again, then reopen admissions from the academic year settings.'
            : 'Review both grades below. Publishing locks these fees and payment terms for applicant estimates and new bills. Open admissions separately in academic year settings.'}</AlertDialogDescription>
        </AlertDialogHeader>
        {!published && !ready && <ul className="list-disc space-y-1 pl-4 text-sm text-destructive">
          {missingTuition.map(level => <li key={level}>Add tuition for {feeYearLevelLabel(level)} before publishing.</li>)}
          {!policyReady && <li>Set a downpayment and 1–24 monthly installments in academic year settings.</li>}
        </ul>}
        {!published && (preview.isPending || preview.isFetching) && <p role="status" className="text-sm text-muted-foreground">Calculating the latest payment schedule…</p>}
        {!published && preview.isError && <div role="alert" className="space-y-2 text-sm"><p>Unable to load payment amounts. Retry before publishing.</p><Button variant="outline" disabled={preview.isFetching} onClick={() => void preview.refetch()}>Try again</Button></div>}
        {!published && !preview.isFetching && !preview.isError && preview.data && <div className="space-y-4">
          {preview.data.map(plan => <section key={plan.yearLevel} className="space-y-2" aria-label={`${plan.yearLevel === 'grade_11' ? 'Grade 11' : 'Grade 12'} payment preview`}>
            <h3 className="text-sm font-semibold">{plan.yearLevel === 'grade_11' ? 'Grade 11' : 'Grade 12'}</h3>
            <dl className="space-y-2 border-t pt-2 text-sm">
              <div className="flex justify-between gap-3"><dt>Annual total</dt><dd className="font-semibold tabular-nums">{formatPeso(plan.total)}</dd></div>
              <div className="flex justify-between gap-3"><dt>Downpayment</dt><dd className="tabular-nums">{formatPeso(plan.downpayment)}</dd></div>
              <div className="flex justify-between gap-3"><dt>Remaining balance</dt><dd className="tabular-nums">{formatPeso(plan.total - plan.downpayment)}</dd></div>
              {plan.installments.length > 1 && <div className="flex justify-between gap-3"><dt>Installments 1–{plan.installments.length - 1}</dt><dd className="shrink-0 tabular-nums">{formatPeso(plan.installments[0])} each</dd></div>}
              {plan.installments.length > 0 && <div className="flex justify-between gap-3"><dt>{plan.installments.length === 1 ? 'Monthly installment' : `Final installment (${plan.installments.length})`}</dt><dd className="tabular-nums">{formatPeso(plan.installments[plan.installments.length - 1])}</dd></div>}
            </dl>
            {plan.installments.length === 0 && <p className="text-sm text-muted-foreground">No monthly installments.</p>}
          </section>)}
          <p className="text-xs text-muted-foreground">Before approved vouchers or discounts. Any rounding adjustment is included in the final installment.</p>
        </div>}
        {mutation.isError && <p role="alert" className="text-sm text-destructive">{getErrorMessage(mutation.error)}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel  disabled={mutation.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction  disabled={mutation.isPending || (!published && (!ready || preview.isPending || preview.isFetching || preview.isError || !preview.data))} onClick={event => { event.preventDefault(); void confirm(); }}>{mutation.isPending ? 'Saving…' : published ? 'Return to draft' : 'Publish fees'}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
