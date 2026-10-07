import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CURRENCIES = ["MYR", "SGD", "USD", "IDR", "AED"] as const;

export type BillingMilestone = {
  id: string;
  mission_id: string;
  milestone_key: "M0" | "M1" | "M2" | "M3" | "M4" | "signoff";
  label: string;
  trigger_pct: number | null;
  fee_pct: number;
  amount: number | null;
  status: "locked" | "due" | "invoiced" | "paid" | "overdue";
  invoice_number: string | null;
  invoice_issued_at: string | null;
  payment_due_date: string | null;
  paid_at: string | null;
  payment_reference: string | null;
  payment_note: string | null;
  sort_order: number;
  triggered_at: string | null;
};

export type ContractInfo = {
  contract_fee: number | null;
  contract_currency: string;
  contract_signed_at: string | null;
  billing_contact_email: string | null;
  invoice_prefix: string;
  signoff_completed_at: string | null;
};

async function assertLead(
  supabaseAdmin: any,
  userId: string,
  missionId: string,
) {
  const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (isAdmin) return;
  const { data: mm } = await supabaseAdmin
    .from("mission_members")
    .select("role")
    .eq("mission_id", missionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (mm?.role !== "brqplus_lead") throw new Error("Forbidden");
}

async function postSystemMessage(
  supabaseAdmin: any,
  missionId: string,
  userId: string,
  content: string,
) {
  const { data: chan } = await supabaseAdmin
    .from("channels")
    .select("id")
    .eq("mission_id", missionId)
    .maybeSingle();
  if (!chan?.id) return;
  await supabaseAdmin.from("messages").insert({
    user_id: userId,
    channel_id: chan.id,
    content,
  });
}

export const listBillingMilestones = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const r = z.object({ mission_id: z.string().uuid() }).safeParse(d);
    if (!r.success) throw new Response("Invalid mission_id", { status: 400 });
    return r.data;
  })
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    // Auto-flip overdue (lead/admin only — safe to do server-side regardless)
    const today = new Date().toISOString().slice(0, 10);
    await supabaseAdmin
      .from("billing_milestones")
      .update({ status: "overdue" })
      .eq("mission_id", data.mission_id)
      .eq("status", "invoiced")
      .lt("payment_due_date", today);

    const { data: rows, error } = await supabaseAdmin
      .from("billing_milestones")
      .select("*")
      .eq("mission_id", data.mission_id)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);

    const { data: mission, error: mErr } = await supabaseAdmin
      .from("missions")
      .select(
        "contract_fee, contract_currency, contract_signed_at, billing_contact_email, invoice_prefix, signoff_completed_at",
      )
      .eq("id", data.mission_id)
      .maybeSingle();
    if (mErr) throw new Error(mErr.message);

    // Determine my role for client gating
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    const { data: mm } = await supabaseAdmin
      .from("mission_members")
      .select("role")
      .eq("mission_id", data.mission_id)
      .eq("user_id", userId)
      .maybeSingle();
    const myRole = isAdmin ? "brqplus_lead" : (mm?.role ?? "client");

    return {
      milestones: (rows ?? []) as BillingMilestone[],
      contract: (mission ?? null) as ContractInfo | null,
      my_role: myRole as "client" | "operator" | "brqplus_lead",
    };
  });

export const saveContractFee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        mission_id: z.string().uuid(),
        contract_fee: z.number().positive().max(1_000_000_000),
        contract_currency: z.enum(CURRENCIES),
        contract_signed_at: z.string().optional().nullable(),
        billing_contact_email: z.string().email().max(255).optional().nullable(),
        invoice_prefix: z
          .string()
          .min(1)
          .max(6)
          .regex(/^[A-Z0-9]+$/)
          .default("BRQ"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    await assertLead(supabaseAdmin, userId, data.mission_id);

    const { error } = await supabaseAdmin
      .from("missions")
      .update({
        contract_fee: data.contract_fee,
        contract_currency: data.contract_currency,
        contract_signed_at: data.contract_signed_at || null,
        billing_contact_email: data.billing_contact_email || null,
        invoice_prefix: data.invoice_prefix.toUpperCase(),
      })
      .eq("id", data.mission_id);
    if (error) throw new Error(error.message);

    const { error: fnErr } = await supabaseAdmin.rpc(
      "create_billing_milestones",
      {
        _mission_id: data.mission_id,
        _fee: data.contract_fee,
        _currency: data.contract_currency,
      },
    );
    if (fnErr) throw new Error(fnErr.message);
    return { ok: true as const };
  });

