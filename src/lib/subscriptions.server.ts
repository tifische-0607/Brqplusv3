// Server-only helpers for auto-renewing membership subscriptions (card, via Stripe).
// Invoice + bank transfer billing keeps working unchanged; subscribed memberships
// simply skip local renewal invoices (billing_housekeeping ignores them).
import type Stripe from "stripe";
import { type StripeEnv, createStripeClient } from "./stripe.server";

const today = () => new Date().toISOString().slice(0, 10);
const isoDate = (s?: number | null) => (s ? new Date(s * 1000).toISOString().slice(0, 10) : null);

export const priceKey = (planCode: string, cycle: string) => `${planCode}_${cycle === "annual" ? "annual" : "monthly"}`;

/** Find (or create) the exclusive SST tax rate matching the configured rate. */
export async function sstTaxRateId(stripe: Stripe, rate: number): Promise<string | null> {
  if (!rate) return null;
  const list = await stripe.taxRates.list({ active: true, limit: 100 });
  const hit = list.data.find((t) => !t.inclusive && Number(t.percentage) === rate && t.metadata?.brq === "sst");
  if (hit) return hit.id;
  const created = await stripe.taxRates.create({ display_name: "SST", percentage: rate, inclusive: false, country: "MY", metadata: { brq: "sst" } });
  return created.id;
}

export async function resolveCustomer(stripe: Stripe, userId: string, email?: string | null): Promise<string> {
  if (!/^[a-zA-Z0-9_-]+$/.test(userId)) throw new Error("Invalid userId");
  const found = await stripe.customers.search({ query: `metadata['userId']:'${userId}'`, limit: 1 });
  if (found.data.length) return found.data[0].id;
  if (email) {
    const ex = await stripe.customers.list({ email, limit: 1 });
    if (ex.data.length) {
      await stripe.customers.update(ex.data[0].id, { metadata: { ...ex.data[0].metadata, userId } });
      return ex.data[0].id;
    }
  }
  return (await stripe.customers.create({ ...(email && { email }), metadata: { userId } })).id;
}

async function audit(action: string, m: any, reason: string) {
  const { billingAudit } = await import("./invoice.server");
  await billingAudit({ action, subject_user_id: m.user_id, subject_company_id: m.company_id, reason });
}

async function membershipBySub(subId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("memberships").select("*").eq("stripe_subscription_id", subId).maybeSingle();
  return data;
}

function subIdOf(obj: any): string | null {
  const s = obj?.subscription ?? obj?.parent?.subscription_details?.subscription;
  return typeof s === "string" ? s : s?.id ?? null;
}

/** First payment of a new subscription: settle the first invoice and link the subscription. */
export async function onSubscriptionCheckout(session: any, env: StripeEnv) {
  const membershipId = session?.metadata?.membership_id;
  const invoiceId = session?.metadata?.invoice_id;
  const subId = subIdOf(session);
  if (!membershipId || !subId || session.payment_status === "unpaid") return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { applyInvoicePayment } = await import("./invoice.server");
  const stripe = createStripeClient(env);
  const sub = await stripe.subscriptions.retrieve(subId);
  const item: any = sub.items.data[0];
  const start = isoDate(item?.current_period_start) ?? today();
  const endTs = item?.current_period_end;
  if (invoiceId) {
    const r = await applyInvoicePayment(invoiceId, today(), `Card subscription ${subId}`, null);
    if (!r.ok) console.log("[subscriptions] first invoice not updated:", invoiceId, r.reason);
    const stripeInv = typeof sub.latest_invoice === "string" ? sub.latest_invoice : sub.latest_invoice?.id;
    if (stripeInv) await supabaseAdmin.from("invoices").update({ stripe_invoice_id: stripeInv }).eq("id", invoiceId).is("stripe_invoice_id", null);
  }
  const { data: m } = await supabaseAdmin.from("memberships").update({
    status: "active", stripe_subscription_id: subId, stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    stripe_environment: env, cancel_at_period_end: false, payment_past_due_since: null,
    current_period_start: start, current_period_end: endTs ? new Date((endTs - 86400) * 1000).toISOString().slice(0, 10) : null,
    next_invoice_date: null,
  }).eq("id", membershipId).select("*").single();
  if (m) await audit("subscription_started", m, `Auto-renewal started · ${subId}`);
}

