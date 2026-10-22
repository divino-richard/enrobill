import { useRef, useState, type Ref } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { formatPeso } from '@/lib/money';
import { getErrorMessage } from '@/lib/get-error-message';
import { useRejectPayment, useVerifyPayment } from '../hooks';
import { paymentMethodLabel, type Bill, type BillPayment } from '../types';
import { formatBillDate, paymentDecisionCopy, paymentDecisions, type PaymentDecision } from '../staff-billing';

export function PaymentReviewDetails({ bill, payment }: { bill: Bill; payment: BillPayment }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
      {[
        ['Amount', formatPeso(payment.amount)], ['Method', paymentMethodLabel(payment.method)],
        ['Date paid', formatBillDate(payment.paidAt)], ['Reference / OR no.', payment.reference || 'Not provided'],
        ['Student', bill.student?.name ?? `Bill #${bill.id}`], ['School year', bill.schoolYear ?? '—'],
      ].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-medium tabular-nums">{value}</dd></div>)}
      {(payment.submittedBy || payment.recordedBy) && <div className="col-span-2"><dt className="text-muted-foreground">{payment.submittedBy ? 'Submitted by' : 'Recorded by'}</dt><dd className="mt-1 break-words">{payment.submittedBy ?? payment.recordedBy}</dd></div>}
      {payment.note && <div className="col-span-2"><dt className="text-muted-foreground">Note</dt><dd className="mt-1 whitespace-pre-wrap break-words">{payment.note}</dd></div>}
    </dl>
  );
}

export function PaymentProofPreview({ payment }: { payment: BillPayment }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const url = payment.proofUrl;
  const isPdf = (url ?? '').split('?')[0].toLowerCase().endsWith('.pdf');
  if (!url) return <p className="text-sm text-muted-foreground">No proof is attached to this payment.</p>;
  if (failed) return (
    <div role="alert" className="space-y-3 rounded-lg border p-6 text-sm">
      <p>We couldn't load the proof. Try again.</p>
      <Button variant="outline" onClick={() => { setFailed(false); setAttempt(value => value + 1); }}>Retry proof</Button>
    </div>
  );
  return (
    <div className="flex min-h-48 items-center justify-center overflow-auto rounded-lg border bg-muted/30 p-2">
      {isPdf ? <iframe key={attempt} src={url} title="Payment proof document" className="h-[65dvh] w-full" onError={() => setFailed(true)} />
        : <img key={attempt} src={url} alt={`Proof for ${formatPeso(payment.amount)} paid on ${formatBillDate(payment.paidAt)}`} className="max-h-[65dvh] max-w-full object-contain" onError={() => setFailed(true)} />}
    </div>
  );
}

export function PaymentDecisionConfirmation({ decision, payment, busy, error, onBack, onConfirm, backRef, guard }: {
  decision: PaymentDecision; payment: BillPayment; busy: boolean; error: string | null;
  guard?: Bill['referralPaymentGuard'];
  onBack: () => void; onConfirm: () => void; backRef?: Ref<HTMLButtonElement>;
}) {
  const copy = paymentDecisionCopy(decision, payment, guard);
  return (
    <div aria-busy={busy} className="space-y-5">
      <AlertDialogHeader>
        <AlertDialogTitle>{copy.title}</AlertDialogTitle>
        <AlertDialogDescription>{copy.description}</AlertDialogDescription>
      </AlertDialogHeader>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <AlertDialogFooter>
        <Button ref={backRef} variant="outline" disabled={busy} onClick={onBack}>Cancel</Button>
        <Button variant={decision === 'verify' ? 'default' : 'destructive'} disabled={busy} onClick={onConfirm}>{busy ? copy.busy : copy.confirm}</Button>
      </AlertDialogFooter>
    </div>
  );
}

