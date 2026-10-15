import type { StudentReturnSummary } from './api';

export const STUDENT_RETURN_PATH = '/portal/programs?reenroll=1';

export const returnDate = (date: string) => new Intl.DateTimeFormat('en-PH', {month:'short',day:'numeric',year:'numeric',timeZone:'Asia/Manila'}).format(new Date(`${date}T00:00:00+08:00`));
export function returnActionLabel(data: StudentReturnSummary) {
  if (data.state === 'not_applicable' || data.state === 'enrolled') return null;
  if ((data.enrollment || data.state === 'pending') && !returnNeedsEligibilityReview(data) && !previousSettlementRequired(data)) return null;
  return data.canStart ? 'Re-enroll now' : 'View details';
}
export function previousSettlementRequired(data: StudentReturnSummary) {
  return (data.requirements?.previousBalance ?? data.previousBills.reduce((sum, bill) => sum + bill.balance, 0)) > 0;
}
export function returnVerificationPending(data: StudentReturnSummary) {
  const unpaid = data.previousBills.filter(bill => bill.balance > 0);
  return unpaid.length > 0 && unpaid.every(bill => bill.pendingPayment >= bill.balance);
}
export function returnNeedsEligibilityReview(data: StudentReturnSummary) {
  return data.state === 'blocked' || data.requirements?.eligible === false;
}
export function returnTitle(data: StudentReturnSummary) {
  if (returnNeedsEligibilityReview(data)) return 'Re-enrollment needs attention';
  if ((data.state === 'pending' || data.state === 'settlement_required') && previousSettlementRequired(data)) {
    return returnVerificationPending(data) ? 'Payment verification pending' : 'Settle your dropping balance to return';
  }
  if (data.state === 'pending' && !data.enrollment?.billId) return 'Re-enrollment submitted';
  return {settlement_required:'Settle your dropping balance to return',ready:'Ready to return to school?',unavailable:'Re-enrollment is not yet open',pending:'Your re-enrollment is in progress',blocked:'Re-enrollment needs attention',enrolled:'You’re enrolled again',not_applicable:'Re-enrollment'}[data.state];
}

export function returnDescription(data: StudentReturnSummary) {
  if (returnNeedsEligibilityReview(data)) return 'Review your eligibility with the school. Payment does not resolve an eligibility issue.';
  if ((data.state === 'pending' || data.state === 'settlement_required') && previousSettlementRequired(data)) {
    if (returnVerificationPending(data)) return 'Your submitted payment is awaiting cashier verification. It has not reduced the balance yet.';
    return data.state === 'pending'
      ? data.enrollment?.billId
        ? 'Settle your previous dropping balance first, then meet the new bill’s enrollment payment requirement.'
        : 'Settle your previous dropping balance first. Cashier billing remains blocked until settlement is verified.'
      : 'Pay your remaining dropping balance in full before starting re-enrollment.';
  }
  if (data.state === 'pending') return data.enrollment?.billId
    ? 'Meet the new bill’s enrollment payment requirement. Only verified payments and applied credits count.'
    : 'Your bill will appear once the cashier generates it.';
  if (data.state === 'ready') return `Admissions are open for SY ${data.offer?.schoolYear}.`;
  return 'Your account and records remain available. No payment or clearance is required now.';
}
