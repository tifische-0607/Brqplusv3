// Server-only invoice helpers: creation, PDF rendering and storage.
// Payment is by bank transfer / DuitNow; `invoices` rows are gateway-agnostic so Stripe can be added later.

const BUCKET = "invoices";

export async function getTaxRate(): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("app_settings").select("value").eq("key", "billing_tax_rate").maybeSingle();
  const n = Number(data?.value ?? 0);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export async function billingAudit(row: { action: string; actor_user_id?: string | null; subject_user_id?: string | null; subject_company_id?: string | null; reason?: string | null; membership_application_id?: string | null }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { actorEmail } = await import("./invite.server");
  const actor_email = row.actor_user_id ? await actorEmail(row.actor_user_id) : null;
  const { error } = await supabaseAdmin.from("application_review_audit").insert({ ...row, actor_email } as any);
  if (error) console.error("[billing audit]", error);
}

export async function createMembershipWithInvoice(opts: {
  user_id: string | null; company_id: string | null; application_id: string; plan_id: string; cycle: "monthly" | "annual"; actor: string;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: plan, error: pErr } = await supabaseAdmin.from("membership_plans").select("*").eq("id", opts.plan_id).single();
  if (pErr || !plan) throw new Error("Plan not found");
  const price = Number(opts.cycle === "annual" ? plan.annual_price_myr : plan.monthly_price_myr);
  const { data: ms, error: mErr } = await supabaseAdmin.from("memberships").insert({
    user_id: opts.user_id, company_id: opts.company_id, application_id: opts.application_id, plan_id: plan.id,
    billing_cycle: opts.cycle, price_myr: price, status: "awaiting_payment", next_invoice_date: null,
  }).select("*").single();
  if (mErr || !ms) throw new Error(mErr?.message ?? "Could not create membership");
  const inv = await issueInvoice({ membership: ms, plan, notes: "First membership invoice" });
  await billingAudit({ action: "invoice_issued", actor_user_id: opts.actor, subject_user_id: opts.user_id, subject_company_id: opts.company_id, reason: `${inv.number} · ${plan.name} ${opts.cycle}` });
  return { membership: ms, invoice: inv };
}

export async function issueInvoice({ membership, plan, notes }: { membership: any; plan: any; notes?: string }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const tax = await getTaxRate();
  const { data: number, error: nErr } = await supabaseAdmin.rpc("next_membership_invoice_number" as any);
  if (nErr || !number) throw new Error("Could not allocate invoice number");
  const amount = Number(membership.price_myr);
  const due = new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10);
  const { data: inv, error } = await supabaseAdmin.from("invoices").insert({
    number: number as unknown as string, membership_id: membership.id, user_id: membership.user_id, company_id: membership.company_id,
    plan_id: plan.id, billing_cycle: membership.billing_cycle, amount_myr: amount, tax_rate: tax,
    total_myr: Math.round(amount * (1 + tax / 100) * 100) / 100, due_at: due, draft_pricing: !!plan.is_draft, notes: notes ?? null,
  }).select("*").single();
  if (error || !inv) throw new Error(error?.message ?? "Could not create invoice");
  return inv;
}

