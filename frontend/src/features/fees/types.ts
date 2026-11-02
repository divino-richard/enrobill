import type { DroppingComponent } from '@/features/dropping-finance/api';
export type FeeYearLevel = "all" | "grade_11" | "grade_12";

export type FeeType = "default" | "add_on";

export type FeeCategory = "tuition" | "miscellaneous" | "other";

// A single fee item in a school year's global fee schedule.
export interface SchoolYearFee {
  id: number;
  schoolYearId: number;
  yearLevel: FeeYearLevel;
  category: FeeCategory;
  droppingComponent?: DroppingComponent | null;
  name: string;
  type: FeeType;
  amount: number;
  sequence: number;
  createdAt: string | null;
}

export interface FeeInput {
  schoolYearId?: number; // required on create, ignored on update
  yearLevel: FeeYearLevel;
  category: FeeCategory;
  droppingComponent?: DroppingComponent | null;
  name: string;
  type: FeeType;
  amount: number;
  sequence?: number;
}

export const FEE_YEAR_LEVEL_OPTIONS = [
  { value: "all", label: "Both grades" },
  { value: "grade_11", label: "Grade 11" },
  { value: "grade_12", label: "Grade 12" },
] as const;

export const FEE_TYPE_OPTIONS = [
  { value: "default", label: "Standard" },
  { value: "add_on", label: "Additional" },
] as const;

// Sections of the official Schedule of Fees, in display order.
export const FEE_CATEGORY_OPTIONS = [
  { value: "tuition", label: "Tuition" },
  { value: "miscellaneous", label: "Miscellaneous Fees" },
  { value: "other", label: "Other Fees" },
] as const;

export function feeYearLevelLabel(value: string): string {
  return (
    FEE_YEAR_LEVEL_OPTIONS.find((option) => option.value === value)?.label ??
    value
  );
}

export function feeTypeLabel(value: string): string {
  return (
    FEE_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value
  );
}

export function feeCategoryLabel(value: string): string {
  return (
    FEE_CATEGORY_OPTIONS.find((option) => option.value === value)?.label ?? value
  );
}

export interface FeeEstimateData {
  schoolYear: string;
  yearLevel: string;
  publishedAt: string;
  items: { id: number; name: string; category: FeeCategory; amount: number }[];
  total: number;
  downpayment: number;
  installments: number[];
}

export interface FeePaymentPreview {
  yearLevel: 'grade_11' | 'grade_12';
  total: number;
  downpayment: number;
  installments: number[];
}
