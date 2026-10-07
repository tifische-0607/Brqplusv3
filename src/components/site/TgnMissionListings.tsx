import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { listPublicMissions } from "@/lib/tgn-missions.functions";
import { workstreamLabels } from "@/lib/tgn-workstreams";
import { SectionTitle } from "@/components/site/SectionTitle";

export function TgnMissionListings() {
  const fn = useServerFn(listPublicMissions);
  const q = useQuery({ queryKey: ["tgn-public-missions"], queryFn: () => fn() });
  const rows = q.data ?? [];
  return (
    <section id="missions-board" className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
      <SectionTitle eyebrow="Mission board" title="Missions listed by our corporate members" description="Opportunities posted by BRQ+ corporate members and reviewed by BRQ+ before publishing." />
      {q.isLoading ? <p className="mt-10 text-sm text-muted-foreground">Loading missions…</p> : rows.length === 0 ? (
        <p className="mt-10 rounded-md border border-border p-6 text-sm text-muted-foreground">No missions are listed right now. Corporate members can list a mission from their portal.</p>
      ) : (
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {rows.map((m) => (
            <article key={m.id} className="rounded-md border border-border bg-card p-7">
              <span className="font-mono text-xs text-gold">{workstreamLabels[m.workstream] ?? m.workstream}</span>
              <h3 className="font-display mt-4 text-xl font-bold">{m.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{m.company_name}</p>
              {(m.location || m.commitment) && <p className="mt-4 text-sm font-semibold text-foreground">{[m.location, m.commitment].filter(Boolean).join(" · ")}</p>}
              <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{m.summary}</p>
              <a href={`mailto:${m.contact_email}`} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-gold hover:underline"><Mail size={16} /> {m.contact_email}</a>
            </article>
          ))}
        </div>
      )}
      <p className="mt-8 text-sm text-muted-foreground">Are you a corporate member? <Link to="/company/programs" className="font-semibold text-gold hover:underline">List a mission →</Link></p>
    </section>
  );
}
