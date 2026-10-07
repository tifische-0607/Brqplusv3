export type Currency = "MYR" | "SGD" | "USD" | "IDR" | "AED";

export function formatMoney(amount: number | null | undefined, currency: string): string {
  const n = Number(amount ?? 0);
  const isIDR = currency === "IDR";
  return `${currency} ${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: isIDR ? 0 : 2,
    maximumFractionDigits: isIDR ? 0 : 2,
  }).format(n)}`;
}

export function formatMoneyAbbr(amount: number | null | undefined, currency: string): string {
  const n = Number(amount ?? 0);
  if (currency === "IDR") {
    return `${currency} ${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  }
  if (n >= 1000) return `${currency} ${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return `${currency} ${n.toFixed(0)}`;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
