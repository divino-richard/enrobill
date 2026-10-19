import type { Bill } from './types';

export function appliedCreditLines(bill: Pick<Bill, 'appliedCredits' | 'creditApplied'>, fallbackLabel = 'Student credit applied') {
  if (bill.appliedCredits !== undefined) return bill.appliedCredits.filter(credit => credit.amount > 0);
  return (bill.creditApplied ?? 0) > 0
    ? [{ kind: 'student_credit', label: fallbackLabel, amount: bill.creditApplied! }]
    : [];
}
