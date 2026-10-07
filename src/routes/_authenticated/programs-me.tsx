import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMyPrograms } from "@/lib/portal.functions";
import { Empty, ErrorNote, PageIntro, Panel, Pill, SkeletonRows, fmtDate, linkGold } from "@/components/members/portal-ui";
import { workstreamLabels } from "@/lib/tgn-workstreams";

export const Route = createFileRoute("/_authenticated/programs-me")({
  head: () => ({ meta: [{ title: "My Programs — BRQ+ Members" }] }),
  component: MyProgramsPage,
});

const workstreamLabel = (code: string) => workstreamLabels[code] ?? `Workstream ${code}`;

function MyProgramsPage() {
  const fn = useServerFn(getMyPrograms);
  const q = useQuery({ queryKey: ["my-programs"], queryFn: () => fn() });
  const d = q.data;
  return (
    <div>
      <PageIntro eyebrow="Programs" title="My programs">Your status across BRQ+ programs.</PageIntro>
      {q.isLoading ? <SkeletonRows rows={5} /> : q.isError ? <ErrorNote error={q.error} /> : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Panel title="The Collective @ BRQ+">
            {d!.collective_status === "approved" ? (
              <><Pill status="approved" label="Member" /><p className="mt-3 text-sm text-muted-foreground">You are part of The Collective. Keep your Collective profile current from My Profile.</p>
                <Link to="/profile" search={{ tab: "collective" }} className={`mt-3 inline-block ${linkGold}`}>Collective profile →</Link></>
            ) : d!.collective.length || d!.collective_status === "applied" ? (
              <><Pill status="pending" label="Applicant" />
                <ul className="mt-3 space-y-1 text-xs text-muted-foreground">{d!.collective.map((c: any) => <li key={c.reference}>{c.reference} · {fmtDate(c.created_at)} · <span className="capitalize">{c.status}</span></li>)}</ul></>
            ) : (
              <><Pill status="none" label="Not applied" /><p className="mt-3 text-sm text-muted-foreground">An invitation-only collective of fractional executives.</p>
                <Link to="/collective" className={`mt-3 inline-block ${linkGold}`}>Learn more & apply →</Link></>
            )}
          </Panel>
          <Panel title="Founders @ BRQ+">
            {d!.founders.length ? (
              <ul className="space-y-3 text-sm">{d!.founders.map((f: any) => (
                <li key={f.reference}><p className="text-foreground">{f.company_name}</p><p className="text-xs text-muted-foreground">{f.reference} · {f.stage} · {fmtDate(f.created_at)}</p><div className="mt-1"><Pill status="pending" label="Received" /></div></li>
              ))}</ul>
            ) : <Empty cta={<Link to="/programs/founders" className={linkGold}>Apply →</Link>}>No Founders applications yet.</Empty>}
          </Panel>
          <Panel title="The Give Network">
            {d!.tgn.length ? (
              <ul className="space-y-3 text-sm">{d!.tgn.map((t: any) => (
                <li key={t.reference}><p className="text-xs text-muted-foreground">{t.reference} · {fmtDate(t.created_at)}</p>
                  <ul className="mt-1 space-y-0.5">{(t.models ?? []).map((m: string) => <li key={m} className="text-foreground">{workstreamLabel(m)}</li>)}</ul></li>
              ))}</ul>
            ) : <Empty>No interests registered yet.</Empty>}
            {d!.rsvps.length > 0 && <div className="mt-4 border-t border-border pt-3"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">RSVPs</p>
              <ul className="mt-2 space-y-1 text-xs text-foreground">{d!.rsvps.map((r: any, i: number) => <li key={i}>{fmtDate(r.created_at)} · attending as {r.attending_as}</li>)}</ul></div>}
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-3">
              <Link to="/programs/give-network" className={linkGold}>Overview</Link>
               <Link to="/programs/give-network/remote-advisory" aria-label="Workstream A: Remote Advisory and Project Contribution" className={linkGold}>A</Link>
               <Link to="/programs/give-network/back2basics" aria-label="Workstream B: Back2Basics Accelerator for Founders" className={linkGold}>B</Link>
               <Link to="/programs/give-network/missions" aria-label="Workstream C: Trade and Impact Missions and Exploration" className={linkGold}>C</Link>
               <Link to="/programs/give-network/immersion" aria-label="Workstream D: Employment Immersion" className={linkGold}>D</Link>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
