import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listPublishedInsights, type InsightSummary } from "@/lib/insights.functions";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({ meta: [{ title: "Insights — BRQ+" }] }),
  component: InsightsPage,
});

function formatDate(iso: string | null) {
  if (!iso) return "Draft";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function InsightCard({ i }: { i: InsightSummary }) {
  return (
    <Link
      to="/insights/$slug"
      params={{ slug: i.slug }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-gold/60"
    >
      <div className="relative aspect-[16/9] bg-gradient-to-br from-cyan/10 via-card to-gold/10">
        {i.cover_image_url ? (
          <img src={i.cover_image_url} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center font-display text-3xl font-extrabold text-gold/40">
            BRQ+
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        {i.domain && (
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gold">{i.domain}</p>
        )}
        <h3 className="mt-2 font-display text-lg font-semibold text-foreground group-hover:text-gold">
          {i.title}
        </h3>
        {i.excerpt && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{i.excerpt}</p>}
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
          <span>{i.author?.full_name ?? "BRQ+ Collective"}</span>
          <span>{formatDate(i.published_at)}</span>
        </div>
      </div>
    </Link>
  );
}

function InsightsPage() {
  const fetchInsights = useServerFn(listPublishedInsights);
  const q = useQuery({ queryKey: ["insights-published"], queryFn: () => fetchInsights() });
  const [search, setSearch] = useState("");
  const [domain, setDomain] = useState<string>("all");

  const domains = useMemo(() => {
    const set = new Set<string>();
    (q.data?.insights ?? []).forEach((i) => i.domain && set.add(i.domain));
    return Array.from(set).sort();
  }, [q.data]);

  const filtered = useMemo(() => {
    let rows = q.data?.insights ?? [];
    if (domain !== "all") rows = rows.filter((r) => r.domain === domain);
    if (search.trim()) {
      const s = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.title.toLowerCase().includes(s) ||
          (r.excerpt ?? "").toLowerCase().includes(s) ||
          (r.author?.full_name ?? "").toLowerCase().includes(s),
      );
    }
    return rows;
  }, [q.data, search, domain]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gold">Library</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-foreground">INSIGHTS</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Thought leadership from the BRQ+ Collective — members only.
          </p>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title, excerpt, author…"
          className="w-full max-w-sm rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-cyan/60 focus:outline-none"
        />
        <select
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-cyan/60 focus:outline-none"
        >
          <option value="all">All domains</option>
          {domains.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {q.isLoading && (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-72 animate-pulse rounded-2xl border border-border bg-card/40" />
          ))}
        </div>
      )}

      {q.isError && (
        <div className="mt-10 rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
          Failed to load insights: {q.error instanceof Error ? q.error.message : "Unknown error"}
        </div>
      )}

      {q.data && filtered.length === 0 && (
        <div className="mt-16 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 p-16 text-center">
          <span className="font-display text-2xl font-extrabold text-gold/60">BRQ+</span>
          <h2 className="mt-4 font-display text-lg font-medium text-foreground">No insights yet</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            The library is empty — when collective members publish thought leadership, it appears here.
          </p>
        </div>
      )}

      {q.data && filtered.length > 0 && (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((i) => (
            <InsightCard key={i.id} i={i} />
          ))}
        </div>
      )}
    </div>
  );
}