export const issueInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        milestone_id: z.string().uuid(),
        invoice_date: z.string(),
        payment_due_date: z.string(),
        bill_to: z.string().max(500).optional().nullable(),
        notes: z.string().max(300).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: ms } = await supabaseAdmin
      .from("billing_milestones")
      .select("id, mission_id, label, amount, status, milestone_key")
      .eq("id", data.milestone_id)
      .maybeSingle();
    if (!ms) throw new Error("Milestone not found");
    if (ms.status !== "due") throw new Error("Milestone is not due");

    await assertLead(supabaseAdmin, userId, ms.mission_id);

    const { data: mission } = await supabaseAdmin
      .from("missions")
      .select("invoice_prefix, contract_currency")
      .eq("id", ms.mission_id)
      .maybeSingle();
    const prefix = (mission?.invoice_prefix as string) || "BRQ";
    const currency = (mission?.contract_currency as string) || "MYR";

    const { data: seq, error: seqErr } = await supabaseAdmin
      .from("invoice_sequence")
      .insert({ mission_id: ms.mission_id })
      .select("id")
      .single();
    if (seqErr) throw new Error(seqErr.message);

    const year = new Date(data.invoice_date).getFullYear();
    const invoiceNumber = `${prefix}-${year}-${String(seq.id).padStart(3, "0")}`;

    const { error: upErr } = await supabaseAdmin
      .from("billing_milestones")
      .update({
        status: "invoiced",
        invoice_number: invoiceNumber,
        invoice_issued_at: data.invoice_date,
        payment_due_date: data.payment_due_date,
      })
      .eq("id", data.milestone_id);
    if (upErr) throw new Error(upErr.message);

    await postSystemMessage(
      supabaseAdmin,
      ms.mission_id,
      userId,
      `🧾 Invoice ${invoiceNumber} issued for ${ms.label} — ${currency} ${Number(ms.amount).toLocaleString()} due by ${data.payment_due_date}.`,
    );

    return { ok: true as const, invoice_number: invoiceNumber };
  });

export const markMilestonePaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        milestone_id: z.string().uuid(),
        paid_at: z.string(),
        amount_received: z.number().min(0),
        payment_reference: z.string().max(80).optional().nullable(),
        payment_note: z.string().max(200).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: ms } = await supabaseAdmin
      .from("billing_milestones")
      .select("id, mission_id, label, amount")
      .eq("id", data.milestone_id)
      .maybeSingle();
    if (!ms) throw new Error("Milestone not found");
    await assertLead(supabaseAdmin, userId, ms.mission_id);

    const { error } = await supabaseAdmin
      .from("billing_milestones")
      .update({
        status: "paid",
        paid_at: data.paid_at,
        amount: data.amount_received,
        payment_reference: data.payment_reference || null,
        payment_note: data.payment_note || null,
      })
      .eq("id", data.milestone_id);
    if (error) throw new Error(error.message);

    const { data: mission } = await supabaseAdmin
      .from("missions")
      .select("contract_currency")
      .eq("id", ms.mission_id)
      .maybeSingle();
    const cur = (mission?.contract_currency as string) || "MYR";

    await postSystemMessage(
      supabaseAdmin,
      ms.mission_id,
      userId,
      `✅ Payment received for ${ms.label} — ${cur} ${Number(data.amount_received).toLocaleString()}.`,
    );
    return { ok: true as const };
  });

export const recordSignoff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        mission_id: z.string().uuid(),
        signoff_date: z.string(),
        signed_by: z.string().max(200),
        reference: z.string().max(200).optional().nullable(),
        note: z.string().max(500).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    await assertLead(supabaseAdmin, userId, data.mission_id);

    await supabaseAdmin
      .from("missions")
      .update({
        signoff_completed_at: data.signoff_date,
        status: "completed",
      })
      .eq("id", data.mission_id);

    const { data: row } = await supabaseAdmin
      .from("billing_milestones")
      .update({ status: "due", triggered_at: new Date().toISOString() })
      .eq("mission_id", data.mission_id)
      .eq("milestone_key", "signoff")
      .select("amount")
      .maybeSingle();

    const { data: mission } = await supabaseAdmin
      .from("missions")
      .select("contract_currency")
      .eq("id", data.mission_id)
      .maybeSingle();
    const cur = (mission?.contract_currency as string) || "MYR";

    await postSystemMessage(
      supabaseAdmin,
      data.mission_id,
      userId,
      `🏁 Post-implementation signoff recorded by ${data.signed_by}. Final invoice of ${cur} ${Number(row?.amount ?? 0).toLocaleString()} is now due.`,
    );

    return { ok: true as const };
  });

export const updateMilestoneLabel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        milestone_id: z.string().uuid(),
        label: z.string().min(1).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data: ms } = await supabaseAdmin
      .from("billing_milestones")
      .select("mission_id")
      .eq("id", data.milestone_id)
      .maybeSingle();
    if (!ms) throw new Error("Not found");
    await assertLead(supabaseAdmin, userId, ms.mission_id);
    const { error } = await supabaseAdmin
      .from("billing_milestones")
      .update({ label: data.label })
      .eq("id", data.milestone_id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
