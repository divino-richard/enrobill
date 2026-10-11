import { BILL_STATUS_META, type Bill } from './types';

export const COLLECTION_LABELS = {
  standard: 'Standard billing',
  deferred_until_reenrollment: 'Payable upon re-enrollment',
  required_for_reenrollment: 'Settle before completing re-enrollment',
} as const;

export function isDroppingBill(bill: Bill): boolean {
  return (bill.collectionState != null && bill.collectionState !== 'standard')
    || !!bill.droppingAssessment || bill.enrollmentStatus === 'dropped';
}

export function collectionLabel(bill: Bill): string {
  return COLLECTION_LABELS[bill.collectionState ?? (isDroppingBill(bill) ? 'deferred_until_reenrollment' : 'standard')];
}

export function billStatusMeta(bill: Bill) {
  return isDroppingBill(bill) && bill.balance > 0
    ? { label: collectionLabel(bill), className: 'border-border bg-muted text-foreground' }
    : BILL_STATUS_META[bill.status];
}
