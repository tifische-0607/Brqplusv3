import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminErrorBoundary } from "@/components/admin-error-boundary";
import { AccessDenied } from "@/components/access-denied";
import { isForbiddenError } from "@/lib/authz-error";
import { FilterChips, useUrlFilters } from "@/components/admin/UrlFilters";
import { adminHandlePlanRequest, adminListInvoices, markInvoicePaid, voidInvoice } from "@/lib/membership-billing.functions";
import { InvoiceStatusBadge, useInvoiceDownload } from "@/components/billing/MembershipBilling";
import { downloadCsv } from "@/lib/membership-options";
import { cycleLabel, rm } from "@/lib/plans";

export const Route = createFileRoute("/_authenticated/admin/billing")({
  head: () => ({ meta: [{ title: "Billing — BRQ+ Admin" }] }),
  component: () => <AdminErrorBoundary><Billing /></AdminErrorBoundary>,
  errorComponent: ({ error }) => (isForbiddenError(error) ? <AccessDenied /> : <div role="alert" className="py-12 text-destructive">{(error as Error).message}</div>),
});

const input = "rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none";
const btn = "min-h-9 rounded-md border px-2.5 py-1 text-xs font-semibold uppercase tracking-wider disabled:opacity-50";

function Billing() {
  const qc = useQueryClient();
  const fn = useServerFn(adminListInvoices);
  const q = useQuery({ queryKey: ["admin-invoices"], queryFn: () => fn(), retry: false });
  const uf = useUrlFilters();
  const status = uf.get("status") ?? "";
  const type = uf.get("type") ?? "";
  const plan = uf.get("plan") ?? "";
  const dl = useInvoiceDownload();
  const paidFn = useServerFn(markInvoicePaid);
  const voidFn = useServerFn(voidInvoice);
  const reqFn = useServerFn(adminHandlePlanRequest);
  const [payFor, setPayFor] = useState<any>(null);
  const [payRef, setPayRef] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-invoices"] }); qc.invalidateQueries({ queryKey: ["billing-kpis"] }); };
  const pay = useMutation({ mutationFn: () => paidFn({ data: { id: payFor.id, paid_at: payDate, payment_reference: payRef } }), onSuccess: () => { setPayFor(null); setPayRef(""); refresh(); } });
  const voidM = useMutation({ mutationFn: (v: { id: string; reason: string }) => voidFn({ data: v }), onSuccess: refresh });
  const reqM = useMutation({ mutationFn: (v: { id: string; approve: boolean }) => reqFn({ data: v }), onSuccess: refresh });

  const all = (q.data?.invoices ?? []) as any[];
  const today = new Date().toISOString().slice(0, 10);
  const rows = useMemo(() => all.filter((i) => {
    if (status === "awaiting" ? !["issued", "overdue"].includes(i.status) : status === "overdue" ? !(i.status === "overdue" || (i.status === "issued" && i.due_at < today)) : status && i.status !== status) return false;
    if (type && i.member_type !== type) return false;
    if (plan && i.plan_code !== plan) return false;
    return true;
  }), [all, status, type, plan, today]);

  if (q.isError) return isForbiddenError(q.error) ? <AccessDenied /> : <p role="alert" className="text-destructive">{(q.error as Error).message}</p>;
  const openReqs = (q.data?.requests ?? []).filter((r: any) => r.status === "open");
  const statusLabel: Record<string, string> = { awaiting: "awaiting payment", overdue: "overdue" };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gold">Admin</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-foreground">Billing</h1>
          <p className="mt-1 text-sm text-muted-foreground">BRQ+ membership invoices, paid by bank transfer. Renewal invoices are issued automatically 14 days before each period ends.</p>
        </div>
        <button type="button" onClick={() => downloadCsv("brq-invoices.csv", rows.map((i) => ({ number: i.number, member: i.member_name, type: i.member_type, plan: i.plan_name, cycle: i.billing_cycle, period_start: i.period_start, period_end: i.period_end, amount_myr: i.amount_myr, tax_rate: i.tax_rate, total_myr: i.total_myr, status: i.status, issued_at: i.issued_at, due_at: i.due_at, paid_at: i.paid_at, payment_reference: i.payment_reference, notes: i.notes })))} className="rounded-md border border-border px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:border-gold hover:text-gold">Export CSV</button>
      </header>

      <FilterChips chips={[
        ...(status ? [{ key: "status", label: `Status: ${statusLabel[status] ?? status}` }] : []),
        ...(type ? [{ key: "type", label: `Type: ${type}` }] : []),
        ...(plan ? [{ key: "plan", label: `Plan: ${plan}` }] : []),
      ]} onRemove={(k) => uf.set({ [k]: undefined })} />
      <div className="flex flex-wrap gap-3">
        <select aria-label="Status" className={input} value={status} onChange={(e) => uf.set({ status: e.target.value || undefined })}><option value="">All statuses</option><option value="awaiting">Awaiting payment</option><option value="overdue">Overdue</option><option value="issued">Issued</option><option value="paid">Paid</option><option value="void">Void</option></select>
        <select aria-label="Member type" className={input} value={type} onChange={(e) => uf.set({ type: e.target.value || undefined })}><option value="">All types</option><option value="personal">Personal</option><option value="corporate">Corporate</option></select>
        <select aria-label="Plan" className={input} value={plan} onChange={(e) => uf.set({ plan: e.target.value || undefined })}><option value="">All plans</option>{(q.data?.plans ?? []).map((p: any) => <option key={p.id} value={p.code}>{p.name}</option>)}</select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Invoices</caption>
          <thead className="bg-charcoal/50 text-xs uppercase tracking-wider text-muted-foreground"><tr>
            <th className="px-4 py-3">Invoice</th><th className="px-4 py-3">Member</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Issued</th><th className="px-4 py-3">Due</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"><span className="sr-only">Actions</span></th>
          </tr></thead>
          <tbody>
            {q.isLoading ? <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">Loading…</td></tr>
              : rows.length === 0 ? <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">No invoices match.</td></tr>
              : rows.map((i) => (
                <tr key={i.id} className="border-t border-border">
                  <td className="px-4 py-3 font-mono text-xs text-gold">{i.number}</td>
                  <td className="px-4 py-3">{i.member_name}<span className="block text-xs text-muted-foreground">{i.member_type}</span></td>
                  <td className="px-4 py-3">{i.plan_name}<span className="block text-xs text-muted-foreground">{cycleLabel(i.billing_cycle)}</span></td>
                  <td className="px-4 py-3">{rm(i.total_myr)}</td>
                  <td className="px-4 py-3 text-xs">{i.issued_at}</td>
                  <td className="px-4 py-3 text-xs">{i.due_at}</td>
                  <td className="px-4 py-3"><InvoiceStatusBadge status={i.status} />{i.paid_at && <span className="block text-xs text-muted-foreground">{i.paid_at} · {i.payment_reference}</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <button type="button" onClick={() => dl.mutate(i.id)} className={`${btn} border-border text-muted-foreground hover:border-gold hover:text-gold`} aria-label={`Download or resend ${i.number}`}>PDF</button>
                      {["issued", "overdue"].includes(i.status) && <>
                        <button type="button" onClick={() => setPayFor(i)} className={`${btn} border-cyan/60 text-cyan hover:bg-cyan/10`}>Mark as paid</button>
                        <button type="button" disabled={voidM.isPending} onClick={() => { const r = window.prompt(`Reason for voiding ${i.number}?`); if (r?.trim()) voidM.mutate({ id: i.id, reason: r.trim() }); }} className={`${btn} border-destructive/50 text-destructive hover:bg-destructive/10`}>Void</button>
                      </>}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">"PDF" regenerates the latest invoice for download so you can send it to the member. Automatic invoice emails need an email sender to be set up.</p>
      {(dl.isError || voidM.isError) && <p role="alert" className="text-sm text-destructive">{((dl.error ?? voidM.error) as Error).message}</p>}

      {payFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4" onClick={() => setPayFor(null)}>
          <form role="dialog" aria-label={`Mark ${payFor.number} as paid`} onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); pay.mutate(); }} className="grid w-full max-w-md gap-3 rounded-xl border border-border bg-card p-6">
            <h2 className="font-display text-xl font-bold">Mark {payFor.number} as paid</h2>
            <p className="text-sm text-muted-foreground">{payFor.member_name} · {rm(payFor.total_myr)}</p>
            <label className="text-sm">Payment date<input type="date" required className={`${input} mt-1 w-full`} value={payDate} onChange={(e) => setPayDate(e.target.value)} /></label>
            <label className="text-sm">Payment reference<input required maxLength={120} className={`${input} mt-1 w-full`} value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="Bank / DuitNow reference" /></label>
            <div className="flex gap-2"><button type="submit" disabled={pay.isPending} className={`${btn} border-gold bg-gold/10 text-gold`}>{pay.isPending ? "Saving…" : "Confirm payment"}</button><button type="button" onClick={() => setPayFor(null)} className={`${btn} border-border text-muted-foreground`}>Cancel</button></div>
            {pay.isError && <p role="alert" className="text-xs text-destructive">{(pay.error as Error).message}</p>}
          </form>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold">Plan change requests</h2>
        {openReqs.length === 0 ? <p className="text-sm text-muted-foreground">No open requests.</p> : openReqs.map((r: any) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 text-sm">
            <p>{r.requester} → <strong>{r.plan_name}</strong> · {cycleLabel(r.requested_cycle)}{r.note ? <span className="block text-xs text-muted-foreground">{r.note}</span> : null}</p>
            <div className="flex gap-2">
              <button type="button" disabled={reqM.isPending} onClick={() => reqM.mutate({ id: r.id, approve: true })} className={`${btn} border-gold text-gold hover:bg-gold/10`}>Apply from next invoice</button>
              <button type="button" disabled={reqM.isPending} onClick={() => reqM.mutate({ id: r.id, approve: false })} className={`${btn} border-border text-muted-foreground`}>Decline</button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
