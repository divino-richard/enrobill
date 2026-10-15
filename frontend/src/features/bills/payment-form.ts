import type { PaymentChannel } from '@/features/payment-channels/types';

export const PAYMENT_PROOF_ACCEPT = 'image/png,image/jpeg';
export const MAX_PAYMENT_PROOF_BYTES = 5 * 1024 * 1024;
export const PAYMENT_REFERENCE_LIMIT = 100;
export const PAYMENT_NOTE_LIMIT = 255;

export interface PaymentDraft {
  amount: string;
  method: string;
  paidAt: string;
  reference: string;
  note: string;
  file: Pick<File, 'type' | 'size'> | null;
}
export type PaymentField = keyof PaymentDraft;
export type PaymentErrors = Partial<Record<PaymentField, string>>;

export function paymentToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

export function paymentProofError(file: PaymentDraft['file']): string | undefined {
  if (!file) return 'Choose a receipt to submit.';
  if (!['image/jpeg', 'image/png'].includes(file.type)) return 'Choose a JPG or PNG image.';
  if (file.size === 0) return 'This file is empty. Choose another receipt.';
  if (file.size > MAX_PAYMENT_PROOF_BYTES) return 'Choose an image no larger than 5 MB.';
}

export function validatePaymentDraft(draft: PaymentDraft, options: {
  minimum: number; balance: number; channels: Pick<PaymentChannel, 'code'>[]; today: string;
}): PaymentErrors {
  const errors: PaymentErrors = {};
  const amount = Number(draft.amount);
  const pesos = (value: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);
  if (!/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(draft.amount) || !Number.isFinite(amount) || amount <= 0) {
    errors.amount = 'Enter an amount greater than zero, with up to two decimal places.';
  } else if (Math.round(amount * 100) < Math.round(options.minimum * 100) || Math.round(amount * 100) > Math.round(options.balance * 100)) {
    errors.amount = `Enter between ${pesos(options.minimum)} and ${pesos(options.balance)}.`;
  }
  if (!draft.method || !options.channels.some(channel => channel.code === draft.method)) errors.method = 'Choose a payment method.';
  const date = new Date(`${draft.paidAt}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.paidAt) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== draft.paidAt) {
    errors.paidAt = 'Choose the date you made the payment.';
  } else if (draft.paidAt > options.today) errors.paidAt = 'Payment date cannot be in the future.';
  const fileError = paymentProofError(draft.file);
  if (fileError) errors.file = fileError;
  if (draft.reference.trim().length > PAYMENT_REFERENCE_LIMIT) errors.reference = 'Use no more than 100 characters.';
  if (draft.note.trim().length > PAYMENT_NOTE_LIMIT) errors.note = 'Use no more than 255 characters.';
  return errors;
}
