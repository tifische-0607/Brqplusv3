import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminGetMemberDossier, adminUpdateMember } from "@/lib/membership.functions";
import { AdminErrorBoundary } from "@/components/admin-error-boundary";
import { AccessDenied } from "@/components/access-denied";
import { isForbiddenError } from "@/lib/authz-error";
import { AuditList, Facts, NotesPanel, Panel } from "@/components/admin/DossierParts";
import { AdminMembershipBilling } from "@/components/billing/MembershipBilling";
import { AdminSignatures } from "@/components/agreements/AdminSignatures";
import { MembershipStatusBadge } from "@/components/admin/MembershipInbox";

export const Route = createFileRoute("/_authenticated/admin/members/$userId")({
  head: () => ({ meta: [{ title: "Member dossier — BRQ+ Admin" }] }),
  component: () => <AdminErrorBoundary><Dossier /></AdminErrorBoundary>,
  errorComponent: ({ error }) => isForbiddenError(error) ? <AccessDenied /> : <div role="alert" className="py-12 text-destructive">{(error as Error).message}</div>,
  notFoundComponent: () => <div className="py-12 text-muted-foreground">Member not found.</div>,
});

function Dossier() {
  const { userId } = Route.useParams();
  const qc = useQueryClient();
  const fetchFn = useServerFn(adminGetMemberDossier);
  const updateFn = useServerFn(adminUpdateMember);
  const key = ["member-dossier", userId];
  const q = useQuery({ queryKey: key, queryFn: () => fetchFn({ data: { userId } }), retry: false });
  const upd = useMutation({ mutationFn: (v: any) => updateFn({ data: { userId, ...v } }), onSuccess: () => qc.invalidateQueries({ queryKey: key }) });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (q.isError) return isForbiddenError(q.error) ? <AccessDenied /> : <p className="text-destructive">{(q.error as Error).message}</p>;
  if (!q.data || q.data.notFound) return <p className="text-muted-foreground">Member not found.</p>;
  const d = q.data; const p = d.profile;
  const sel = "rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";

  return <div className="space-y-6">
    <Link to="/admin/users" className="text-xs text-muted-foreground hover:text-gold">← Portal users</Link>
    <header>
      <p className="text-xs font-semibold uppercase tracking-wider text-gold">Member dossier</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-foreground">{p.full_name ?? d.email}</h1>
      <p className="mt-1 text-sm text-cyan">{d.email}</p>
      <p className="mt-2 text-xs text-muted-foreground">{p.member_type ? "Personal" : "Legacy member"}{p.companies ? ` · Corporate · ${p.companies.trading_name || p.companies.legal_name}` : ""} · Roles: {d.roles.join(", ") || "none"}</p>
    </header>
    {!p.company_id && <AdminMembershipBilling userId={userId} />}
    <Panel title="Status controls">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">Membership
          <select className={sel} value={p.membership_status} disabled={upd.isPending} onChange={e => upd.mutate({ membership_status: e.target.value })}>
            {["pending", "active", "suspended"].map(s => <option key={s}>{s}</option>)}
          </select></label>
        <label className="flex items-center gap-2">The Collective
          <select className={sel} value={p.collective_status} disabled={upd.isPending} onChange={e => upd.mutate({ collective_status: e.target.value })}>
            {["none", "applied", "approved"].map(s => <option key={s}>{s}</option>)}
          </select></label>
        <span className="text-xs text-muted-foreground">Onboarded: {p.is_onboarded ? "yes" : "no"} · Member since {p.membership_since ? new Date(p.membership_since).toLocaleDateString() : "—"}</span>
      </div>
      {upd.isError && <p className="mt-2 text-sm text-destructive">{(upd.error as Error).message}</p>}
    </Panel>
    <Panel title="Profile">
      <Facts items={[["Job title", p.job_title], ["Organisation", p.organisation], ["Country", p.country], ["City", p.city], ["Sector", p.sector], ["Phone", p.phone], ["LinkedIn", p.linkedin_url], ["Years of experience", p.years_experience], ["Expertise", p.expertise], ["Languages", p.languages], ["Program interests", p.program_interests], ["Bio", p.bio], ["Last sign-in", d.last_sign_in_at ? new Date(d.last_sign_in_at).toLocaleString() : null]]} />
    </Panel>
    <Panel title="Company link">
      {p.companies ? <p className="text-sm"><Link to="/admin/companies/$companyId" params={{ companyId: p.companies.id }} className="text-cyan hover:underline">{p.companies.legal_name}</Link> <span className="text-muted-foreground">· {p.company_role === "admin" ? "Company Admin" : "Member"}</span></p> : <p className="text-sm text-muted-foreground">Not linked to a company.</p>}
      {d.executive && <p className="mt-2 text-sm text-muted-foreground">Collective directory entry: {d.executive.role} · {d.executive.availability}</p>}
    </Panel>
    <Panel title="Application history">
      <ul className="space-y-2 text-sm">
        {d.applications.map((a: any) => <li key={a.id} className="flex flex-wrap items-center gap-3"><span className="font-mono text-xs text-gold">{a.reference}</span><span className="capitalize">{a.type}</span><MembershipStatusBadge status={a.status} /><span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</span></li>)}
        {d.legacy_applications.map((a: any) => <li key={a.id} className="flex flex-wrap items-center gap-3"><span className="font-mono text-xs text-gold">{a.reference}</span><span>Legacy Collective</span><span className="text-xs text-muted-foreground">{a.status} · {new Date(a.created_at).toLocaleDateString()}</span></li>)}
        {!d.applications.length && !d.legacy_applications.length && <li className="text-muted-foreground">No applications on record.</li>}
      </ul>
    </Panel>
    <AdminSignatures filter={{ userId }} />
    <NotesPanel subjectType="user" subjectId={userId} notes={d.notes} onAdded={() => qc.invalidateQueries({ queryKey: key })} />
    <AuditList rows={d.audit} />
  </div>;
}
