export function formatBRL(value: number | string): string {
  const num = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
}

export function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "string" ? Number(value) : value;
}

export function totalPrice(price: number | string, shippingCost: number | string | null): number {
  return toNumber(price) + toNumber(shippingCost);
}
