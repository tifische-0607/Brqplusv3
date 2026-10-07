import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getCompanyPrograms } from "@/lib/portal.functions";
import { workstreamLabels } from "@/lib/tgn-workstreams";
import { CompanyMissionListings } from "@/components/members/CompanyMissionListings";
import { CompanyGate } from "@/components/members/CompanyGate";
import { Empty, ErrorNote, PageIntro, Panel, SkeletonRows, btnGold, fmtDate, linkGold } from "@/components/members/portal-ui";

export const Route = createFileRoute("/_authenticated/company/programs")({
  head: () => ({ meta: [{ title: "Programs & Sponsorships — BRQ+ Members" }] }),
  component: () => <CompanyGate><CompanyPrograms /></CompanyGate>,
});

function CompanyPrograms() {
  const fn = useServerFn(getCompanyPrograms);
  const q = useQuery({ queryKey: ["company-programs"], queryFn: () => fn() });
  return (
    <div className="space-y-6">
      <PageIntro eyebrow="Programs & Sponsorships" title="Programs and sponsorships" actions={<Link to="/contact" className={btnGold}>Talk to BRQ+ about sponsorship</Link>}>
        Your company's interests with BRQ+ and your team's participation in BRQ+ programs.
      </PageIntro>
      {q.isLoading ? <SkeletonRows rows={4} /> : q.isError ? <ErrorNote error={q.error} /> : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Interests with BRQ+">
            {!q.data!.interests.length ? <Empty cta={<Link to="/company/profile" className={linkGold}>Update company profile →</Link>}>No interests recorded yet.</Empty> : (
              <div className="flex flex-wrap gap-2">{q.data!.interests.map((i) => <span key={i} className="rounded-full border border-gold/50 px-3 py-1 text-xs text-gold">{i}</span>)}</div>
            )}
          </Panel>
          <div className="lg:col-span-2"><CompanyMissionListings /></div>
          <Panel title="Back2Basics sponsorship">
            <p className="text-sm text-muted-foreground">Sponsor a cohort of young founders through Workstream B of The Give Network.</p>
            <div className="mt-3 flex flex-wrap gap-4"><Link to="/programs/give-network/back2basics" className={linkGold}>About Back2Basics →</Link><Link to="/contact" className={linkGold}>Enquire →</Link></div>
          </Panel>
          <Panel title="The Give Network — team interest">
            {!q.data!.tgn.length ? <Empty>No one on your team has registered interest yet.</Empty> : (
              <ul className="space-y-2 text-sm">{q.data!.tgn.map((t: any) => (
                <li key={t.reference}><p className="text-xs text-muted-foreground">{t.reference} · {fmtDate(t.created_at)}</p><p className="text-foreground">{(t.models ?? []).map((m: string) => workstreamLabels[m] ?? m).join(", ")}</p></li>
              ))}</ul>
            )}
            {q.data!.rsvps.length > 0 && <p className="mt-3 text-xs text-muted-foreground">{q.data!.rsvps.length} event RSVP{q.data!.rsvps.length === 1 ? "" : "s"} from your team.</p>}
          </Panel>
          <Panel title="Founders @ BRQ+">
            {!q.data!.founders.length ? <Empty>No Founders applications from your team.</Empty> : (
              <ul className="space-y-2 text-sm">{q.data!.founders.map((f: any) => <li key={f.reference} className="text-foreground">{f.company_name} <span className="text-xs text-muted-foreground">· {f.stage} · {fmtDate(f.created_at)}</span></li>)}</ul>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
