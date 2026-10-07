// Client-safe membership plan types and helpers.
export type BillingCycle = "monthly" | "annual";
export type MembershipPlan = {
  id: string;
  member_type: "personal" | "corporate";
  code: string;
  name: string;
  tagline: string | null;
  monthly_price_myr: number;
  annual_price_myr: number;
  max_users: number | null;
  benefits: string[];
  sort_order: number;
  is_active: boolean;
  is_draft: boolean;
  is_popular: boolean;
};

export const DRAFT_PRICING_TEXT = "Draft pricing — subject to change";

export const planPrice = (p: Pick<MembershipPlan, "monthly_price_myr" | "annual_price_myr">, cycle: BillingCycle) =>
  Number(cycle === "annual" ? p.annual_price_myr : p.monthly_price_myr);

export const rm = (n: number | string | null | undefined) =>
  `RM ${Number(n ?? 0).toLocaleString("en-MY", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export const cycleLabel = (c: string | null | undefined) => (c === "annual" ? "Annual" : c === "monthly" ? "Monthly" : "—");
export const seatLabel = (max: number | null | undefined) => (max == null ? "Unlimited users" : `Up to ${max} users`);

export const MEMBERSHIP_STATUS_LABEL: Record<string, string> = {
  awaiting_payment: "Awaiting payment",
  active: "Active",
  payment_overdue: "Payment overdue",
  cancelled: "Cancelled",
};
export const isUnpaid = (s: string | null | undefined) => s === "awaiting_payment" || s === "payment_overdue";
