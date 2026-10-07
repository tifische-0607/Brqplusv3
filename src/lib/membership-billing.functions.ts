import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function isAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  return data === true;
}
async function assertAdmin(supabase: any, userId: string) {
  if (!(await isAdmin(supabase, userId))) throw new Error("Forbidden: admin role required");
}
const cycle = z.enum(["monthly", "annual"]);

// ---------- Plans (admin) ----------
export const adminListPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { data, error } = await supabase.from("membership_plans").select("*").order("member_type").order("sort_order");
    if (error) throw new Error(error.message);
    const { getTaxRate } = await import("./invoice.server");
    return { plans: data ?? [], tax_rate: await getTaxRate() };
  });

export const adminUpdatePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(), name: z.string().trim().min(1).max(80), tagline: z.string().trim().max(200).nullable(),
    monthly_price_myr: z.number().min(0).max(10_000_000), annual_price_myr: z.number().min(0).max(100_000_000),
    max_users: z.number().int().min(1).max(100000).nullable(), benefits: z.array(z.string().trim().min(1).max(200)).max(20),
    is_active: z.boolean(), is_draft: z.boolean(), is_popular: z.boolean(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { id, ...rest } = data;
    const { error } = await supabase.from("membership_plans").update(rest).eq("id", id);
    if (error) throw new Error(error.message);
    const { billingAudit } = await import("./invoice.server");
    await billingAudit({ action: "plan_updated", actor_user_id: userId, reason: `${data.name}: RM ${data.monthly_price_myr}/mo, RM ${data.annual_price_myr}/yr${data.is_draft ? " (draft)" : ""}` });
    return { ok: true as const };
  });

export const adminSetTaxRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ rate: z.number().min(0).max(50) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("app_settings").upsert({ key: "billing_tax_rate", value: String(data.rate) });
    if (error) throw new Error(error.message);
    const { billingAudit } = await import("./invoice.server");
    await billingAudit({ action: "tax_rate_updated", actor_user_id: userId, reason: `SST ${data.rate}%` });
    return { ok: true as const };
  });

// ---------- Invoices (admin) ----------
export const adminListInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getTaxRate } = await import("./invoice.server");
    await supabaseAdmin.rpc("billing_housekeeping" as any, { _tax_rate: await getTaxRate() } as any);
    const [inv, plans, cos, profs, reqs] = await Promise.all([
      supabaseAdmin.from("invoices").select("*").order("created_at", { ascending: false }).limit(5000),
      supabaseAdmin.from("membership_plans").select("id, name, code, member_type"),
      supabaseAdmin.from("companies").select("id, legal_name"),
      supabaseAdmin.from("profiles").select("id, full_name"),
      supabaseAdmin.from("plan_change_requests").select("*").order("created_at", { ascending: false }).limit(500),
    ]);
    const planMap = Object.fromEntries((plans.data ?? []).map((p: any) => [p.id, p]));
    const coMap = Object.fromEntries((cos.data ?? []).map((c: any) => [c.id, c.legal_name]));
    const pMap = Object.fromEntries((profs.data ?? []).map((p: any) => [p.id, p.full_name]));
    const invoices = (inv.data ?? []).map((i: any) => ({
      ...i, plan_name: planMap[i.plan_id]?.name ?? "—", plan_code: planMap[i.plan_id]?.code ?? "",
      member_type: i.company_id ? "corporate" : "personal", member_name: i.company_id ? coMap[i.company_id] ?? "Company" : pMap[i.user_id] ?? "Member",
    }));
    const requests = (reqs.data ?? []).map((r: any) => ({ ...r, requester: pMap[r.requested_by] ?? "Member", plan_name: planMap[r.requested_plan_id]?.name ?? "—" }));
    return { invoices, requests, plans: plans.data ?? [] };
  });