export function StaffPaymentReview({ bill, paymentId, readOnly, onClose, onSuccess }: {
  bill: Bill; paymentId: number; readOnly: boolean; onClose: () => void; onSuccess: (message: string) => void;
}) {
  const verify = useVerifyPayment(bill.id);
  const reject = useRejectPayment(bill.id);
  const [decision, setDecision] = useState<PaymentDecision | null>(null);
  const [proofOpen, setProofOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const decisionTrigger = useRef<HTMLButtonElement | null>(null);
  const confirmationBack = useRef<HTMLButtonElement>(null);
  const busy = verify.isPending || reject.isPending;
  const payment = bill.payments?.find(item => item.id === paymentId);
  const allowed = payment ? paymentDecisions(payment, readOnly, bill.referralPaymentGuard) : [];

  async function confirm() {
    if (!payment || !decision || !allowed.includes(decision) || inFlight.current) return;
    inFlight.current = true;
    setError(null);
    try {
      const mutation = decision === 'verify' ? verify : reject;
      await mutation.mutateAsync(payment.id);
      onSuccess(paymentDecisionCopy(decision, payment).success);
      onClose();
    } catch (cause) {
      setError(getErrorMessage(cause, 'The payment could not be updated. Please try again.'));
    } finally {
      inFlight.current = false;
    }
  }

  function backToReview() {
    if (inFlight.current) return;
    setDecision(null);
    setError(null);
  }

  const confirming = decision !== null && allowed.includes(decision);
  const childOpen = (proofOpen && !!payment?.proofUrl) || confirming;

  return <Dialog open onOpenChange={open => { if (!open && !inFlight.current && !childOpen) onClose(); }}>
    <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto p-4 sm:p-6" showCloseButton={!busy && !childOpen}
      onEscapeKeyDown={event => { if (inFlight.current || childOpen) event.preventDefault(); }}
      onInteractOutside={event => { if (inFlight.current || childOpen) event.preventDefault(); }}
      onCloseAutoFocus={event => {
      event.preventDefault();
      const trigger = document.getElementById(`review-payment-${paymentId}`);
      const target = trigger?.getClientRects().length ? trigger : document.getElementById('bill-payments-heading');
      target?.focus();
    }}>
      <DialogHeader className="pr-8">
        <DialogTitle>{allowed.length > 0 ? 'Review payment' : 'Payment details'}</DialogTitle>
        <DialogDescription>{bill.student?.name ?? `Bill #${bill.id}`} · {bill.student?.studentNumber ?? `Bill #${bill.id}`} · SY {bill.schoolYear ?? '—'}</DialogDescription>
      </DialogHeader>
      {!payment ? <p role="status">This payment is no longer on the bill. Close this panel to check the updated history.</p> : (
        <div className="min-w-0 space-y-5">
          <PaymentReviewDetails bill={bill} payment={payment} />
          <div className="flex flex-wrap items-center justify-between gap-3 border-y py-3">
            <p className="text-sm font-medium">Proof of payment</p>
            {payment.proofUrl ? (
              <Dialog open={proofOpen} onOpenChange={setProofOpen}>
                <DialogTrigger asChild><Button variant="ghost" size="sm" className="text-primary hover:text-primary aria-expanded:text-primary">View proof</Button></DialogTrigger>
                <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto p-4 sm:p-6">
                  <DialogHeader className="pr-8">
                    <DialogTitle>Proof of payment</DialogTitle>
                    <DialogDescription>{formatPeso(payment.amount)} · {formatBillDate(payment.paidAt)}</DialogDescription>
                  </DialogHeader>
                  <PaymentProofPreview key={payment.proofUrl} payment={payment} />
                </DialogContent>
              </Dialog>
            ) : <p className="text-sm text-muted-foreground">No proof attached.</p>}
          </div>
          {readOnly && <p className="text-sm text-muted-foreground">Only cashiers can verify or reject payments.</p>}
          {payment.status === 'pending' && bill.referralPaymentGuard && <p role="status" className="text-sm text-muted-foreground">Payment verification is on hold while this student's referral is resolved.</p>}
          {allowed.length > 0 && <div className="flex flex-wrap justify-end gap-2">
            {allowed.map(action => (
              <Button key={action} variant={action === 'verify' ? 'default' : 'outline'} disabled={busy} onClick={event => { decisionTrigger.current = event.currentTarget; setDecision(action); setError(null); }}>
                {action === 'verify' ? 'Verify payment' : 'Reject payment'}
              </Button>
            ))}
          </div>}
          {decision && confirming && (
            <AlertDialog open onOpenChange={open => { if (!open) backToReview(); }}>
              <AlertDialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto"
                onEscapeKeyDown={event => { if (inFlight.current) event.preventDefault(); }}
                onOpenAutoFocus={event => { event.preventDefault(); confirmationBack.current?.focus(); }}
                onCloseAutoFocus={event => { event.preventDefault(); if (decisionTrigger.current?.isConnected) decisionTrigger.current.focus(); }}>
                <PaymentDecisionConfirmation decision={decision} payment={payment} busy={busy} error={error} backRef={confirmationBack} guard={bill.referralPaymentGuard} onConfirm={() => void confirm()} onBack={backToReview} />
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      )}
    </DialogContent>
  </Dialog>;
}
