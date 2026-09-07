import type { EnrollmentVoucher } from "@/features/enrollments/types";

export function previewNet(gross: number, voucher: EnrollmentVoucher | null): number {
  if (!voucher) return gross;
  if (voucher.type === "full") return 0;
  const nominal = voucher.type === "percentage"
    ? (gross * voucher.value) / 100
    : voucher.value;
  return Math.max(Math.round((gross - Math.min(nominal, gross)) * 100) / 100, 0);
}
