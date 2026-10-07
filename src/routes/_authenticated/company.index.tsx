import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getCompanyHome } from "@/lib/portal.functions";
import { listLatestAnnouncements } from "@/lib/insights.functions";
import { MyMembershipBilling } from "@/components/billing/MembershipBilling";
import { CompanyGate } from "@/components/members/CompanyGate";
import { ActionCards } from "@/components/members/ActionCards";
import { Empty, ErrorNote, Panel, Pill, SkeletonRows, fmtDate, linkGold } from "@/components/members/portal-ui";

export const Route = createFileRoute("/_authenticated/company/")({
  head: () => ({ meta: [{ title: "Company Home — BRQ+ Members" }] }),
  component: () => <CompanyGate><CompanyHome /></CompanyGate>,
});

const ACTIVITY: Record<string, string> = {
  company_invite: "Colleague invited", company_invite_resend: "Invitation resent", company_remove: "Member removed",
  company_admin_transfer: "Company Admin transferred", approve: "Membership approved", approved: "Membership approved",
};

function CompanyHome() {
  const fn = useServerFn(getCompanyHome);
  const q = useQuery({ queryKey: ["company-home"], queryFn: () => fn() });
  const annFn = useServerFn(listLatestAnnouncements);
  const ann = useQuery({ queryKey: ["latest-announcements"], queryFn: () => annFn({ data: { limit: 3 } }) });
  if (q.isLoading) return <SkeletonRows rows={6} />;
  if (q.isError) return <ErrorNote error={q.error} />;
  const d = q.data!;
  const c = d.company;
  const stats = [
    ["Team members", d.stats.team], ["Active engagements", d.stats.active_engagements], ["NDAs executed", d.stats.ndas_executed], ["Program interests", d.stats.programs],
  ] as const;
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-4">
        {d.logo_url ? <img src={d.logo_url} alt={`${c.legal_name} logo`} className="h-16 w-16 rounded-lg border border-border bg-background object-contain" /> :
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-gold/40 bg-gold/10 font-display text-xl font-bold text-gold">{(c.trading_name || c.legal_name).slice(0, 2).toUpperCase()}</div>}
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gold">Corporate member · {d.my_role === "admin" ? "Company Admin" : "Company User"}</p>
          <h2 className="mt-1 font-display text-2xl font-bold text-foreground md:text-3xl">{c.trading_name || c.legal_name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {c.sector && <span>{c.sector}</span>}<Pill status={c.membership_status === "active" ? "active" : c.membership_status} /><span>Member since {fmtDate(c.membership_since)}</span>
          </div>
        </div>
      </header>
      <MyMembershipBilling scope="company" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(([k, v]) => <div key={k} className="rounded-xl border border-border bg-card p-4"><p className="font-display text-2xl font-bold text-foreground">{v}</p><p className="text-xs text-muted-foreground">{k}</p></div>)}
      </div>
      <ActionCards />
      {d.pending.length > 0 && (
        <Panel title="Company documents to sign">
          <ul className="space-y-2 text-sm">{d.pending.map((p: any) => <li key={p.party_id} className="flex justify-between gap-2"><span className="text-foreground">Engagement NDA · {p.mission_title}</span><span className="text-xs text-gold">Awaiting company signatory</span></li>)}</ul>
        </Panel>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Key contacts">
          {!d.contacts.length ? <Empty>No Company Admin assigned yet.</Empty> : (
            <ul className="space-y-2 text-sm">{d.contacts.map((k: any, i: number) => <li key={i}><p className="text-foreground">{k.name ?? "Company Admin"}</p><p className="text-xs text-muted-foreground">{k.title ?? "Company Admin"}</p></li>)}</ul>
          )}
          {c.billing_contact_name && <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">Billing: <span className="text-foreground">{c.billing_contact_name}</span></p>}
          <Link to="/company/profile" className={`mt-3 inline-block ${linkGold}`}>Company profile →</Link>
        </Panel>
        <Panel title="Recent activity">
          {!d.activity.length ? <Empty>No recent activity.</Empty> : (
            <ul className="space-y-2 text-sm">{d.activity.map((a: any, i: number) => <li key={i} className="flex justify-between gap-2"><span className="text-foreground">{ACTIVITY[a.action] ?? a.action.replace(/_/g, " ")}</span><span className="text-xs text-muted-foreground">{fmtDate(a.created_at)}</span></li>)}</ul>
          )}
        </Panel>
        <Panel title="Announcements">
          {ann.isLoading ? <SkeletonRows rows={2} /> : !ann.data?.announcements.length ? <Empty>No announcements yet.</Empty> : (
             <ul className="space-y-3">{ann.data.announcements.map((a: any) => <li key={a.id}><h4 className="text-sm font-semibold text-foreground">{a.title}</h4><p className="line-clamp-2 text-xs text-muted-foreground">{a.body}</p></li>)}</ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