export const markInvoicePaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), paid_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), payment_reference: z.string().trim().min(1).max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { applyInvoicePayment } = await import("./invoice.server");
    const r = await applyInvoicePayment(data.id, data.paid_at, data.payment_reference, userId);
    if (!r.ok) throw new Error(r.reason);
    return { ok: true as const };
  });

export const voidInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), reason: z.string().trim().min(1).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { billingAudit } = await import("./invoice.server");
    const { data: inv } = await supabaseAdmin.from("invoices").select("*").eq("id", data.id).single();
    if (!inv) throw new Error("Invoice not found");
    if (inv.status === "paid") throw new Error("Paid invoices cannot be voided");
    await supabaseAdmin.from("invoices").update({ status: "void", notes: [inv.notes, `Void: ${data.reason}`].filter(Boolean).join(" · ") }).eq("id", inv.id);
    await billingAudit({ action: "invoice_void", actor_user_id: userId, subject_user_id: inv.user_id, subject_company_id: inv.company_id, reason: `${inv.number} · ${data.reason}` });
    return { ok: true as const };
  });

export const adminHandlePlanRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), approve: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { billingAudit } = await import("./invoice.server");
    const { data: r } = await supabaseAdmin.from("plan_change_requests").select("*").eq("id", data.id).single();
    if (!r || r.status !== "open") throw new Error("Request not open");
    const { data: ms } = await supabaseAdmin.from("memberships").select("*").eq("id", r.membership_id).single();
    if (data.approve && ms) {
      const planId = r.requested_plan_id ?? ms.plan_id;
      const cyc = r.requested_cycle ?? ms.billing_cycle;
      const { data: plan } = await supabaseAdmin.from("membership_plans").select("*").eq("id", planId).single();
      const price = Number(cyc === "annual" ? plan?.annual_price_myr : plan?.monthly_price_myr);
      await supabaseAdmin.from("memberships").update({ plan_id: planId, billing_cycle: cyc, price_myr: price }).eq("id", ms.id);
    }
    await supabaseAdmin.from("plan_change_requests").update({ status: data.approve ? "completed" : "declined", handled_by: userId, handled_at: new Date().toISOString() }).eq("id", r.id);
    await billingAudit({ action: data.approve ? "plan_change_applied" : "plan_change_declined", actor_user_id: userId, subject_user_id: ms?.user_id, subject_company_id: ms?.company_id, reason: "Applies from the next invoice" });
    return { ok: true as const };
  });

export const getBillingKpis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [inv, ms] = await Promise.all([
      supabaseAdmin.from("invoices").select("status, due_at").in("status", ["issued", "overdue"]),
      supabaseAdmin.from("memberships").select("price_myr, billing_cycle").eq("status", "active"),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    const rows = inv.data ?? [];
    const overdue = rows.filter((r: any) => r.status === "overdue" || r.due_at < today).length;
    const mrr = (ms.data ?? []).reduce((s: number, m: any) => s + Number(m.price_myr) / (m.billing_cycle === "annual" ? 12 : 1), 0);
    return { awaiting: rows.length, overdue, mrr: Math.round(mrr) };
  });

// ---------- Subject billing (member / company admin / admin) ----------
async function loadBilling(sa: any, filter: { user_id?: string; company_id?: string }) {
  let q = sa.from("memberships").select("*").order("created_at", { ascending: false }).limit(1);
  q = filter.company_id ? q.eq("company_id", filter.company_id) : q.eq("user_id", filter.user_id).is("company_id", null);
  const { data: ms } = await q;
  const membership = ms?.[0] ?? null;
  if (!membership) return { membership: null, plan: null, invoices: [], requests: [] };
  const [plan, inv, reqs] = await Promise.all([
    sa.from("membership_plans").select("*").eq("id", membership.plan_id).single(),
    sa.from("invoices").select("*").eq("membership_id", membership.id).order("created_at", { ascending: false }),
    sa.from("plan_change_requests").select("*").eq("membership_id", membership.id).order("created_at", { ascending: false }).limit(10),
  ]);
  return { membership, plan: plan.data, invoices: inv.data ?? [], requests: reqs.data ?? [] };
}