/** Renewal or upgrade charge paid: record a paid invoice and extend access. */
export async function onStripeInvoicePaid(invoice: any, env: StripeEnv) {
  const subId = subIdOf(invoice);
  if (!subId || invoice.billing_reason === "subscription_create") return;
  const m = await membershipBySub(subId);
  if (!m) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: dup } = await supabaseAdmin.from("invoices").select("id").eq("stripe_invoice_id", invoice.id).maybeSingle();
  if (dup) return;
  const stripe = createStripeClient(env);
  const sub = await stripe.subscriptions.retrieve(subId);
  const item: any = sub.items.data[0];
  const key = item?.price?.lookup_key as string | undefined;
  const cycle = item?.price?.recurring?.interval === "year" ? "annual" : "monthly";
  const code = key?.replace(/_(monthly|annual)$/, "");
  const { data: plan } = code ? await supabaseAdmin.from("membership_plans").select("*").eq("code", code).maybeSingle() : { data: null };
  const isRenewal = invoice.billing_reason === "subscription_cycle";
  const start = isoDate(item?.current_period_start) ?? today();
  const end = item?.current_period_end ? new Date((item.current_period_end - 86400) * 1000).toISOString().slice(0, 10) : null;
  const { data: number } = await supabaseAdmin.rpc("next_membership_invoice_number" as any);
  const subtotal = Number(invoice.subtotal ?? 0) / 100;
  const total = Number(invoice.total ?? invoice.amount_paid ?? 0) / 100;
  const taxRate = subtotal > 0 ? Math.round(((total - subtotal) / subtotal) * 10000) / 100 : 0;
  await supabaseAdmin.from("invoices").insert({
    number: number as unknown as string, membership_id: m.id, user_id: m.user_id, company_id: m.company_id,
    plan_id: plan?.id ?? m.plan_id, billing_cycle: cycle, period_start: isRenewal ? start : null, period_end: isRenewal ? end : null,
    amount_myr: subtotal, tax_rate: taxRate, total_myr: total, status: "paid", due_at: today(), paid_at: today(),
    payment_reference: `Card ${invoice.id}`, draft_pricing: !!plan?.is_draft, stripe_invoice_id: invoice.id,
    notes: isRenewal ? "Automatic renewal" : "Plan change (pro-rated)",
  } as any);
  const patch: any = { status: "active", payment_past_due_since: null };
  if (isRenewal) Object.assign(patch, { current_period_start: start, current_period_end: end });
  if (plan) Object.assign(patch, { plan_id: plan.id, billing_cycle: cycle, price_myr: Number(item.price.unit_amount ?? 0) / 100 });
  await supabaseAdmin.from("memberships").update(patch).eq("id", m.id);
  if (isRenewal && plan && plan.id !== m.plan_id) {
    await supabaseAdmin.from("plan_change_requests").update({ status: "completed", handled_at: new Date().toISOString() }).eq("membership_id", m.id).eq("status", "scheduled");
  }
  if (m.company_id) await supabaseAdmin.from("companies").update({ membership_status: "active" }).eq("id", m.company_id);
  await audit("invoice_paid", m, `${number} · ${isRenewal ? "auto-renewal" : "pro-rated plan change"} · ${invoice.id}`);
}

/** Renewal failed: start the 30-day grace period (billing_housekeeping lapses it afterwards). */
export async function onStripeInvoiceFailed(invoice: any) {
  const subId = subIdOf(invoice);
  if (!subId) return;
  const m = await membershipBySub(subId);
  if (!m || m.payment_past_due_since) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("memberships").update({ payment_past_due_since: today() }).eq("id", m.id);
  await audit("payment_failed", m, `Renewal payment failed · ${invoice.id}`);
}

export async function onSubscriptionUpdated(sub: any) {
  const m = await membershipBySub(sub.id);
  if (!m) return;
  const cancel = !!sub.cancel_at_period_end;
  if (cancel === m.cancel_at_period_end) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("memberships").update({ cancel_at_period_end: cancel }).eq("id", m.id);
  await audit(cancel ? "subscription_cancel_scheduled" : "subscription_resumed", m, cancel ? `Access continues until ${m.current_period_end}` : "Auto-renewal resumed");
}

/** Subscription ended (at period end after cancelling, or after failed retries). */
export async function onSubscriptionDeleted(sub: any) {
  const m = await membershipBySub(sub.id);
  if (!m) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("memberships").update({ status: "cancelled", cancel_at_period_end: false, next_invoice_date: null }).eq("id", m.id);
  await audit("subscription_ended", m, `Subscription ${sub.id} ended`);
}