function pdfSafe(s: string) {
  return s.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2013\u2014]/g, "-").replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "");
}
const money = (n: number) => `RM ${Number(n).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function renderInvoicePdf(inv: any, plan: any, billTo: { name: string; email?: string | null; extra?: string | null }): Promise<Uint8Array> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 56;
  let y = M;
  const t = (s: string, x: number, size = 10, bold = false) => { doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size); doc.text(pdfSafe(s), x, y); };
  const line = (s: string, size = 10, bold = false, gap = 14) => { t(s, M, size, bold); y += gap; };

  if (inv.draft_pricing) {
    doc.setFillColor(245, 180, 60); doc.rect(M, y - 12, W - M * 2, 24, "F");
    t("Draft pricing - subject to change", M + 8, 10, true); y += 30;
  }
  line("BRQ Plus Sdn Bhd", 16, true, 18);
  line("Company Reg. 202601006582 (1668680-A)");
  line("Address: [To confirm]");
  y += 10;
  doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.text("INVOICE", W - M, M + (inv.draft_pricing ? 30 : 0), { align: "right" });
  line(`Invoice no: ${inv.number}`, 11, true);
  line(`Invoice date: ${inv.issued_at}`);
  line(`Due date: ${inv.due_at}`, 10, true);
  y += 8;
  line("Bill to", 10, true);
  line(billTo.name);
  if (billTo.extra) line(billTo.extra);
  if (billTo.email) line(billTo.email);
  y += 12;
  doc.setDrawColor(180); doc.line(M, y, W - M, y); y += 18;
  t("Description", M, 10, true); doc.text("Amount", W - M, y, { align: "right" }); y += 18;
  const period = inv.period_start ? ` (${inv.period_start} to ${inv.period_end})` : " (period starts on payment)";
  const desc = `BRQ+ ${plan.name} membership - ${inv.billing_cycle === "annual" ? "annual" : "monthly"}${period}`;
  const lines = doc.splitTextToSize(pdfSafe(desc), W - M * 2 - 120) as string[];
  doc.setFont("helvetica", "normal"); lines.forEach((l, i) => doc.text(l, M, y + i * 13));
  doc.text(money(inv.amount_myr), W - M, y, { align: "right" }); y += lines.length * 13 + 12;
  doc.line(M, y, W - M, y); y += 18;
  const row = (label: string, val: string, bold = false) => { t(label, W - M - 200, 10, bold); doc.text(val, W - M, y, { align: "right" }); y += 16; };
  row("Subtotal", money(inv.amount_myr));
  row(`SST (${Number(inv.tax_rate)}%)`, money(Number(inv.total_myr) - Number(inv.amount_myr)));
  row("Total due (MYR)", money(inv.total_myr), true);
  y += 20;
  line("Payment", 11, true);
  line("Bank transfer: OCBC Al-Amin Bank Berhad");
  line("Account name: BRQ Plus Sdn. Bhd.   Account no: 1711032139   SWIFT: OCBBMYYKL");
  line("Pay online by card: sign in to BRQ+ and open Account (or Company) > Billing > Pay now.");
  line("Questions: hafidz@brqplus.ai");
  line(`Please quote ${inv.number} as your payment reference. Payable within 14 days of the invoice date.`);
  if (inv.notes) { y += 6; line(`Notes: ${inv.notes}`); }
  if (inv.status === "paid") { y += 10; line(`PAID on ${inv.paid_at}${inv.payment_reference ? ` - ref ${inv.payment_reference}` : ""}`, 12, true); }
  if (inv.status === "void") { y += 10; line("VOID", 14, true); }
  if (inv.draft_pricing) { y += 10; line("Note: this invoice uses BRQ+ draft pricing, subject to change.", 9); }
  return new Uint8Array(doc.output("arraybuffer") as ArrayBuffer);
}

/** Regenerate (status may have changed) and store the PDF, returning a short-lived signed URL. */
export async function invoicePdfUrl(invoiceId: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: inv } = await supabaseAdmin.from("invoices").select("*").eq("id", invoiceId).single();
  if (!inv) throw new Error("Invoice not found");
  const { data: plan } = await supabaseAdmin.from("membership_plans").select("*").eq("id", inv.plan_id).single();
  let billTo = { name: "BRQ+ member", email: null as string | null, extra: null as string | null };
  if (inv.company_id) {
    const { data: co } = await supabaseAdmin.from("companies").select("legal_name, registration_no, billing_contact_name, billing_contact_email").eq("id", inv.company_id).single();
    billTo = { name: co?.legal_name ?? "Company", email: co?.billing_contact_email ?? null, extra: [co?.registration_no ? `Reg. ${co.registration_no}` : "", co?.billing_contact_name ? `Attn: ${co.billing_contact_name}` : ""].filter(Boolean).join(" · ") || null };
  } else if (inv.user_id) {
    const { data: p } = await supabaseAdmin.from("profiles").select("full_name").eq("id", inv.user_id).single();
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(inv.user_id);
    billTo = { name: p?.full_name ?? "Member", email: u?.user?.email ?? null, extra: null };
  }
  const pdf = await renderInvoicePdf(inv, plan, billTo);
  const path = `${inv.company_id ? `company/${inv.company_id}` : `user/${inv.user_id}`}/${inv.number}.pdf`;
  const up = await supabaseAdmin.storage.from(BUCKET).upload(path, pdf, { contentType: "application/pdf", upsert: true });
  if (up.error) throw new Error(up.error.message);
  if (inv.pdf_path !== path) await supabaseAdmin.from("invoices").update({ pdf_path: path }).eq("id", inv.id);
  const { data: s, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, 300, { download: `${inv.number}.pdf` });
  if (error || !s) throw new Error("Could not create download link");
  return s.signedUrl;
}

/** Mark an invoice paid and activate the membership. Used by admin "Mark as paid" and online card payments. */
export async function applyInvoicePayment(invoiceId: string, paidAt: string, reference: string, actor: string | null): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: inv } = await supabaseAdmin.from("invoices").select("*").eq("id", invoiceId).single();
  if (!inv) return { ok: false, reason: "Invoice not found" };
  if (inv.status === "paid" || inv.status === "void") return { ok: false, reason: `Invoice is already ${inv.status}` };
  const start = inv.period_start ?? paidAt;
  const { end, next } = addPeriod(start, inv.billing_cycle);
  const { data: upd } = await supabaseAdmin.from("invoices").update({ status: "paid", paid_at: paidAt, payment_reference: reference, period_start: start, period_end: inv.period_end ?? end }).eq("id", inv.id).in("status", ["issued", "overdue"]).select("id");
  if (!upd?.length) return { ok: false, reason: "Invoice is no longer payable" };
  await supabaseAdmin.from("memberships").update({ status: "active", current_period_start: start, current_period_end: inv.period_end ?? end, next_invoice_date: next }).eq("id", inv.membership_id);
  if (inv.company_id) await supabaseAdmin.from("companies").update({ membership_status: "active" }).eq("id", inv.company_id);
  await billingAudit({ action: "invoice_paid", actor_user_id: actor, subject_user_id: inv.user_id, subject_company_id: inv.company_id, reason: `${inv.number} · ref ${reference} · ${paidAt}${actor ? "" : " · paid online"}` });
  return { ok: true };
}

export function addPeriod(start: string, cycle: string) {
  const d = new Date(`${start}T00:00:00Z`);
  if (cycle === "annual") d.setUTCFullYear(d.getUTCFullYear() + 1); else d.setUTCMonth(d.getUTCMonth() + 1);
  const next = d.toISOString().slice(0, 10);
  const end = new Date(d.getTime() - 86400_000).toISOString().slice(0, 10);
  return { end, next };
}
