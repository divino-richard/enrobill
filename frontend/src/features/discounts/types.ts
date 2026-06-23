export type DiscountCategory =
  | "discount"
  | "scholarship"
  | "voucher"
  | "freebie";
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
}[] = [
  { value: "discount", label: "Discount" },
  { value: "scholarship", label: "Scholarship" },
  { value: "voucher", label: "Voucher" },
  { value: "freebie", label: "Freebie" },
];

export const DISCOUNT_TYPE_OPTIONS: { value: DiscountType; label: string }[] = [
  { value: "fixed", label: "Fixed amount (₱)" },
  { value: "percentage", label: "Percentage (%)" },
  { value: "full", label: "Full coverage (zero balance)" },
];

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
