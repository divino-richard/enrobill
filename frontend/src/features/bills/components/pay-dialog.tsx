import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CheckIcon, EyeIcon, FileImageIcon, Loader2Icon, UploadIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PaymentChannelState, PaymentMethodPicker } from './payment-methods-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DatePicker } from '@/components/form/date-picker';
import { FieldLabel } from '@/components/form/field-label';
import { DocumentPreviewDialog } from '@/components/document-viewer-dialog';
import { useActivePaymentChannels } from '@/features/payment-channels/hooks';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/format-bytes';
import { formatPeso } from '@/lib/money';
import { isDroppingBill } from '../collection';
import { uploadPaymentProof } from '../api';
import { useSubmitMyPayment } from '../hooks';
import type { Bill, PaymentMethod } from '../types';
import { nextOutstandingInstallment } from '../utils';
import { PAYMENT_NOTE_LIMIT, PAYMENT_PROOF_ACCEPT, PAYMENT_REFERENCE_LIMIT, paymentProofError, paymentToday, validatePaymentDraft, type PaymentErrors, type PaymentField } from '../payment-form';

function saveImage(url: string, name: string) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function FieldError({ name, errors }: { name: PaymentField; errors: PaymentErrors }) {
  return errors[name] ? <p id={`payment-${name}-error`} className="text-sm text-destructive">{errors[name]}</p> : null;
}

type Receipt = { file: File; url: string };
type SubmittedPayment = { amount: number; method: string; paidAt: string; reference: string };