async function myScope(supabase: any, userId: string, scope: "personal" | "company") {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (scope === "company") {
    const { data: cm } = await supabase.from("company_members").select("company_id, role").eq("user_id", userId).maybeSingle();
    if (!cm) return { sa: supabaseAdmin, filter: null, isCompanyAdmin: false };
    return { sa: supabaseAdmin, filter: { company_id: cm.company_id as string }, isCompanyAdmin: cm.role === "admin" };
  }
  return { sa: supabaseAdmin, filter: { user_id: userId }, isCompanyAdmin: false };
}

export const getMyBilling = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ scope: z.enum(["personal", "company"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { sa, filter, isCompanyAdmin } = await myScope(supabase, userId, data.scope);
    if (!filter) return { membership: null, plan: null, invoices: [], requests: [], plans: [], can_manage: false };
    const b = await loadBilling(sa, filter);
    const canManage = data.scope === "personal" || isCompanyAdmin;
    const { data: plans } = await sa.from("membership_plans").select("*").eq("is_active", true).eq("member_type", data.scope === "company" ? "corporate" : "personal").order("sort_order");
    return { ...b, invoices: canManage ? b.invoices : [], plans: plans ?? [], can_manage: canManage };
  });

/** Lightweight banner status for the portal shell. */
export const getMyPaymentStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cm } = await supabase.from("company_members").select("company_id, role").eq("user_id", userId).maybeSingle();
    const b = await loadBilling(supabaseAdmin, cm ? { company_id: cm.company_id } : { user_id: userId });
    if (!b.membership || !["awaiting_payment", "payment_overdue"].includes(b.membership.status)) return null;
    const open = b.invoices.find((i: any) => i.status === "issued" || i.status === "overdue");
    return {
      status: b.membership.status as string, plan_name: b.plan?.name ?? "", can_download: !cm || cm.role === "admin",
      invoice: open ? { id: open.id, number: open.number, total_myr: Number(open.total_myr), due_at: open.due_at } : null,
    };
  });

export const requestPlanChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ scope: z.enum(["personal", "company"]), plan_id: z.string().uuid(), cycle, note: z.string().trim().max(500).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { sa, filter, isCompanyAdmin } = await myScope(supabase, userId, data.scope);
    if (!filter || (data.scope === "company" && !isCompanyAdmin)) throw new Error("Only the company admin can request a plan change.");
    const b = await loadBilling(sa, filter);
    if (!b.membership) throw new Error("No membership found.");
    const { error } = await sa.from("plan_change_requests").insert({ membership_id: b.membership.id, requested_by: userId, requested_plan_id: data.plan_id, requested_cycle: data.cycle, note: data.note || null });
    if (error) throw new Error("Could not submit your request.");
    const { billingAudit } = await import("./invoice.server");
    await billingAudit({ action: "plan_change_requested", actor_user_id: userId, subject_user_id: b.membership.user_id, subject_company_id: b.membership.company_id, reason: data.note ?? null });
    return { ok: true as const };
  });

export const getInvoiceDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    // RLS decides visibility: own invoices, company admin, or BRQ+ admin.
    const { data: inv } = await supabase.from("invoices").select("id").eq("id", data.id).maybeSingle();
    if (!inv) throw new Error("Invoice not found");
    const { invoicePdfUrl } = await import("./invoice.server");
    return { url: await invoicePdfUrl(data.id) };
  });

export const adminGetBilling = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid().optional(), company_id: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return loadBilling(supabaseAdmin, data.company_id ? { company_id: data.company_id } : { user_id: data.user_id! });
  });

const monthlyValue = (p: any, c: string) => Number(c === "annual" ? p.annual_price_myr : p.monthly_price_myr) / (c === "annual" ? 12 : 1);

