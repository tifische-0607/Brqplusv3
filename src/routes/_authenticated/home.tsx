import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle } from "lucide-react";
import { getMyEngagements, getMyProfileFull, getMyPrograms } from "@/lib/portal.functions";
import { ActionCards } from "@/components/members/ActionCards";
import { listLatestAnnouncements, listPublishedInsights } from "@/lib/insights.functions";
import { usePortalContext } from "@/components/members/MembersLayout";
import { EngagementsList, Empty, ErrorNote, Panel, Pill, SkeletonRows, fmtDate, linkGold, type Engagement } from "@/components/members/portal-ui";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "Home — BRQ+ Members" }, { name: "description", content: "Your BRQ+ member home." }] }),
  component: HomePage,
});

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function HomePage() {
  const ctx = usePortalContext();
  const first = ctx.data?.full_name?.split(" ")[0];
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-gold">Personal member</p>
        <h2 className="mt-1 font-display text-2xl font-bold text-foreground md:text-3xl">{greeting()}{first ? `, ${first}` : ""}.</h2>
      </div>
      <ActionCards />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ActiveEngagements />
          <MyProgramsSummary />
        </div>
        <div className="space-y-6">
          <ProfileCompleteness />
          <Announcements />
          <LatestInsights />
        </div>
      </div>
    </div>
  );
}

function ProfileCompleteness() {
  const fn = useServerFn(getMyProfileFull);
  const q = useQuery({ queryKey: ["my-profile-full"], queryFn: () => fn() });
  return (
    <Panel title="Your profile">
      {q.isLoading ? <SkeletonRows rows={4} /> : q.isError ? <ErrorNote error={q.error} /> : (
        <>
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuenow={q.data!.completeness} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completeness">
              <div className="h-full bg-gold" style={{ width: `${q.data!.completeness}%` }} />
            </div>
            <span className="text-sm font-semibold text-foreground">{q.data!.completeness}%</span>
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {q.data!.checklist.map((c) => (
              <li key={c.key} className="flex items-center gap-2">
                {c.done ? <CheckCircle2 className="h-4 w-4 text-cyan" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                <span className={c.done ? "text-muted-foreground line-through" : "text-foreground"}>{c.label}</span>
              </li>
            ))}
          </ul>
          {q.data!.completeness < 100 && <Link to="/profile" search={{ tab: "edit" }} className={`mt-4 inline-block ${linkGold}`}>Complete your profile →</Link>}
        </>
      )}
    </Panel>
  );
}

function ActiveEngagements() {
  const fn = useServerFn(getMyEngagements);
  const q = useQuery({ queryKey: ["my-engagements"], queryFn: () => fn() });
  const active = (q.data?.engagements ?? []).filter((e: Engagement) => !["completed", "cancelled"].includes(e.status)).slice(0, 3);
  return (
    <Panel title="My active engagements" action={<Link to="/engagements" className={linkGold}>View all →</Link>}>
      {q.isLoading ? <SkeletonRows /> : q.isError ? <ErrorNote error={q.error} /> : <EngagementsList items={active} compact />}
    </Panel>
  );
}

function MyProgramsSummary() {
  const fn = useServerFn(getMyPrograms);
  const q = useQuery({ queryKey: ["my-programs"], queryFn: () => fn() });
  const d = q.data;
  const collective = d?.collective_status === "approved" ? "approved" : d?.collective_status === "applied" || d?.collective?.length ? "pending" : "none";
  return (
    <Panel title="My programs" action={<Link to="/programs-me" className={linkGold}>Details →</Link>}>
      {q.isLoading ? <SkeletonRows /> : q.isError ? <ErrorNote error={q.error} /> : (
        <ul className="grid gap-3 sm:grid-cols-3">
          <li className="rounded-xl border border-border p-4">
            <p className="text-xs text-muted-foreground">The Collective @ BRQ+</p>
            <div className="mt-2"><Pill status={collective} label={collective === "approved" ? "Member" : collective === "pending" ? "Applicant" : "Not applied"} /></div>
          </li>
          <li className="rounded-xl border border-border p-4">
            <p className="text-xs text-muted-foreground">Founders @ BRQ+</p>
            <p className="mt-2 text-sm text-foreground">{d!.founders.length ? `${d!.founders.length} application${d!.founders.length > 1 ? "s" : ""}` : "Not applied"}</p>
          </li>
          <li className="rounded-xl border border-border p-4">
            <p className="text-xs text-muted-foreground">The Give Network</p>
            <p className="mt-2 text-sm text-foreground">{d!.tgn.length} interest{d!.tgn.length === 1 ? "" : "s"} · {d!.rsvps.length} RSVP{d!.rsvps.length === 1 ? "" : "s"}</p>
          </li>
        </ul>
      )}
    </Panel>
  );
}

function Announcements() {
  const fn = useServerFn(listLatestAnnouncements);
  const q = useQuery({ queryKey: ["latest-announcements"], queryFn: () => fn({ data: { limit: 3 } }) });
  return (
    <Panel title="Announcements">
      {q.isLoading ? <SkeletonRows rows={2} /> : !q.data?.announcements.length ? <Empty>No announcements yet.</Empty> : (
        <ul className="space-y-3">
          {q.data.announcements.map((a: any) => (
            <li key={a.id}>
               <h4 className="text-sm font-semibold text-foreground">{a.title}</h4>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{a.body}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{fmtDate(a.published_at)}</p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function LatestInsights() {
  const fn = useServerFn(listPublishedInsights);
  const q = useQuery({ queryKey: ["published-insights"], queryFn: () => fn() });
  const items = (q.data?.insights ?? []).slice(0, 3);
  return (
    <Panel title="Latest insights" action={<Link to="/insights" className={linkGold}>All →</Link>}>
      {q.isLoading ? <SkeletonRows rows={2} /> : !items.length ? <Empty>No insights published yet.</Empty> : (
        <ul className="space-y-3">
          {items.map((i) => (
            <li key={i.id}>
               <h4><Link to="/insights/$slug" params={{ slug: i.slug }} className="rounded-sm text-sm font-semibold text-foreground hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">{i.title}</Link></h4>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{i.domain ?? "Insight"} · {fmtDate(i.published_at)}</p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
