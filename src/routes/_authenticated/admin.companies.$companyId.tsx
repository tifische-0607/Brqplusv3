import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminGetCompanyDossier, adminSetCompanyStatus } from "@/lib/membership.functions";
import { AdminErrorBoundary } from "@/components/admin-error-boundary";
import { AccessDenied } from "@/components/access-denied";
import { isForbiddenError } from "@/lib/authz-error";
import { AuditList, Facts, NotesPanel, Panel } from "@/components/admin/DossierParts";
import { AdminMembershipBilling } from "@/components/billing/MembershipBilling";
import { AdminSignatures } from "@/components/agreements/AdminSignatures";
import { MembershipStatusBadge } from "@/components/admin/MembershipInbox";

export const Route = createFileRoute("/_authenticated/admin/companies/$companyId")({
  head: () => ({ meta: [{ title: "Company dossier — BRQ+ Admin" }] }),
  component: () => <AdminErrorBoundary><Dossier /></AdminErrorBoundary>,
  errorComponent: ({ error }) => isForbiddenError(error) ? <AccessDenied /> : <div role="alert" className="py-12 text-destructive">{(error as Error).message}</div>,
  notFoundComponent: () => <div className="py-12 text-muted-foreground">Company not found.</div>,
});

function Dossier() {
  const { companyId } = Route.useParams();
  const qc = useQueryClient();
  const fetchFn = useServerFn(adminGetCompanyDossier);
  const statusFn = useServerFn(adminSetCompanyStatus);
  const key = ["company-dossier", companyId];
  const q = useQuery({ queryKey: key, queryFn: () => fetchFn({ data: { companyId } }), retry: false });
  const st = useMutation({ mutationFn: (status: any) => statusFn({ data: { companyId, status } }), onSuccess: () => qc.invalidateQueries({ queryKey: key }) });
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (q.isError) return isForbiddenError(q.error) ? <AccessDenied /> : <p className="text-destructive">{(q.error as Error).message}</p>;
  if (!q.data || q.data.notFound) return <p className="text-muted-foreground">Company not found.</p>;
  const d = q.data; const c = d.company;
  return <div className="space-y-6">
    <Link to="/admin/companies" className="text-xs text-muted-foreground hover:text-gold">← Companies</Link>
    <header className="flex items-center gap-4">
      {d.logo_url && <img src={d.logo_url} alt="" className="h-14 w-14 rounded-md border border-border object-contain" />}
      <div><p className="text-xs font-semibold uppercase tracking-wider text-gold">Company dossier</p><h1 className="mt-1 font-display text-3xl font-bold text-foreground">{c.legal_name}</h1></div>
    </header>
    <AdminMembershipBilling companyId={c.id} />
    <Panel title="Status controls">
      <label className="flex items-center gap-2 text-sm">Membership
        <select value={c.membership_status} disabled={st.isPending} onChange={e => st.mutate(e.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground">
          {["pending", "active", "suspended"].map(s => <option key={s}>{s}</option>)}
        </select>
      </label>
    </Panel>
    <Panel title="Company details">
      <Facts items={[["Trading name", c.trading_name], ["Registration number", c.registration_no], ["Country", c.country], ["HQ city", c.hq_city], ["Website", c.website], ["Sector", c.sector], ["Size", c.size_band], ["Year founded", c.year_founded], ["Markets", c.markets], ["Interests", c.interests], ["Billing contact", c.billing_contact_name], ["Billing email", c.billing_contact_email], ["Description", c.description]]} />
    </Panel>
    <Panel title={`Members (${d.members.length})`}>
      <ul className="space-y-2 text-sm">{d.members.map((m: any) => <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-2">
        <Link to="/admin/members/$userId" params={{ userId: m.user_id }} className="text-foreground hover:text-gold">{m.profiles?.full_name ?? m.user_id}</Link>
        <span className="text-xs text-muted-foreground">{m.role === "admin" ? "Company Admin" : "Member"} · {m.profiles?.membership_status}</span>
      </li>)}</ul>
    </Panel>
    <Panel title="Application history">
      <ul className="space-y-2 text-sm">{d.applications.length === 0 ? <li className="text-muted-foreground">None.</li> : d.applications.map((a: any) => <li key={a.id} className="flex items-center gap-3"><span className="font-mono text-xs text-gold">{a.reference}</span><MembershipStatusBadge status={a.status} /><span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</span></li>)}</ul>
    </Panel>
    <AdminSignatures filter={{ companyId }} />
    <NotesPanel subjectType="company" subjectId={companyId} notes={d.notes} onAdded={() => qc.invalidateQueries({ queryKey: key })} />
    <AuditList rows={d.audit} />
  </div>;
}
