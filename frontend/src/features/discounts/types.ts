// The catalog holds vouchers only now (freebies are eligibility-driven promos).
export type DiscountCategory = "voucher";
// Vouchers are fixed amounts; older records may still carry other types.
export type DiscountType = "fixed" | "percentage" | "full";

export interface Discount {
  id: number;
  name: string;
  category: DiscountCategory;
  type: DiscountType;
  value: number;
  isActive: boolean;
  createdAt: string | null;
}

export const DISCOUNT_CATEGORY_OPTIONS: {
  value: DiscountCategory;
  label: string;
}[] = [{ value: "voucher", label: "Voucher" }];

export function categoryLabel(category: string): string {
  return (
    DISCOUNT_CATEGORY_OPTIONS.find((option) => option.value === category)
      ?.label ?? category
  );
}

// e.g. "₱17,500.00" for fixed, "50%" for percentage, "Full" for full coverage.
export function discountValueLabel(discount: Discount): string {
  if (discount.type === "full") return "Full coverage";
  return discount.type === "percentage"
    ? `${discount.value}%`
    : new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        minimumFractionDigits: 2,
      }).format(discount.value);
}
