const pesoFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
});

// Format an amount (in pesos) as e.g. "₱12,500.00".
export function formatPeso(amount: number): string {
  return pesoFormatter.format(amount);
}
