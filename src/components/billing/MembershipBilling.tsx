import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CreditCard, Download } from "lucide-react";
import { adminGetBilling, changeSubscriptionPlan, createBillingPortal, getInvoiceDownloadUrl, getMyBilling, getMyPaymentStatus, requestPlanChange } from "@/lib/membership-billing.functions";
import { MEMBERSHIP_STATUS_LABEL, cycleLabel, planPrice, rm, seatLabel } from "@/lib/plans";

export function useInvoiceDownload() {
  const fn = useServerFn(getInvoiceDownloadUrl);
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: ({ url }) => { window.open(url, "_blank", "noopener"); },
  });
}

export function InvoiceStatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = { issued: "border-gold/60 text-gold", paid: "border-cyan/60 text-cyan", overdue: "border-destructive/60 text-destructive", void: "border-border text-muted-foreground" };
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls[status] ?? "border-border"}`}>{status}</span>;
}

export function InvoiceTable({ invoices, payable = false }: { invoices: any[]; payable?: boolean }) {
  const dl = useInvoiceDownload();
  if (!invoices.length) return <p className="text-sm text-muted-foreground">No invoices yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Invoice history</caption>
        <thead className="text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="py-2 pr-3">Invoice</th><th className="py-2 pr-3">Issued</th><th className="py-2 pr-3">Due</th><th className="py-2 pr-3">Total</th><th className="py-2 pr-3">Status</th><th className="py-2"><span className="sr-only">PDF</span></th></tr></thead>
        <tbody>{invoices.map((i) => (
          <tr key={i.id} className="border-t border-border">
            <td className="py-2 pr-3 font-mono text-xs text-gold">{i.number}</td>
            <td className="py-2 pr-3 text-xs">{i.issued_at}</td>
            <td className="py-2 pr-3 text-xs">{i.due_at}</td>
            <td className="py-2 pr-3">{rm(i.total_myr)}</td>
            <td className="py-2 pr-3"><InvoiceStatusBadge status={i.status} /></td>
            <td className="py-2 text-right"><div className="flex justify-end gap-1.5">{payable && ["issued", "overdue"].includes(i.status) && <Link to="/pay/$invoiceId" params={{ invoiceId: i.id }} aria-label={`Pay invoice ${i.number}`} className="inline-flex min-h-9 items-center gap-1 rounded-md border border-gold px-2 py-1 text-xs font-semibold text-gold hover:bg-gold/10"><CreditCard className="h-3.5 w-3.5" aria-hidden />Pay now</Link>}<button type="button" onClick={() => dl.mutate(i.id)} disabled={dl.isPending} aria-label={`Download invoice ${i.number}`} className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:border-gold hover:text-gold"><Download className="h-3.5 w-3.5" aria-hidden />PDF</button></div></td>
          </tr>
        ))}</tbody>
      </table>
      {dl.isError && <p role="alert" className="mt-2 text-xs text-destructive">{(dl.error as Error).message}</p>}
    </div>
  );
}

function Summary({ b }: { b: any }) {
  const m = b.membership;
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">Plan</dt><dd className="font-semibold">{b.plan?.name ?? "—"}{b.plan?.is_draft ? <span className="ml-2 text-[10px] uppercase text-warning">Draft pricing</span> : null}</dd></div>
      <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">Billing</dt><dd>{cycleLabel(m.billing_cycle)} · {rm(m.price_myr)}</dd></div>
      <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">Status</dt><dd className={m.status === "active" ? "text-cyan" : "text-gold"}>{MEMBERSHIP_STATUS_LABEL[m.status] ?? m.status}</dd></div>
      <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">{m.stripe_subscription_id ? (m.cancel_at_period_end ? "Access ends" : "Renews automatically") : "Next renewal"}</dt><dd>{m.stripe_subscription_id ? (m.current_period_end ?? "—") : (m.next_invoice_date ?? "Set when first invoice is paid")}</dd></div>
      <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">Payment</dt><dd>{m.stripe_subscription_id ? "Card · automatic renewal" : "Invoice · card or bank transfer"}</dd></div>
      {b.plan?.member_type === "corporate" && <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">Seats</dt><dd>{seatLabel(b.plan?.max_users)}</dd></div>}
    </dl>
  );
}

/** Member-facing "Membership & Billing" section for /account (personal) and /company (company admins). */
export function MyMembershipBilling({ scope }: { scope: "personal" | "company" }) {
  const qc = useQueryClient();
  const fn = useServerFn(getMyBilling);
  const reqFn = useServerFn(requestPlanChange);
  const q = useQuery({ queryKey: ["my-billing", scope], queryFn: () => fn({ data: { scope } }), retry: false });
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState("");
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");
  const [note, setNote] = useState("");
  const chFn = useServerFn(changeSubscriptionPlan);
  const portalFn = useServerFn(createBillingPortal);
  const [msg, setMsg] = useState<string | null>(null);
  const change = useMutation({
    mutationFn: async () => { const r = await chFn({ data: { scope, plan_id: plan, cycle } }); if ("error" in r) throw new Error(r.error); return r; },
    onSuccess: (r) => { setOpen(false); setMsg(r.mode === "upgrade" ? "Upgraded. The pro-rated difference was charged to your card." : "Done. Your new plan starts at your next renewal."); qc.invalidateQueries({ queryKey: ["my-billing", scope] }); },
  });
  const portal = useMutation({
    mutationFn: async () => { const r = await portalFn({ data: { scope, returnUrl: window.location.href } }); if ("error" in r) throw new Error(r.error); window.open(r.url, "_blank", "noopener"); },
  });
  const req = useMutation({
    mutationFn: () => reqFn({ data: { scope, plan_id: plan, cycle, note: note || undefined } }),
    onSuccess: () => { setOpen(false); setNote(""); qc.invalidateQueries({ queryKey: ["my-billing", scope] }); },
  });
  const b = q.data as any;
  if (q.isLoading) return <section className="rounded-xl border border-border bg-card p-6"><p className="text-sm text-muted-foreground">Loading membership…</p></section>;
  if (!b?.membership) return null;
  const openReq = (b.requests ?? []).find((r: any) => r.status === "open");
  const sched = (b.requests ?? []).find((r: any) => r.status === "scheduled");
  const subbed = !!b.membership.stripe_subscription_id;
  const schedPlan = sched && b.plans.find((p: any) => p.id === sched.requested_plan_id);
  const input = "rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-gold focus:outline-none";
  return (
    <section aria-labelledby={`billing-${scope}`} className="space-y-5 rounded-xl border border-border bg-card p-6">
      <h2 id={`billing-${scope}`} className="font-display text-xl font-bold">Membership &amp; Billing</h2>
      <Summary b={b} />
      {b.can_manage && <>
        <div><h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gold">Invoice history</h3><InvoiceTable invoices={b.invoices} /></div>
        {subbed && b.membership.payment_past_due_since && <p role="alert" className="rounded-md border border-warning bg-warning/10 px-3 py-2 text-sm">Your last renewal payment didn't go through. We'll retry automatically — please update your card. Membership lapses if unpaid 30 days after {b.membership.payment_past_due_since}.</p>}
        {subbed && b.membership.cancel_at_period_end && <p role="status" className="text-sm text-muted-foreground">Automatic renewal is cancelled. Your access continues until {b.membership.current_period_end}.</p>}
        {schedPlan && <p role="status" className="text-sm text-cyan">Changing to {schedPlan.name} ({cycleLabel(sched.requested_cycle)}) at your next renewal.</p>}
        {msg && <p role="status" className="text-sm text-cyan">{msg}</p>}
        {subbed && <div><button type="button" onClick={() => portal.mutate()} disabled={portal.isPending} className="rounded-md border border-border px-3 py-2 text-xs font-semibold uppercase tracking-wider hover:border-gold hover:text-gold">Manage card &amp; cancellation</button>{portal.isError && <p role="alert" className="mt-1 text-xs text-destructive">{(portal.error as Error).message}</p>}</div>}
        {!subbed && openReq ? <p role="status" className="text-sm text-cyan">Your plan change request is with BRQ+ for review.</p>
          : !open ? <button type="button" onClick={() => { setOpen(true); setPlan(b.membership.plan_id); setCycle(b.membership.billing_cycle); }} className="rounded-md border border-gold/60 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gold hover:bg-gold/10">{subbed ? "Change plan" : "Request plan change"}</button>
          : <form onSubmit={(e) => { e.preventDefault(); subbed ? change.mutate() : req.mutate(); }} className="grid gap-3 rounded-md border border-border p-4">
            <div className="flex flex-wrap gap-2">
              <select aria-label="New plan" className={input} value={plan} onChange={(e) => setPlan(e.target.value)}>{b.plans.map((p: any) => <option key={p.id} value={p.id}>{p.name} — {rm(planPrice(p, cycle))}</option>)}</select>
              <select aria-label="Billing cycle" className={input} value={cycle} onChange={(e) => setCycle(e.target.value as any)}><option value="monthly">Monthly</option><option value="annual">Annual</option></select>
            </div>
            {subbed && <p className="text-xs text-muted-foreground">Upgrades apply now and you're charged the pro-rated difference. Downgrades start at your next renewal.</p>}
            {!subbed && <textarea aria-label="Note for BRQ+" className={`${input} min-h-16`} maxLength={500} placeholder="Anything BRQ+ should know (optional)" value={note} onChange={(e) => setNote(e.target.value)} />}
            <div className="flex gap-2"><button type="submit" disabled={req.isPending || change.isPending} className="rounded-md border border-gold bg-gold/10 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gold">{subbed ? "Confirm change" : "Send request"}</button><button type="button" onClick={() => setOpen(false)} className="rounded-md border border-border px-3 py-2 text-xs uppercase text-muted-foreground">Cancel</button></div>
            {(req.isError || change.isError) && <p role="alert" className="text-xs text-destructive">{((req.error ?? change.error) as Error).message}</p>}
          </form>}
      </>}
    </section>
  );
}

/** Admin dossier panel. */
export function AdminMembershipBilling({ userId, companyId }: { userId?: string; companyId?: string }) {
  const fn = useServerFn(adminGetBilling);
  const q = useQuery({ queryKey: ["admin-billing-subject", userId ?? companyId], queryFn: () => fn({ data: { user_id: userId, company_id: companyId } }), retry: false });
  const b = q.data as any;
  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between"><h2 className="font-display text-xl font-bold">Membership &amp; Billing</h2><Link to="/admin/billing" className="text-xs text-cyan hover:underline">Open billing →</Link></div>
      {q.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : !b?.membership ? <p className="text-sm text-muted-foreground">No paid membership on record.</p> : <><Summary b={b} /><InvoiceTable invoices={b.invoices} /></>}
    </section>
  );
}

/** Portal banner shown while a membership is awaiting payment. */
export function PaymentBanner() {
  const fn = useServerFn(getMyPaymentStatus);
  const q = useQuery({ queryKey: ["my-payment-status"], queryFn: () => fn(), retry: false, staleTime: 60_000 });
  const dl = useInvoiceDownload();
  const s = q.data;
  if (!s) return null;
  const overdue = s.status === "payment_overdue";
  return (
    <div role="status" className={`mb-6 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm ${overdue ? "border-destructive/60 bg-destructive/10" : "border-warning bg-warning/10"}`}>
      <AlertTriangle className={`h-4 w-4 ${overdue ? "text-destructive" : "text-warning"}`} aria-hidden />
      <p className="flex-1">
        {overdue ? "Your membership payment is overdue" : "Your membership is awaiting payment"}
        {s.invoice && <> — Invoice <strong>{s.invoice.number}</strong> ({rm(s.invoice.total_myr)}) due {s.invoice.due_at}</>}.
        {" "}Directory and program applications unlock once payment is received.
      </p>
      {s.invoice && <Link to="/pay/$invoiceId" params={{ invoiceId: s.invoice.id }} className="inline-flex min-h-9 items-center gap-1 rounded-md border border-gold bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold hover:bg-gold/20"><CreditCard className="h-3.5 w-3.5" aria-hidden />Pay now</Link>}
      {s.invoice && s.can_download && <button type="button" onClick={() => dl.mutate(s.invoice!.id)} disabled={dl.isPending} className="inline-flex min-h-9 items-center gap-1 rounded-md border border-gold px-3 py-1.5 text-xs font-semibold text-gold hover:bg-gold/10"><Download className="h-3.5 w-3.5" aria-hidden />Download invoice</button>}
    </div>
  );
}
