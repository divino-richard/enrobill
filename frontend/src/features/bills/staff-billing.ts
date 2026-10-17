import type { BillInstallment, BillPayment } from './types';
import { formatPeso } from '@/lib/money';

export type PaymentDecision = 'verify' | 'reject';

export function formatBillDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00+08:00` : value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric',
  }).format(date);
}

export function paymentDecisions(payment: BillPayment, readOnly: boolean): PaymentDecision[] {
  return !readOnly && payment.status === 'pending' ? ['verify', 'reject'] : [];
}

export function paymentDecisionCopy(decision: PaymentDecision, payment: BillPayment) {
  const amount = formatPeso(payment.amount);
  if (decision === 'verify') return {
    title: `Verify ${amount}?`,
    description: 'Confirm that this payment was received by the school. It will count as verified, the balance will be recalculated, and the student will be notified.',
    confirm: 'Confirm verification', busy: 'Verifying…', success: `Payment of ${amount} verified. The balance has been updated.`,
  };
  return {
    title: `Reject ${amount}?`,
    description: 'This payment will not reduce the balance. The student will be notified and can submit another payment.',
    confirm: 'Confirm rejection', busy: 'Rejecting…', success: `Payment of ${amount} rejected. The balance is unchanged.`,
  };
}

export function upcomingInstallments(installments: BillInstallment[]) {
  return installments.filter(item => item.balance > 0 && item.status !== 'paid').sort((a, b) =>
    (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.sequence - b.sequence,
  );
}
