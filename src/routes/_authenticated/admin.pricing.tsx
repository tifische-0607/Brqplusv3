import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminErrorBoundary } from "@/components/admin-error-boundary";
import { AccessDenied } from "@/components/access-denied";
import { isForbiddenError } from "@/lib/authz-error";
import { adminListPlans, adminSetTaxRate, adminUpdatePlan } from "@/lib/membership-billing.functions";
import type { MembershipPlan } from "@/lib/plans";

export const Route = createFileRoute("/_authenticated/admin/pricing")({
  head: () => ({ meta: [{ title: "Membership Pricing — BRQ+ Admin" }] }),
  component: () => <AdminErrorBoundary><Pricing /></AdminErrorBoundary>,
  errorComponent: ({ error }) => (isForbiddenError(error) ? <AccessDenied /> : <div role="alert" className="py-12 text-destructive">{(error as Error).message}</div>),
});

const input = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none";

function Pricing() {
  const fn = useServerFn(adminListPlans);
  const q = useQuery({ queryKey: ["admin-plans"], queryFn: () => fn(), retry: false });
  if (q.isError) return isForbiddenError(q.error) ? <AccessDenied /> : <p role="alert" className="text-destructive">{(q.error as Error).message}</p>;
  const plans = (q.data?.plans ?? []) as unknown as MembershipPlan[];
  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-gold">Admin</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-foreground">Membership pricing</h1>
        <p className="mt-1 text-sm text-muted-foreground">Edit BRQ+ plans shown on /membership and the application forms. Changes apply to new applications and future invoices.</p>
      </header>
      {q.data && <TaxSetting rate={q.data.tax_rate} />}
      {q.isLoading && <p className="text-muted-foreground">Loading…</p>}
      {(["personal", "corporate"] as const).map((t) => (
        <section key={t} className="space-y-4">
          <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{t === "personal" ? "Personal" : "Corporate"}</h2>
          <div className="grid gap-4 lg:grid-cols-3">{plans.filter((p) => p.member_type === t).map((p) => <PlanEditor key={p.id} plan={p} />)}</div>
        </section>
      ))}
    </div>
  );
}

function TaxSetting({ rate }: { rate: number }) {
  const qc = useQueryClient();
  const fn = useServerFn(adminSetTaxRate);
  const [v, setV] = useState(String(rate));
  const m = useMutation({ mutationFn: () => fn({ data: { rate: Number(v) } }), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-plans"] }) });
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <label className="text-sm">SST rate (%)<input className={`${input} mt-1 w-32`} type="number" min={0} max={50} step="0.01" value={v} onChange={(e) => setV(e.target.value)} /></label>
      <button type="button" onClick={() => m.mutate()} disabled={m.isPending} className="rounded-md border border-gold bg-gold/10 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gold hover:bg-gold/20">Save</button>
      <p className="text-xs text-muted-foreground">Applied to newly issued invoices. Label on invoices: "SST".</p>
      {m.isSuccess && <span role="status" className="text-xs text-cyan">Saved</span>}
      {m.isError && <span role="alert" className="text-xs text-destructive">{(m.error as Error).message}</span>}
    </div>
  );
}

function PlanEditor({ plan }: { plan: MembershipPlan }) {
  const qc = useQueryClient();
  const fn = useServerFn(adminUpdatePlan);
  const [f, setF] = useState({ ...plan, benefitsText: plan.benefits.join("\n") });
  useEffect(() => setF({ ...plan, benefitsText: plan.benefits.join("\n") }), [plan]);
  const m = useMutation({
    mutationFn: () => fn({ data: {
      id: plan.id, name: f.name, tagline: f.tagline || null, monthly_price_myr: Number(f.monthly_price_myr), annual_price_myr: Number(f.annual_price_myr),
      max_users: plan.member_type === "corporate" && f.max_users ? Number(f.max_users) : null,
      benefits: f.benefitsText.split("\n").map((s) => s.trim()).filter(Boolean), is_active: f.is_active, is_draft: f.is_draft, is_popular: f.is_popular,
    } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-plans"] }),
  });
  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="grid gap-3 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">{plan.code}</span>
        {plan.is_draft && <span className="rounded-full border border-warning px-2 py-0.5 text-[10px] font-semibold uppercase text-warning">Draft pricing</span>}
        {!plan.is_active && <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase text-muted-foreground">Inactive</span>}
      </div>
      <label className="text-sm">Name<input className={`${input} mt-1`} value={f.name} onChange={(e) => set("name", e.target.value)} maxLength={80} required /></label>
      <label className="text-sm">Tagline<input className={`${input} mt-1`} value={f.tagline ?? ""} onChange={(e) => set("tagline", e.target.value)} maxLength={200} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">Monthly (RM)<input className={`${input} mt-1`} type="number" min={0} step="0.01" value={f.monthly_price_myr} onChange={(e) => set("monthly_price_myr", e.target.value)} /></label>
        <label className="text-sm">Annual (RM)<input className={`${input} mt-1`} type="number" min={0} step="0.01" value={f.annual_price_myr} onChange={(e) => set("annual_price_myr", e.target.value)} /></label>
      </div>
      {plan.member_type === "corporate" && <label className="text-sm">Max users (blank = unlimited)<input className={`${input} mt-1`} type="number" min={1} value={f.max_users ?? ""} onChange={(e) => set("max_users", e.target.value === "" ? null : e.target.value)} /></label>}
      <label className="text-sm">Benefits (one per line)<textarea className={`${input} mt-1 min-h-28`} value={f.benefitsText} onChange={(e) => set("benefitsText", e.target.value)} /></label>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" className="accent-gold" checked={f.is_active} onChange={(e) => set("is_active", e.target.checked)} />Active</label>
        <label className="flex items-center gap-2"><input type="checkbox" className="accent-gold" checked={f.is_draft} onChange={(e) => set("is_draft", e.target.checked)} />Draft pricing</label>
        <label className="flex items-center gap-2"><input type="checkbox" className="accent-gold" checked={f.is_popular} onChange={(e) => set("is_popular", e.target.checked)} />Most popular</label>
      </div>
      <button type="submit" disabled={m.isPending} className="w-fit rounded-md border border-gold bg-gold/10 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gold hover:bg-gold/20 disabled:opacity-50">{m.isPending ? "Saving…" : "Save plan"}</button>
      {m.isSuccess && <p role="status" className="text-xs text-cyan">Saved</p>}
      {m.isError && <p role="alert" className="text-xs text-destructive">{(m.error as Error).message}</p>}
    </form>
  );
}
