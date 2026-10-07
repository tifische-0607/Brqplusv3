import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getAdminKpis } from "@/lib/admin-stats.functions";
import { getMembershipKpis } from "@/lib/membership.functions";
import { getAdminQueueKpis } from "@/lib/admin-queues.functions";
import { getBillingKpis } from "@/lib/membership-billing.functions";
import { AccessDenied } from "@/components/access-denied";
import { AdminErrorBoundary } from "@/components/admin-error-boundary";
import { isForbiddenError } from "@/lib/authz-error";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin — BRQ+" }] }),
  component: () => (
    <AdminErrorBoundary>
      <AdminHome />
    </AdminErrorBoundary>
  ),
  errorComponent: ({ error }) =>
    isForbiddenError(error) ? <AccessDenied /> : (
      <div role="alert" className="px-5 py-12 text-destructive">Failed to load: {(error as Error).message}</div>
    ),
  notFoundComponent: () => <div className="px-5 py-12 text-muted-foreground">Page not found.</div>,
});

type KpiProps = { label: string; value: number | string; sub?: string; accent?: "gold" | "cyan" | "default"; to?: string; search?: Record<string, string> };

function Kpi({ label, value, sub, accent, to, search }: KpiProps) {
  const tone = accent === "gold" ? "text-gold" : accent === "cyan" ? "text-cyan" : "text-foreground";
  const body = (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-2 font-display text-3xl font-bold ${tone}`}>{value}</p>
      {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
      {to ? <p className="mt-3 text-xs font-semibold text-gold opacity-80 group-hover:opacity-100">Open queue →</p> : null}
    </>
  );
  if (!to) return <div className="rounded-2xl border border-border bg-card p-5">{body}</div>;
  return (
    <Link
      to={to}
      search={search as never}
      aria-label={`Open ${label} queue`}
      className="group block rounded-2xl border border-border bg-card p-5 transition-colors hover:border-gold/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
    >
      {body}
    </Link>
  );
}

const QUICK_LINKS = [
  { to: "/admin/programs", label: "Programs", desc: "TGN interests and RSVPs" },
  { to: "/admin/applications", label: "Membership Applications", desc: "Personal, corporate and legacy Collective" },
  { to: "/admin/companies", label: "Companies", desc: "Corporate member dossiers" },
  { to: "/admin/missions", label: "Missions", desc: "Manage mandates and assignments" },
  { to: "/admin/leads", label: "Leads", desc: "Sales pipeline" },
  { to: "/admin/users", label: "Portal Users", desc: "Roles and access" },
  { to: "/admin/insights", label: "Insights", desc: "Publish thought leadership" },
  { to: "/admin/announcements", label: "Announcements", desc: "Broadcast to members" },
  { to: "/admin/agreements", label: "Agreements", desc: "Versions, e-signatures & coverage" },
  { to: "/admin/documents", label: "Documents", desc: "Engagement NDAs & signed PDFs" },
  { to: "/admin/onboarding", label: "Onboarding", desc: "Agreements & invites" },
  { to: "/admin/billing", label: "Billing", desc: "Membership invoices & payments" },
  { to: "/admin/pricing", label: "Pricing", desc: "Membership plans & SST" },
  { to: "/admin/requests", label: "Requests", desc: "Account deletion requests" },
  { to: "/admin/audit", label: "Audit", desc: "Role changes & sensitive events" },
] as const;

function MembershipKpis() {
  const fetchFn = useServerFn(getMembershipKpis);
  const q = useQuery({ queryKey: ["membership-kpis"], queryFn: () => fetchFn(), retry: false });
  if (!q.data) return null;
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Kpi label="Pending personal applications" value={q.data.pending_personal} accent="gold" to="/admin/applications" search={{ tab: "personal", status: "pending" }} />
      <Kpi label="Pending corporate applications" value={q.data.pending_corporate} accent="gold" to="/admin/applications" search={{ tab: "corporate", status: "pending" }} />
      <Kpi label="Active personal members" value={q.data.active_personal} accent="cyan" to="/admin/users" search={{ type: "personal", status: "active" }} />
      <Kpi label="Active companies" value={q.data.active_companies} accent="cyan" to="/admin/companies" search={{ status: "active" }} />
    </section>
  );
}

function ReviewButton() {
  const fetchFn = useServerFn(getMembershipKpis);
  const q = useQuery({ queryKey: ["membership-kpis"], queryFn: () => fetchFn(), retry: false });
  const n = (q.data?.pending_personal ?? 0) + (q.data?.pending_corporate ?? 0);
  if (!n) return null;
  return (
    <Link to="/admin/applications" search={{ status: "pending" } as never} className="inline-flex min-h-11 items-center rounded-md bg-gold px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background">
      Review applications ({n})
    </Link>
  );
}

function QueueKpis() {
  const fn = useServerFn(getAdminQueueKpis);
  const q = useQuery({ queryKey: ["admin-queue-kpis"], queryFn: () => fn(), retry: false });
  if (!q.data) return null;
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Kpi label="Documents awaiting signature" value={q.data.docs_pending} sub="Unsigned NDA parties + current agreement" accent="gold" to="/admin/documents" search={{ status: "pending" }} />
      <Kpi label="Account deletion requests" value={q.data.deletion_open} sub="Open requests" to="/admin/requests" search={{ status: "open" }} />
      <Kpi label="Program sign-ups (7 days)" value={q.data.program_signups_7d} sub="TGN interests, RSVPs & founders" accent="cyan" to="/admin/programs" search={{ range: "7d" }} />
    </section>
  );
}

function BillingKpis() {
  const fn = useServerFn(getBillingKpis);
  const q = useQuery({ queryKey: ["billing-kpis"], queryFn: () => fn(), retry: false });
  if (!q.data) return null;
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Kpi label="Invoices awaiting payment" value={q.data.awaiting} sub="Issued + overdue" accent="gold" to="/admin/billing" search={{ status: "awaiting" }} />
      <Kpi label="Overdue invoices" value={q.data.overdue} sub="Past due date" to="/admin/billing" search={{ status: "overdue" }} />
      <Kpi label="MRR estimate" value={`RM ${q.data.mrr.toLocaleString("en-MY")}`} sub="Active memberships, annual ÷ 12" accent="cyan" to="/admin/billing" search={{ status: "paid" }} />
    </section>
  );
}

function AdminHome() {
  const fetchKpis = useServerFn(getAdminKpis);
  const q = useQuery({ queryKey: ["admin-kpis"], queryFn: () => fetchKpis(), retry: false });

  return (
    <div className="space-y-10">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-gold">Admin</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-foreground">Operations dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Real-time signal across membership, mandates, and content.</p>
      </header>

      <ReviewButton />

      <MembershipKpis />

      <QueueKpis />

      <BillingKpis />

      {q.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl border border-border bg-card/40" />
          ))}
        </div>
      ) : q.isError ? (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-5 text-sm text-destructive">
          Could not load KPIs: {q.error instanceof Error ? q.error.message : "unknown error"}
        </div>
      ) : q.data ? (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Members" value={q.data.members_total} sub={`${q.data.members_onboarded} fully onboarded`} accent="gold" to="/admin/users" />
          <Kpi label="Active Mandates" value={q.data.missions_active} sub={`${q.data.missions_total} total · ${q.data.missions_in_review} in review`} accent="cyan" to="/admin/missions" search={{ status: "active" }} />
          <Kpi label="Applications" value={q.data.applications_total} sub={`${q.data.applications_new_30d} new (30d)`} accent="gold" to="/admin/applications" search={{ status: "all" }} />
          <Kpi label="Open Leads" value={q.data.leads_open} sub="Awaiting follow-up" to="/admin/leads" search={{ status: "open" }} />
          <Kpi label="Insights Published" value={q.data.insights_published} sub={`${q.data.insights_drafts} drafts`} to="/admin/insights" search={{ status: "published" }} />
          <Kpi label="Completed Mandates" value={q.data.missions_completed} to="/admin/missions" search={{ status: "completed" }} />
        </section>
      ) : null}

      <section>
        <h2 className="font-display text-lg font-semibold text-foreground">Quick links</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="group rounded-xl border border-border bg-card p-4 transition-colors hover:border-cyan/60"
            >
              <p className="font-display text-sm font-semibold text-foreground group-hover:text-cyan">{l.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{l.desc}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
