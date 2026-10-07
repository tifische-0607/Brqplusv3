import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Env = "sandbox" | "live";

/** Loads an invoice the signed-in user may pay (own personal invoice, or member of the billed company). */
async function loadPayableInvoice(invoiceId: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: inv } = await supabaseAdmin.from("invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (!inv) return { error: "Invoice not found" as const };
  let allowed = inv.user_id === userId;
  if (!allowed && inv.company_id) {
    const { data: m } = await supabaseAdmin.from("company_members").select("id").eq("company_id", inv.company_id).eq("user_id", userId).maybeSingle();
    allowed = !!m;
  }
  if (!allowed) return { error: "You don't have access to this invoice" as const };
  const { data: plan } = await supabaseAdmin.from("membership_plans").select("name").eq("id", inv.plan_id).maybeSingle();
  return { inv, planName: plan?.name ?? "Membership" };
}

export const getInvoiceForPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const r = await loadPayableInvoice(data.id, (context as any).userId);
    if ("error" in r) return { error: String(r.error) };
    const i = r.inv;
    return { invoice: { id: i.id, number: i.number, status: i.status, total_myr: Number(i.total_myr), amount_myr: Number(i.amount_myr), tax_rate: Number(i.tax_rate), due_at: i.due_at, paid_at: i.paid_at, billing_cycle: i.billing_cycle, plan_name: r.planName } };
  });

export const createInvoiceCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), environment: z.enum(["sandbox", "live"]), returnUrl: z.string().url().max(500) }).parse(d))
  .handler(async ({ data, context }): Promise<{ clientSecret: string } | { error: string }> => {
    const { userId, supabase } = context as any;
    const r = await loadPayableInvoice(data.id, userId);
    if ("error" in r) return { error: String(r.error) };
    const inv = r.inv;
    if (!["issued", "overdue"].includes(inv.status)) return { error: `This invoice is ${inv.status} and can't be paid online.` };
    const { createStripeClient, getStripeErrorMessage } = await import("./stripe.server");
    try {
      const stripe = createStripeClient(data.environment as Env);
      const { data: { user } } = await supabase.auth.getUser();
      // Resolve or create a customer carrying the BRQ+ user id
      let customerId: string | undefined;
      const found = await stripe.customers.search({ query: `metadata['userId']:'${userId}'`, limit: 1 });
      if (found.data.length) customerId = found.data[0].id;
      else if (user?.email) {
        const ex = await stripe.customers.list({ email: user.email, limit: 1 });
        if (ex.data.length) { customerId = ex.data[0].id; await stripe.customers.update(customerId, { metadata: { ...ex.data[0].metadata, userId } }); }
      }
      if (!customerId) customerId = (await stripe.customers.create({ ...(user?.email && { email: user.email }), metadata: { userId } })).id;
      const description = `BRQ+ ${r.planName} membership · ${inv.number}`;
      const meta = { invoice_id: inv.id, invoice_number: inv.number, userId };
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        line_items: [{ quantity: 1, price_data: { currency: "myr", unit_amount: Math.round(Number(inv.total_myr) * 100), product_data: { name: description } } }],
        payment_intent_data: { description, metadata: meta },
        metadata: meta,
      });
      return { clientSecret: session.client_secret ?? "" };
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
  });

/** Pay the first invoice by starting an auto-renewing card subscription for the same plan. */
export const createSubscriptionCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), environment: z.enum(["sandbox", "live"]), returnUrl: z.string().url().max(500) }).parse(d))
  .handler(async ({ data, context }): Promise<{ clientSecret: string } | { error: string }> => {
    const { userId, supabase } = context as any;
    const r = await loadPayableInvoice(data.id, userId);
    if ("error" in r) return { error: String(r.error) };
    const inv = r.inv;
    if (!["issued", "overdue"].includes(inv.status)) return { error: `This invoice is ${inv.status} and can't be paid online.` };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ms } = await supabaseAdmin.from("memberships").select("*").eq("id", inv.membership_id).single();
    if (ms?.stripe_subscription_id) return { error: "This membership already renews automatically." };
    if (inv.company_id) {
      const { data: cm } = await supabaseAdmin.from("company_members").select("role").eq("company_id", inv.company_id).eq("user_id", userId).maybeSingle();
      if (cm?.role !== "admin") return { error: "Only the company admin can set up automatic renewal." };
    }
    const { data: plan } = await supabaseAdmin.from("membership_plans").select("code").eq("id", inv.plan_id).single();
    const { createStripeClient, getStripeErrorMessage } = await import("./stripe.server");
    const { priceKey, resolveCustomer, sstTaxRateId } = await import("./subscriptions.server");
    try {
      const stripe = createStripeClient(data.environment as Env);
      const prices = await stripe.prices.list({ lookup_keys: [priceKey(plan!.code, inv.billing_cycle)] });
      const price = prices.data[0];
      if (!price) return { error: "Automatic renewal isn't available for this plan yet. Please pay this invoice once instead." };
      if (Math.round(Number(inv.amount_myr) * 100) !== price.unit_amount) return { error: "This invoice amount differs from the standard plan price, so it can only be paid once. Contact BRQ+ to set up automatic renewal." };
      const { data: { user } } = await supabase.auth.getUser();
      const customer = await resolveCustomer(stripe, userId, user?.email);
      const taxRate = await sstTaxRateId(stripe, Number(inv.tax_rate));
      const meta = { invoice_id: inv.id, membership_id: inv.membership_id, userId };
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer,
        line_items: [{ price: price.id, quantity: 1, ...(taxRate && { tax_rates: [taxRate] }) }],
        metadata: meta,
        subscription_data: { metadata: meta },
      });
      return { clientSecret: session.client_secret ?? "" };
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
  });
