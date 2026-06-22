export type FeeYearLevel = "all" | "grade_11" | "grade_12";

export type FeeType = "default" | "add_on";

// A single fee item in a school year's global fee schedule.
export interface SchoolYearFee {
  id: number;
  schoolYearId: number;
  yearLevel: FeeYearLevel;
  name: string;
  type: FeeType;
  amount: number;
  sequence: number;
  createdAt: string | null;
}

export interface FeeInput {
  schoolYearId?: number; // required on create, ignored on update
  yearLevel: FeeYearLevel;
  name: string;
  type: FeeType;
  amount: number;
  sequence?: number;
}

export const FEE_YEAR_LEVEL_OPTIONS = [
  { value: "all", label: "All levels" },
  { value: "grade_11", label: "Grade 11" },
  { value: "grade_12", label: "Grade 12" },
] as const;

export const FEE_TYPE_OPTIONS = [
  { value: "default", label: "Default" },
  { value: "add_on", label: "Add-on" },
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