/** Subscribed members: upgrades apply now (pro-rated charge); downgrades apply at next renewal. */
export const changeSubscriptionPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ scope: z.enum(["personal", "company"]), plan_id: z.string().uuid(), cycle }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; mode: "upgrade" | "downgrade" } | { error: string }> => {
    const { supabase, userId } = context as any;
    const { sa, filter, isCompanyAdmin } = await myScope(supabase, userId, data.scope);
    if (!filter || (data.scope === "company" && !isCompanyAdmin)) return { error: "Only the company admin can change the plan." };
    const b = await loadBilling(sa, filter);
    const m = b.membership;
    if (!m?.stripe_subscription_id) return { error: "This membership doesn't renew automatically." };
    const { data: np } = await sa.from("membership_plans").select("*").eq("id", data.plan_id).eq("is_active", true).maybeSingle();
    if (!np || np.member_type !== (data.scope === "company" ? "corporate" : "personal")) return { error: "Plan not available." };
    if (np.id === m.plan_id && data.cycle === m.billing_cycle) return { error: "You're already on this plan." };
    const upgrade = monthlyValue(np, data.cycle) > monthlyValue(b.plan, m.billing_cycle);
    const { createStripeClient, getStripeErrorMessage } = await import("./stripe.server");
    const { priceKey } = await import("./subscriptions.server");
    try {
      const stripe = createStripeClient(m.stripe_environment);
      const prices = await stripe.prices.list({ lookup_keys: [priceKey(np.code, data.cycle)] });
      if (!prices.data[0]) return { error: "That plan isn't available for automatic renewal." };
      const sub = await stripe.subscriptions.retrieve(m.stripe_subscription_id);
      await stripe.subscriptions.update(sub.id, {
        items: [{ id: sub.items.data[0].id, price: prices.data[0].id }],
        proration_behavior: upgrade ? "always_invoice" : "none",
        ...(upgrade ? { payment_behavior: "error_if_incomplete" as const } : {}),
        metadata: { ...sub.metadata },
      });
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
    const { billingAudit } = await import("./invoice.server");
    if (upgrade) {
      await sa.from("memberships").update({ plan_id: np.id, billing_cycle: data.cycle, price_myr: Number(data.cycle === "annual" ? np.annual_price_myr : np.monthly_price_myr) }).eq("id", m.id);
    } else {
      await sa.from("plan_change_requests").update({ status: "cancelled" }).eq("membership_id", m.id).eq("status", "scheduled");
      await sa.from("plan_change_requests").insert({ membership_id: m.id, requested_by: userId, requested_plan_id: np.id, requested_cycle: data.cycle, status: "scheduled", note: "Downgrade at next renewal" });
    }
    await billingAudit({ action: upgrade ? "plan_upgraded" : "plan_downgrade_scheduled", actor_user_id: userId, subject_user_id: m.user_id, subject_company_id: m.company_id, reason: `${np.name} ${data.cycle}` });
    return { ok: true, mode: upgrade ? "upgrade" : "downgrade" };
  });

/** Opens the secure billing portal (cancel, update card, receipts) for subscribed members. */
export const createBillingPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ scope: z.enum(["personal", "company"]), returnUrl: z.string().url().max(500) }).parse(d))
  .handler(async ({ data, context }): Promise<{ url: string } | { error: string }> => {
    const { supabase, userId } = context as any;
    const { sa, filter, isCompanyAdmin } = await myScope(supabase, userId, data.scope);
    if (!filter || (data.scope === "company" && !isCompanyAdmin)) return { error: "Only the company admin can manage billing." };
    const b = await loadBilling(sa, filter);
    if (!b.membership?.stripe_customer_id) return { error: "No card subscription found." };
    const { createStripeClient, getStripeErrorMessage } = await import("./stripe.server");
    try {
      const stripe = createStripeClient(b.membership.stripe_environment);
      const p = await stripe.billingPortal.sessions.create({ customer: b.membership.stripe_customer_id, return_url: data.returnUrl });
      return { url: p.url };
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
  });
