import { useRef, useState } from 'react';
import { PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FieldLabel } from '@/components/form/field-label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatPeso } from '@/lib/money';
import { getErrorMessage } from '@/lib/get-error-message';
import { useRecordPayment } from '../hooks';
import { paymentToday, PAYMENT_NOTE_LIMIT, PAYMENT_REFERENCE_LIMIT } from '../payment-form';
import { PAYMENT_METHOD_OPTIONS, type Bill, type PaymentMethod } from '../types';

export function StaffRecordPayment({ bill, onSuccess }: { bill: Bill; onSuccess: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [paidAt, setPaidAt] = useState(paymentToday());
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const record = useRecordPayment(bill.id);
  const pending = bill.payments?.some(payment => payment.status === 'pending') ?? false;

  function changeOpen(next: boolean) {
    if (saving.current) return;
    if (next) {
      setAmount(bill.amountDue > 0 ? String(Math.min(bill.amountDue, bill.balance)) : '');
      setMethod('cash'); setPaidAt(paymentToday()); setReference(''); setNote(''); setError(null); record.reset();
    }
    setOpen(next);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || pending) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0 || Math.round(value * 100) > Math.round(bill.balance * 100)) {
      setError(`Enter an amount from ₱0.01 to ${formatPeso(bill.balance)}.`);
      return;
    }
    saving.current = true;
    setError(null);
    try {
      await record.mutateAsync({ amount: value, method, paidAt, reference: reference.trim() || null, note: note.trim() || null });
      setOpen(false);
      onSuccess(`Payment of ${formatPeso(value)} recorded and verified. The balance has been updated.`);
    } catch (cause) {
      setError(getErrorMessage(cause, 'The payment could not be recorded. Please try again.'));
    } finally {
      saving.current = false;
    }
  }

  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild><Button ref={trigger} variant={pending ? 'outline' : 'default'} disabled={pending || bill.balance <= 0}><PlusIcon aria-hidden="true" />Record payment</Button></DialogTrigger>
    <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto" showCloseButton={!record.isPending} onCloseAutoFocus={event => {
      if (trigger.current?.disabled) {
        event.preventDefault();
        document.getElementById('bill-payments-heading')?.focus();
      }
    }}>
      <DialogHeader><DialogTitle>Record payment</DialogTitle><DialogDescription>Balance: {formatPeso(bill.balance)}. Due now: {formatPeso(bill.amountDue)}. Only record money the school has received; this is saved as a verified payment.</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={event => void save(event)} aria-busy={record.isPending}>
        <fieldset disabled={record.isPending} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><FieldLabel htmlFor="staff-payment-amount" required>Amount</FieldLabel><Input id="staff-payment-amount" type="number" inputMode="decimal" min="0.01" max={bill.balance} step="0.01" required value={amount} onChange={event => setAmount(event.target.value)} /></div>
            <div className="space-y-1.5"><FieldLabel htmlFor="staff-payment-method" required>Method</FieldLabel><Select value={method} onValueChange={value => setMethod(value as PaymentMethod)} disabled={record.isPending}><SelectTrigger id="staff-payment-method" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{PAYMENT_METHOD_OPTIONS.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><FieldLabel htmlFor="staff-payment-date" required>Date paid</FieldLabel><Input id="staff-payment-date" type="date" required max={paymentToday()} value={paidAt} onChange={event => setPaidAt(event.target.value)} /></div>
            <div className="space-y-1.5"><FieldLabel htmlFor="staff-payment-reference">Reference / OR no.</FieldLabel><Input id="staff-payment-reference" maxLength={PAYMENT_REFERENCE_LIMIT} value={reference} onChange={event => setReference(event.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><FieldLabel htmlFor="staff-payment-note">Note</FieldLabel><Textarea id="staff-payment-note" maxLength={PAYMENT_NOTE_LIMIT} value={note} onChange={event => setNote(event.target.value)} /></div>
        </fieldset>
        {pending && <p role="alert" className="text-sm text-muted-foreground">A payment is now awaiting verification. Close this form and review it before recording another payment.</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" disabled={record.isPending} onClick={() => changeOpen(false)}>Cancel</Button><Button type="submit" disabled={record.isPending || pending}>{record.isPending ? 'Recording…' : 'Record payment'}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
