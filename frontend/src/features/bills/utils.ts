import { type ReceiptParty } from "./receipt";
import type { Bill, BillInstallment } from "./types";

export const termTitle = (bill: Bill) => `SY ${bill.schoolYear}`;

export const isOverdue = (dueDate: string | null) =>
  !!dueDate && new Date(`${dueDate}T00:00:00`).getTime() < Date.now();

export function nextOutstandingInstallment(
  installments: BillInstallment[],
): BillInstallment | null {
  return (
    [...installments]
      .filter((installment) => installment.balance > 0)
      .sort((a, b) => a.sequence - b.sequence)[0] ?? null
  );
}

// Derive the receipt's "billed to" party from the bill (preferring its embedded
// student) and the signed-in user as a fallback for the student portal.
export function billReceiptParty(
  bill: Bill,
  fallbackName: string,
): ReceiptParty {
  return {
    name: bill.student?.name ?? fallbackName,
    studentNumber: bill.student?.studentNumber ?? null,
    program: null,
  };
}
