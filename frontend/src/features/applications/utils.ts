import { STEP_FIELDS } from "./constants";
import type { ApplicationFormValues } from "./types";

// Whole-year age from a 'yyyy-MM-dd' date of birth, as of the given date.
export function calculateAge(
  dateOfBirth: string,
  asOf: Date = new Date(),
): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return null;

  let age = asOf.getFullYear() - dob.getFullYear();
  const monthDiff = asOf.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && asOf.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

// How many of a step's required fields are filled, for live progress display.
export function stepFilledCount(
  step: number,
  values: ApplicationFormValues,
): number {
  return (STEP_FIELDS[step] ?? []).filter((name) => values[name].trim() !== "")
    .length;
}

// A step counts as complete once all its required fields are filled. Steps with
// no fields yet (placeholders) are not considered complete.
export function isStepComplete(
  step: number,
  values: ApplicationFormValues,
): boolean {
  const fields = STEP_FIELDS[step] ?? [];
  return fields.length > 0 && stepFilledCount(step, values) === fields.length;
}

// Formats an ISO date string for display (e.g. "Jun 14, 2026").
export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
