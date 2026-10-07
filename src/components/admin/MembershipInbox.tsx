import { MEMBERSHIP_SOURCES } from "@/lib/membership-options";
import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  approveMembershipApplication, listMembershipApplications, setMembershipApplicationStatus,
} from "@/lib/membership.functions";
import { CORPORATE_FIELD_LABELS, PERSONAL_FIELD_LABELS, downloadCsv } from "@/lib/membership-options";
import { isForbiddenError } from "@/lib/authz-error";
import { AccessDenied } from "@/components/access-denied";
import { FilterChips, useUrlFilters } from "@/components/admin/UrlFilters";
import { adminListPlans } from "@/lib/membership-billing.functions";
import { cycleLabel, planPrice, rm } from "@/lib/plans";

type Tab = "personal" | "corporate" | "legacy";
const STATUSES = ["submitted", "under_review", "approved", "rejected", "withdrawn"] as const;
const statusCls: Record<string, string> = {
  submitted: "border-gold/50 text-gold", under_review: "border-cyan/50 text-cyan", approved: "border-cyan/60 text-cyan",
  rejected: "border-destructive/40 text-destructive", withdrawn: "border-border text-muted-foreground",
};
export function MembershipStatusBadge({ status }: { status: string }) {
  return <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusCls[status] ?? "border-border"}`}>{status.replace("_", " ")}</span>;
}
const fmt = (v: unknown) => Array.isArray(v) ? v.join(", ") : typeof v === "boolean" ? (v ? "Yes" : "No") : v == null || v === "" ? "—" : String(v);

export function MembershipInbox({ legacy }: { legacy: ReactNode }) {
  const uf = useUrlFilters();
  const tabParam = uf.get("tab");
  const tab: Tab = tabParam === "corporate" || tabParam === "legacy" ? tabParam : "personal";
  const setTab = (t: Tab) => uf.set({ tab: t });
  const statusParam = uf.get("status");
  const status = !statusParam || statusParam === "pending" ? "open" : statusParam;
  const setStatus = (v: string) => uf.set({ status: v === "open" ? "pending" : v });
  const qc = useQueryClient();
  const fetchFn = useServerFn(listMembershipApplications);
  const statusFn = useServerFn(setMembershipApplicationStatus);
  const approveFn = useServerFn(approveMembershipApplication);
  const q = useQuery({ queryKey: ["membership-applications"], queryFn: () => fetchFn(), retry: false });
  const plansFn = useServerFn(adminListPlans);
  const plansQ = useQuery({ queryKey: ["admin-plans"], queryFn: () => plansFn(), retry: false });
  const plans = (plansQ.data?.plans ?? []) as any[];
  const planById = (id: string | null) => plans.find(p => p.id === id);
  const [planFilter, setPlanFilter] = useState("");
  const [cycleFilter, setCycleFilter] = useState("");
  const [approvePlan, setApprovePlan] = useState("");
  const [approveCycle, setApproveCycle] = useState<"monthly" | "annual">("monthly");

  const [country, setCountry] = useState("");
  const [sector, setSector] = useState("");
  const [collective, setCollective] = useState<"all" | "yes" | "no">("all");
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [asCollective, setAsCollective] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const all = q.data ?? [];
  const rows = useMemo(() => all.filter((a: any) => {
    if (a.type !== tab) return false;
    if (status === "open" ? !["submitted", "under_review"].includes(a.status) : status !== "all" && a.status !== status) return false;
    const p = a.payload ?? {};
    if (country && !String(p.country ?? "").toLowerCase().includes(country.toLowerCase())) return false;
    if (sector && p.sector !== sector) return false;
    if (source && (a.source ?? "web") !== source) return false;
    if (planFilter && (planFilter === "none" ? a.plan_id : a.plan_id !== planFilter)) return false;
    if (cycleFilter && a.billing_cycle !== cycleFilter) return false;
    if (tab === "personal" && collective !== "all" && a.wants_collective !== (collective === "yes")) return false;
    const hay = `${a.reference} ${a.email} ${p.fullName ?? ""} ${p.legalName ?? ""} ${p.contactName ?? ""}`.toLowerCase();
    return !search || hay.includes(search.toLowerCase());
  }), [all, tab, status, country, sector, collective, search, source, planFilter, cycleFilter]);
  const sectors = Array.from(new Set(all.filter((a: any) => a.type === tab).map((a: any) => a.payload?.sector).filter(Boolean))) as string[];
  const selected = all.find((a: any) => a.id === selectedId) as any;

  const done = (text: string) => { setMsg({ ok: true, text }); setNote(""); qc.invalidateQueries({ queryKey: ["membership-applications"] }); qc.invalidateQueries({ queryKey: ["membership-kpis"] }); };
  const fail = (e: any) => setMsg({ ok: false, text: e?.message ?? "Action failed" });
  const setSt = useMutation({ mutationFn: (v: { id: string; status: any; note?: string }) => statusFn({ data: v }), onSuccess: (_d, v) => done(`Marked ${v.status.replace("_", " ")}`), onError: fail });
  const approve = useMutation({
    mutationFn: (a: any) => { if (!approvePlan) throw new Error("Choose a plan before approving."); return approveFn({ data: { id: a.id, plan_id: approvePlan, billing_cycle: approveCycle, as_collective: a.type === "personal" && a.wants_collective && asCollective, note: note || undefined, redirect_to: `${window.location.origin}/onboarding` } }); },
    onSuccess: (d: any, a) => done(`Approved — invitation sent to ${a.email}. Invoice ${d?.invoice_number ?? ""} issued.`), onError: fail,
  });

  if (q.isError && isForbiddenError(q.error)) return <AccessDenied />;
  const labels = tab === "corporate" ? CORPORATE_FIELD_LABELS : PERSONAL_FIELD_LABELS;
  const input = "rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none";

  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gold">Admin</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-foreground">Membership applications</h1>
      </div>
      {tab !== "legacy" && <button onClick={() => downloadCsv(`brq-${tab}-applications.csv`, rows.map((a: any) => ({ reference: a.reference, status: a.status, email: a.email, source: a.source ?? "web", plan: planById(a.plan_id)?.name ?? "", billing_cycle: a.billing_cycle ?? "", quoted_price_myr: a.quoted_price_myr ?? "", wants_collective: a.wants_collective, created_at: a.created_at, reviewed_at: a.reviewed_at, review_notes: a.review_notes, ...a.payload })))} className="rounded-md border border-border px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:border-gold hover:text-gold">Export CSV</button>}
    </header>
    <div role="tablist" className="flex gap-2 border-b border-border">
      {(["personal", "corporate", "legacy"] as Tab[]).map(t => <button key={t} role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setSelectedId(null); }} className={`-mb-px border-b-2 px-4 py-2 text-sm ${tab === t ? "border-gold text-foreground" : "border-transparent text-muted-foreground hover:text-cyan"}`}>
        {t === "legacy" ? "Legacy Collective" : t[0].toUpperCase() + t.slice(1)}
        {t !== "legacy" && <span className="ml-2 text-xs text-muted-foreground">{all.filter((a: any) => a.type === t && ["submitted", "under_review"].includes(a.status)).length}</span>}
      </button>)}
    </div>

    {tab === "legacy" ? <div><p className="mb-4 text-xs text-muted-foreground">Legacy: applications submitted through the previous Collective form.</p>{legacy}</div> : <>
      <FilterChips
        chips={[
          ...(tabParam ? [{ key: "tab", label: `Type: ${tab}` }] : []),
          ...(statusParam ? [{ key: "status", label: `Status: ${status === "open" ? "pending (submitted + under review)" : status.replace("_", " ")}` }] : []),
        ]}
        onRemove={(k) => uf.set({ [k]: undefined })}
      />
      <div className="flex flex-wrap gap-3">
        <input className={input} placeholder="Search name, email, reference" value={search} onChange={e => setSearch(e.target.value)} />
        <select className={input} value={status} onChange={e => setStatus(e.target.value)}><option value="open">Open (submitted + under review)</option><option value="all">All statuses</option>{STATUSES.map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select>
        <input className={input} placeholder="Country" value={country} onChange={e => setCountry(e.target.value)} />
        <select className={input} value={sector} onChange={e => setSector(e.target.value)}><option value="">All sectors</option>{sectors.map(s => <option key={s}>{s}</option>)}</select>
        <select className={input} value={source} onChange={e => setSource(e.target.value)}><option value="">All sources</option>{MEMBERSHIP_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}</select>
        <select className={input} aria-label="Plan" value={planFilter} onChange={e => setPlanFilter(e.target.value)}><option value="">All plans</option>{plans.filter(p => p.member_type === tab).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}<option value="none">No plan</option></select>
        <select className={input} aria-label="Billing cycle" value={cycleFilter} onChange={e => setCycleFilter(e.target.value)}><option value="">Any cycle</option><option value="monthly">Monthly</option><option value="annual">Annual</option></select>
        {tab === "personal" && <select className={input} value={collective} onChange={e => setCollective(e.target.value as any)}><option value="all">Collective opt-in: any</option><option value="yes">Opted in</option><option value="no">Not opted in</option></select>}
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-charcoal/50 text-xs uppercase tracking-wider text-muted-foreground"><tr>
            <th className="px-4 py-3">Reference</th><th className="px-4 py-3">{tab === "corporate" ? "Company" : "Name"}</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Country</th><th className="px-4 py-3">Sector</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Cycle</th><th className="px-4 py-3">Price</th>{tab === "personal" && <th className="px-4 py-3">Collective</th>}<th className="px-4 py-3">Status</th><th className="px-4 py-3">Submitted</th>
          </tr></thead>
          <tbody>
            {q.isLoading ? <tr><td colSpan={12} className="px-4 py-10 text-center text-muted-foreground">Loading…</td></tr>
              : rows.length === 0 ? <tr><td colSpan={12} className="px-4 py-10 text-center text-muted-foreground">No applications match.</td></tr>
              : rows.map((a: any) => <tr key={a.id} onClick={() => { setSelectedId(a.id); setMsg(null); setAsCollective(true); setApprovePlan(a.plan_id ?? ""); setApproveCycle(a.billing_cycle ?? "monthly"); }} className="cursor-pointer border-t border-border hover:bg-secondary/40">
                <td className="px-4 py-3 font-mono text-xs text-gold">{a.reference}</td>
                <td className="px-4 py-3 text-foreground">{a.type === "corporate" ? a.payload?.legalName : a.payload?.fullName}</td>
                <td className="px-4 py-3 text-cyan">{a.email}</td>
                <td className="px-4 py-3 text-muted-foreground">{a.payload?.country}</td>
                <td className="px-4 py-3 text-muted-foreground">{a.payload?.sector}</td>
                <td className="px-4 py-3 text-xs uppercase text-muted-foreground">{a.source ?? "web"}</td>
                <td className="px-4 py-3 text-foreground">{planById(a.plan_id)?.name ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{cycleLabel(a.billing_cycle)}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{a.quoted_price_myr != null ? rm(a.quoted_price_myr) : "—"}</td>
                {tab === "personal" && <td className="px-4 py-3 text-xs">{a.wants_collective ? <span className="text-gold">Opted in</span> : "—"}</td>}
                <td className="px-4 py-3"><MembershipStatusBadge status={a.status} /></td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</td>
              </tr>)}
          </tbody>
        </table>
      </div>
    </>}

    {selected && tab !== "legacy" && <div className="fixed inset-0 z-50 flex justify-end bg-background/70" onClick={() => setSelectedId(null)}>
      <aside role="dialog" aria-label="Application details" className="h-full w-full max-w-xl overflow-y-auto border-l border-border bg-card p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div><p className="font-mono text-xs text-gold">{selected.reference}</p><h2 className="mt-1 font-display text-2xl font-bold">{selected.type === "corporate" ? selected.payload?.legalName : selected.payload?.fullName}</h2><div className="mt-2"><MembershipStatusBadge status={selected.status} /></div></div>
          <button onClick={() => setSelectedId(null)} className="text-sm text-muted-foreground hover:text-foreground" aria-label="Close">✕</button>
        </div>
        <dl className="mt-6 grid gap-3 text-sm">
          {Object.keys(labels).filter(k => k in (selected.payload ?? {})).map(k => <div key={k} className="grid grid-cols-[10rem_1fr] gap-3 border-b border-border/50 pb-2"><dt className="text-xs uppercase tracking-wider text-muted-foreground">{labels[k]}</dt><dd className="whitespace-pre-wrap break-words text-foreground">{fmt(selected.payload[k])}</dd></div>)}
        </dl>
        {selected.review_notes && <p className="mt-4 rounded-md border border-border p-3 text-xs text-muted-foreground">Review notes: {selected.review_notes}</p>}
        {selected.approved_user_id && <Link to="/admin/members/$userId" params={{ userId: selected.approved_user_id }} className="mt-4 inline-block text-sm text-cyan hover:underline">Open member dossier →</Link>}
        {selected.approved_company_id && <Link to="/admin/companies/$companyId" params={{ companyId: selected.approved_company_id }} className="ml-4 mt-4 inline-block text-sm text-cyan hover:underline">Open company dossier →</Link>}
        {selected.status !== "approved" && <div className="mt-6 space-y-3 border-t border-border pt-6">
          <textarea className={`${input} min-h-20 w-full`} maxLength={2000} placeholder="Note (required for rejection, optional otherwise)" value={note} onChange={e => setNote(e.target.value)} />
          <div className="grid gap-2 rounded-md border border-border p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-gold">Plan to approve</p>
            <div className="flex flex-wrap gap-2">
              <select aria-label="Plan to approve" className={input} value={approvePlan} onChange={e => setApprovePlan(e.target.value)}><option value="">Choose plan</option>{plans.filter(p => p.member_type === selected.type).map(p => <option key={p.id} value={p.id}>{p.name}{p.is_active ? "" : " (inactive)"}</option>)}</select>
              <select aria-label="Billing cycle to approve" className={input} value={approveCycle} onChange={e => setApproveCycle(e.target.value as any)}><option value="monthly">Monthly</option><option value="annual">Annual</option></select>
            </div>
            {planById(approvePlan) && <p className="text-xs text-muted-foreground">First invoice: {rm(planPrice(planById(approvePlan), approveCycle))} ({cycleLabel(approveCycle)}), due 14 days after approval.{selected.quoted_price_myr != null && (approvePlan !== selected.plan_id || approveCycle !== selected.billing_cycle) ? ` Applicant chose ${planById(selected.plan_id)?.name ?? "—"} · ${cycleLabel(selected.billing_cycle)}.` : ""}</p>}
          </div>
          {selected.type === "personal" && selected.wants_collective && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-gold" checked={asCollective} onChange={e => setAsCollective(e.target.checked)} />Approve as a member of The Collective</label>}
          <div className="flex flex-wrap gap-2">
            <button disabled={approve.isPending} onClick={() => approve.mutate(selected)} className="rounded-md border border-gold bg-gold/10 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gold hover:bg-gold/20 disabled:opacity-50">{approve.isPending ? "Approving…" : "Approve & invite"}</button>
            {selected.status !== "under_review" && <button disabled={setSt.isPending} onClick={() => setSt.mutate({ id: selected.id, status: "under_review", note: note || undefined })} className="rounded-md border border-cyan/50 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-cyan hover:bg-cyan/10">Mark under review</button>}
            {selected.status !== "rejected" ? <button disabled={setSt.isPending} onClick={() => note.trim() ? setSt.mutate({ id: selected.id, status: "rejected", note }) : setMsg({ ok: false, text: "Add a note before rejecting." })} className="rounded-md border border-destructive/50 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-destructive hover:bg-destructive/10">Reject</button>
              : <button onClick={() => setSt.mutate({ id: selected.id, status: "submitted" })} className="rounded-md border border-border px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reopen</button>}
          </div>
        </div>}
        {msg && <p className={`mt-4 text-sm ${msg.ok ? "text-cyan" : "text-destructive"}`}>{msg.text}</p>}
      </aside>
    </div>}
  </div>;
}
