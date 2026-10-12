import type { Bill } from './types';

export interface ApprovedChargeLine {
  name: string;
  base: number;
  percent: number;
  amount: number;
}

const componentNames: Record<string, string> = {
  registration: 'Registration', miscellaneous: 'Miscellaneous fees',
  laboratory: 'Laboratory fees', tuition: 'Tuition', other: 'Other fees',
  total: 'Original assessment',
};
const periodNames: Record<string, string> = {
  enrollment: 'Enrollment period', quarter_1: 'First quarter', quarter_2: 'Second quarter',
  quarter_3: 'Third quarter', quarter_4: 'Final quarter',
};

export function droppingAssessmentContext(bill: Pick<Bill, 'droppingAssessment'>): string {
  const assessment = bill.droppingAssessment;
  if (!assessment) return 'Historical enrollment balance';
  return [assessment.period && periodNames[assessment.period],
    assessment.category && (assessment.category === 'paying' ? 'Paying' : 'With voucher')]
    .filter(Boolean).join(' · ');
}

/** Use only the frozen approval, never today's catalog or policy. */
export function approvedChargeLines(bill: Pick<Bill, 'droppingAssessment'>): ApprovedChargeLine[] {
  const assessment = bill.droppingAssessment;
  if (!assessment || assessment.finalCharge == null) return [];
  const formula = assessment.category && assessment.period
    ? assessment.formulas?.[assessment.category]?.[assessment.period] : null;
  const bases = assessment.feeCharges?.length
    ? assessment.feeCharges.map(fee => ({ name: fee.name, base: fee.originalAmount, percent: fee.percent }))
    : Object.entries(formula ?? {}).filter(([, percent]) => percent > 0).map(([key, percent]) => ({
      name: componentNames[key] ?? key,
      base: key === 'total' ? assessment.originalTotal : assessment.feeBreakdown[key as keyof typeof assessment.feeBreakdown] ?? 0,
      percent,
    }));
  if (!bases.length || bases.some(row => !Number.isFinite(row.base) || row.base < 0 || !Number.isInteger(row.percent) || row.percent < 0 || row.percent > 100)) return [];
  const hundredths = bases.map(row => Math.round(row.base * 100) * row.percent);
  const approvedCents = Math.round(assessment.finalCharge * 100);
  if (Math.round(hundredths.reduce((sum, value) => sum + value, 0) / 100) !== approvedCents) return [];
  // The backend rounds the aggregate once. Distribute residual cents so the
  // displayed rows reconcile exactly even when percentages produce fractions.
  const cents = hundredths.map(value => Math.floor(value / 100));
  const remainder = approvedCents - cents.reduce((sum, value) => sum + value, 0);
  const order = hundredths.map((value, index) => ({ index, fraction: value % 100 }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let i = 0; i < remainder; i++) cents[order[i].index]++;
  return bases.map((row, index) => ({ ...row, amount: cents[index] / 100 }));
}