function PaymentSubmissionSummary({ payment, billNumber }: { payment: SubmittedPayment; billNumber: string }) {
  return <section aria-label="Submitted payment details" className="mt-6 border-t pt-5">
    <dl className="grid grid-cols-1 gap-1 text-sm min-[400px]:grid-cols-[auto_minmax(0,1fr)] min-[400px]:gap-x-6 min-[400px]:gap-y-3">
      <dt className="text-muted-foreground">Amount submitted</dt>
      <dd className="mb-2 break-words font-medium tabular-nums [overflow-wrap:anywhere] min-[400px]:mb-0 min-[400px]:text-right">{formatPeso(payment.amount)}</dd>
      <dt className="text-muted-foreground">Payment method</dt>
      <dd className="mb-2 break-words font-medium [overflow-wrap:anywhere] min-[400px]:mb-0 min-[400px]:text-right">{payment.method}</dd>
      <dt className="text-muted-foreground">Date paid</dt>
      <dd className="mb-2 font-medium min-[400px]:mb-0 min-[400px]:text-right">{new Date(`${payment.paidAt}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</dd>
      <dt className="text-muted-foreground">Bill</dt>
      <dd className="font-medium tabular-nums min-[400px]:text-right">{billNumber}</dd>
      {payment.reference && <>
        <dt className="mt-2 text-muted-foreground min-[400px]:mt-0">Reference number</dt>
        <dd className="select-text break-words font-medium tabular-nums [overflow-wrap:anywhere] min-[400px]:text-right">{payment.reference}</dd>
      </>}
    </dl>
  </section>;
}

export function PayDialog({ bill, disabled, triggerClassName, triggerLabel = 'Make a payment' }: {
  bill: Bill; disabled?: boolean; triggerClassName?: string; triggerLabel?: string;
}) {
  const navigate = useNavigate();
  const channelsQuery = useActivePaymentChannels();
  const channels = channelsQuery.data ?? [];
  const submit = useSubmitMyPayment(bill.id);
  const dropping = isDroppingBill(bill);
  const minimum = !dropping && bill.amountDue > 0 ? bill.amountDue : 0.01;
  const suggested = !dropping && bill.amountDue > 0 ? bill.amountDue : nextOutstandingInstallment(bill.installments ?? [])?.balance ?? bill.balance;
  const billNumber = `BILL-${String(bill.id).padStart(5, '0')}`;
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(suggested));
  const [method, setMethod] = useState('');
  const [paidAt, setPaidAt] = useState(paymentToday);
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [errors, setErrors] = useState<PaymentErrors>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [success, setSuccess] = useState<SubmittedPayment | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const lock = useRef(false);
  const openedBefore = useRef(false);
  const uploadedProof = useRef<{ file: File; key: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLSpanElement>(null);
  const confirmationRef = useRef<HTMLHeadingElement>(null);
  const viewPaymentOnClose = useRef(false);
  const selectedChannel = channels.find(channel => channel.code === method);
  const today = paymentToday();
  const calendarToday = new Date(`${today}T00:00:00`);
  const dirty = Boolean(method || reference || note || receipt || amount !== String(suggested) || paidAt !== today);
  const channelsUnavailable = channelsQuery.isPending || channelsQuery.isError || channels.length === 0;

  useEffect(() => () => { if (receipt) URL.revokeObjectURL(receipt.url); }, [receipt]);
  useEffect(() => {
    if ((!dirty && !busy) || success) return;
    const protectDraft = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', protectDraft);
    return () => window.removeEventListener('beforeunload', protectDraft);
  }, [dirty, busy, success]);
  useEffect(() => { if (success) confirmationRef.current?.focus(); }, [success]);

  function clearError(field: PaymentField) {
    setErrors(current => ({ ...current, [field]: undefined }));
    setError('');
  }
  function pickReceipt(file: File | undefined) {
    if (!file || lock.current) return;
    const problem = paymentProofError(file);
    if (problem) {
      setErrors(current => ({ ...current, file: problem }));
      setAnnouncement(problem);
      return;
    }
    clearError('file');
    setReceipt({ file, url: URL.createObjectURL(file) });
    uploadedProof.current = null;
    setAnnouncement(`${file.name} selected. Preview it to check that the receipt is readable.`);
  }
  function focusError(next: PaymentErrors) {
    const first = (Object.keys(next) as PaymentField[]).find(field => next[field]);
    if (!first) return;
    requestAnimationFrame(() => {
      const field = first === 'paidAt' ? formRef.current?.querySelector<HTMLElement>('#payment-date') : formRef.current?.querySelector<HTMLElement>(`[data-payment-field="${first}"]`);
      field?.focus();
    });
  }
  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (lock.current || success || disabled || channelsUnavailable) return;
    setError('');
    const nextErrors = validatePaymentDraft({ amount, method, paidAt, reference, note, file: receipt?.file ?? null }, { minimum, balance: bill.balance, channels, today: paymentToday() });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setAnnouncement('Check the highlighted fields before submitting.');
      focusError(nextErrors);
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      let proofKey = uploadedProof.current?.file === receipt!.file ? uploadedProof.current.key : null;
      if (!proofKey) {
        setProgress(0);
        proofKey = await uploadPaymentProof(receipt!.file, setProgress);
        uploadedProof.current = { file: receipt!.file, key: proofKey };
      }
      setProgress(null);
      await submit.mutateAsync({ amount: Number(amount), method: method as PaymentMethod, reference: reference.trim() || null, paidAt, proofKey, note: note.trim() || null });
      setSuccess({ amount: Number(amount), method: selectedChannel!.label, paidAt, reference: reference.trim() });
      setReceipt(null);
      uploadedProof.current = null;
    } catch (failure) {
      const fieldErrors = axios.isAxiosError<{ errors?: Record<string, string[]> }>(failure) ? failure.response?.data?.errors : undefined;
      const mapped: PaymentErrors = {};
      for (const field of ['amount', 'method', 'paidAt', 'reference', 'note'] as const) {
        if (fieldErrors?.[field]?.[0]) mapped[field] = fieldErrors[field][0];
      }
      mapped.file = fieldErrors?.proofKey?.[0] ?? fieldErrors?.size?.[0] ?? fieldErrors?.contentType?.[0];
      setErrors(mapped);
      setError(fieldErrors?.payment?.[0] ?? (Object.values(mapped).some(Boolean)
        ? 'Check the highlighted fields and try again.'
        : 'Couldn’t confirm your submission. Your entries are kept. Try again, or check Payments before sending another transfer.'));
      focusError(mapped);
    } finally {
      lock.current = false;
      setBusy(false);
      setProgress(null);
    }
  }
  function changeOpen(next: boolean) {
    if (lock.current) return;
    if (next && !openedBefore.current) {
      setAmount(String(suggested));
      setPaidAt(paymentToday());
      openedBefore.current = true;
    }
    if (next && success) {
      setSuccess(null); setAmount(String(suggested)); setMethod(''); setPaidAt(paymentToday());
      setReference(''); setNote(''); setErrors({}); setError(''); setAnnouncement('');
      submit.reset();
    }
    setOpen(next);
  }
  const describedBy = (field: PaymentField, hint?: string) => [hint, errors[field] ? `payment-${field}-error` : null].filter(Boolean).join(' ') || undefined;

  return <Dialog open={open} onOpenChange={changeOpen}>
    <span ref={returnFocusRef} tabIndex={-1} aria-label="Bill payment" className={cn('outline-none', triggerClassName?.includes('w-full') && 'w-full')}>
      <DialogTrigger asChild><Button ref={triggerRef} disabled={disabled} className={triggerClassName}><UploadIcon aria-hidden="true" />{triggerLabel}</Button></DialogTrigger>
    </span>
    <DialogContent showCloseButton={false} className={cn('flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden rounded-xl p-0 shadow-none', success ? 'max-w-md' : 'max-w-xl')} onEscapeKeyDown={event => { if (lock.current) event.preventDefault(); }} onInteractOutside={event => { if (lock.current) event.preventDefault(); }} onCloseAutoFocus={event => {
      event.preventDefault();
      if (viewPaymentOnClose.current) {
        viewPaymentOnClose.current = false;
        navigate(`/portal/bills/${bill.id}?tab=payments`);
        requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-payment-history-tab]')?.focus());
      } else (triggerRef.current?.disabled ? returnFocusRef.current : triggerRef.current)?.focus();
    }}>
      {!success && <DialogHeader className="shrink-0 border-b px-5 py-4 pr-16 text-left sm:px-6 sm:pr-16">
        <DialogTitle className="leading-snug">Make a payment</DialogTitle>
        <DialogDescription>Submit your payment details and receipt for verification.</DialogDescription>
      </DialogHeader>}
      <Button type="button" variant="ghost" size="icon" className="absolute right-3 top-3 size-10" disabled={busy} onClick={() => changeOpen(false)} aria-label="Close payment dialog"><XIcon aria-hidden="true" /></Button>
      {success ? <>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-6 pb-2 pt-8 sm:px-8" aria-label="Payment submission confirmation">
          <DialogHeader className="items-center gap-0 text-center sm:text-center">
            <div className="mb-5 flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary" aria-hidden="true">
              <CheckIcon className="size-7" strokeWidth={2.5} />
            </div>
            <DialogTitle ref={confirmationRef} tabIndex={-1} className="text-xl leading-snug outline-none">Payment submitted</DialogTitle>
            <DialogDescription className="mt-2 max-w-xs leading-relaxed">Your balance will update after verification.</DialogDescription>
          </DialogHeader>
          <PaymentSubmissionSummary payment={success} billNumber={billNumber} />
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2 px-6 pb-6 pt-5 sm:px-8"><Button variant="outline" onClick={() => { viewPaymentOnClose.current = true; changeOpen(false); }}>View payment</Button><Button className="min-w-20" onClick={() => changeOpen(false)}>Done</Button></div>
      </> : <form ref={formRef} noValidate onSubmit={event => void handleSubmit(event)} aria-busy={busy} className="flex min-h-0 flex-col">
        <div className="min-h-0 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          <fieldset disabled={busy || disabled} className="min-w-0 space-y-4">
            <legend className="sr-only">Payment submission for {billNumber}</legend>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <FieldLabel htmlFor="payment-amount" required>Amount paid</FieldLabel>
                <Button type="button" variant="ghost" size="sm" className="h-auto px-0 py-1 text-xs text-primary" onClick={() => { setAmount(String(bill.balance)); clearError('amount'); }}>Full balance · {formatPeso(bill.balance)}</Button>
              </div>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground" aria-hidden="true">₱</span>
                <Input id="payment-amount" data-payment-field="amount" required inputMode="decimal" className="pl-7 tabular-nums" value={amount} onChange={event => { setAmount(event.target.value); clearError('amount'); }} aria-invalid={!!errors.amount} aria-describedby={describedBy('amount', minimum > 0.01 ? 'payment-amount-help' : undefined)} />
              </div>
              {minimum > 0.01 && <p id="payment-amount-help" className="text-xs text-muted-foreground">Minimum due: {formatPeso(minimum)}.</p>}
              <FieldError name="amount" errors={errors} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel htmlFor="payment-method" required className="min-h-6">Payment method</FieldLabel>
                <PaymentMethodPicker id="payment-method" channels={channels} initialMethod={method}
                  onChange={value => { setMethod(value); clearError('method'); }} invalid={!!errors.method} describedBy={describedBy('method')}
                  disabled={busy || !!disabled} loading={channelsQuery.isPending} failed={channelsQuery.isError}
                  retrying={channelsQuery.isFetching} onRetry={() => void channelsQuery.refetch()} />
                <FieldError name="method" errors={errors} />
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor="payment-date" required className="min-h-6">Date paid</FieldLabel>
                <DatePicker id="payment-date" value={paidAt} disabled={busy || disabled} onChange={value => { setPaidAt(value); clearError('paidAt'); }} endMonth={calendarToday} disabledDates={{ after: calendarToday }} aria-label={`Date paid (required), ${paidAt || 'choose a date'}`} aria-invalid={!!errors.paidAt} aria-describedby={describedBy('paidAt')} />
                <FieldError name="paidAt" errors={errors} />
              </div>
            </div>
            {channelsUnavailable && <PaymentChannelState loading={channelsQuery.isPending} failed={channelsQuery.isError} empty={!channels.length} retrying={channelsQuery.isFetching} onRetry={() => void channelsQuery.refetch()} />}
            <div className="space-y-2">
              <FieldLabel htmlFor="payment-proof-input" required>Payment receipt</FieldLabel>
              <div className={cn('rounded-lg border p-3', receipt ? 'border-primary/40 bg-primary/5' : 'border-dashed', errors.file && 'border-destructive')}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <FileImageIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <div className="min-w-0 space-y-1">
                      {receipt ? <><p className="break-words text-sm font-medium [overflow-wrap:anywhere]">{receipt.file.name}</p><p className="text-xs text-muted-foreground">{formatBytes(receipt.file.size)}</p></> : <p className="text-sm text-muted-foreground">Photo or screenshot</p>}
                      {!receipt && <p id="payment-proof-help" className="text-xs leading-relaxed text-muted-foreground">JPG or PNG · up to 5 MB. Keep payment details readable.</p>}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1 self-end sm:self-center">
                    {!receipt && <Button type="button" data-payment-field="file" variant="outline" size="sm" onClick={() => inputRef.current?.click()} aria-label="Upload payment receipt (required)" aria-describedby={describedBy('file', 'payment-proof-help')} aria-invalid={!!errors.file}><UploadIcon aria-hidden="true" />Upload</Button>}
                    {receipt && <>
                      <Button type="button" data-payment-field="file" variant="outline" size="sm" onClick={() => setPreviewOpen(true)} aria-describedby={describedBy('file')} aria-invalid={!!errors.file}><EyeIcon aria-hidden="true" />Preview</Button>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove receipt" onClick={() => { setReceipt(null); uploadedProof.current = null; clearError('file'); setAnnouncement('Receipt removed.'); }}><XIcon aria-hidden="true" /></Button>
                    </>}
                  </div>
                </div>
                <input ref={inputRef} id="payment-proof-input" type="file" required={!receipt} tabIndex={-1} className="sr-only" accept={PAYMENT_PROOF_ACCEPT} aria-describedby={describedBy('file', receipt ? undefined : 'payment-proof-help')} aria-invalid={!!errors.file} onChange={event => { pickReceipt(event.target.files?.[0]); event.target.value = ''; }} />
              </div>
              <FieldError name="file" errors={errors} />
            </div>
            <div className="space-y-2">
              <FieldLabel htmlFor="payment-reference" optional>Reference number</FieldLabel>
              <Input id="payment-reference" data-payment-field="reference" value={reference} maxLength={PAYMENT_REFERENCE_LIMIT} onChange={event => { setReference(event.target.value); clearError('reference'); }} aria-invalid={!!errors.reference} aria-describedby={describedBy('reference')} />
              <FieldError name="reference" errors={errors} />
            </div>
            <div className="space-y-2">
              <FieldLabel htmlFor="payment-note" optional>Note</FieldLabel>
              <Textarea id="payment-note" data-payment-field="note" rows={2} value={note} maxLength={PAYMENT_NOTE_LIMIT} onChange={event => { setNote(event.target.value); clearError('note'); }} aria-invalid={!!errors.note} aria-describedby={describedBy('note', 'payment-note-help')} />
              <p id="payment-note-help" className="text-xs text-muted-foreground">{note.length}/{PAYMENT_NOTE_LIMIT} characters</p>
              <FieldError name="note" errors={errors} />
            </div>
          </fieldset>
          <p role="status" aria-live="polite" className="sr-only">{announcement}</p>
          {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
          {disabled && <p role="status" className="mt-4 text-sm">A payment is already awaiting verification. Check Payments for its status before submitting another.</p>}
        </div>
        <footer className="shrink-0 border-t bg-card px-5 py-4 sm:px-6">
          <p role="status" className={busy ? 'mb-3 text-xs text-muted-foreground' : 'sr-only'}>{busy ? progress !== null ? `Uploading receipt… ${progress}%` : 'Submitting payment for verification…' : ''}</p>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => changeOpen(false)}>Cancel</Button>
            {(disabled || error) && <Button type="button" variant="outline" disabled={busy} onClick={() => { viewPaymentOnClose.current = true; changeOpen(false); }}>View payments</Button>}
            <Button type="submit" disabled={busy || channelsUnavailable || disabled} className="min-w-0 whitespace-normal">
              {busy && <Loader2Icon className="animate-spin" aria-hidden="true" />}
              {busy ? 'Submitting…' : 'Submit payment'}
            </Button>
          </div>
        </footer>
      </form>}
      <DocumentPreviewDialog document={previewOpen && receipt ? { url: receipt.url, fileName: receipt.file.name, contentType: receipt.file.type } : null} onOpenChange={setPreviewOpen} onDownload={() => { if (receipt) saveImage(receipt.url, receipt.file.name); }} />
    </DialogContent>
  </Dialog>;
}
