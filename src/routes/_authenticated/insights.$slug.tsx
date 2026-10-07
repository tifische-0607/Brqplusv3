import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getInsightBySlug } from "@/lib/insights.functions";

export const Route = createFileRoute("/_authenticated/insights/$slug")({
  head: () => ({ meta: [{ title: "Insight — BRQ+" }] }),
  component: InsightDetailPage,
});

function formatDate(iso: string | null) {
  if (!iso) return "Draft";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

// Minimal markdown rendering: headers, bold, links, lists, paragraphs, code.
// Keeps deps zero. Escapes HTML first.
function renderMarkdown(md: string): string {
  const esc = md.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
  return esc
    .replace(/^### (.*)$/gm, '<h3 class="mt-8 mb-3 font-display text-xl font-semibold text-foreground">$1</h3>')
    .replace(/^## (.*)$/gm, '<h2 class="mt-10 mb-3 font-display text-2xl font-bold text-foreground">$1</h2>')
    .replace(/^# (.*)$/gm, '<h1 class="mt-10 mb-4 font-display text-3xl font-extrabold text-foreground">$1</h1>')
    .replace(/`([^`]+)`/g, '<code class="rounded bg-muted px-1.5 py-0.5 text-xs">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-cyan underline hover:text-gold" target="_blank" rel="noreferrer">$1</a>')
    .replace(/^(?:- |\* )(.*)$/gm, '<li class="ml-6 list-disc">$1</li>')
    .split(/\n{2,}/)
    .map((block) => (block.startsWith("<h") || block.startsWith("<li") ? block : `<p class="mb-4 leading-relaxed text-muted-foreground">${block.replace(/\n/g, "<br/>")}</p>`))
    .join("\n");
}

function InsightDetailPage() {
  const { slug } = useParams({ from: "/_authenticated/insights/$slug" });
  const fetchIt = useServerFn(getInsightBySlug);
  const q = useQuery({ queryKey: ["insight", slug], queryFn: () => fetchIt({ data: { slug } }) });

  if (q.isLoading) {
    return <div className="mx-auto h-96 max-w-3xl animate-pulse rounded-2xl border border-border bg-card/40" />;
  }
  if (q.isError) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
        Failed to load: {q.error instanceof Error ? q.error.message : "Unknown error"}
      </div>
    );
  }

  const insight = q.data?.insight;
  if (!insight) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-foreground">Insight not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">It may have been unpublished or removed.</p>
        <Link to="/insights" className="mt-6 inline-block rounded-md bg-gold px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground">
          ← Back to Insights
        </Link>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-3xl">
      <Link to="/insights" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-gold">
        ← Back to Insights
      </Link>

      {insight.domain && (
        <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-gold">{insight.domain}</p>
      )}
      <h1 className="mt-2 font-display text-4xl font-extrabold leading-tight text-foreground">{insight.title}</h1>
      <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
        <span>{insight.author?.full_name ?? "BRQ+ Collective"}</span>
        <span>·</span>
        <span>{formatDate(insight.published_at)}</span>
      </div>

      {insight.cover_image_url && (
        <img
          src={insight.cover_image_url}
          alt=""
          className="mt-8 aspect-[16/9] w-full rounded-2xl border border-border object-cover"
        />
      )}

      <div
        className="prose prose-invert mt-10 max-w-none"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(insight.content || "") }}
      />

      {q.data?.related && q.data.related.length > 0 && (
        <section className="mt-16 border-t border-border pt-10">
          <p className="text-xs font-semibold uppercase tracking-wider text-gold">Related</p>
          <h2 className="mt-2 font-display text-xl font-semibold text-foreground">More in {insight.domain}</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {q.data.related.map((r) => (
              <Link
                key={r.id}
                to="/insights/$slug"
                params={{ slug: r.slug }}
                className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-gold/60"
              >
                <h3 className="font-display text-sm font-semibold text-foreground">{r.title}</h3>
                {r.excerpt && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.excerpt}</p>}
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
