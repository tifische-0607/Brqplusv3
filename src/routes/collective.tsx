import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { MeshBackground } from "../components/site/MeshBackground";
import { listExecutivesPublic, type PublicExecutive } from "@/lib/executives.functions";

const executivesQueryOptions = queryOptions({
  queryKey: ["executives", "public"],
  queryFn: () => listExecutivesPublic(),
});

export const Route = createFileRoute("/collective")({
  head: () => ({
    meta: [
      { title: "The Collective @ BRQ+" },
      {
        name: "description",
        content:
          "BRQ+ is a curated collective of fractional senior executives — operators who have held C-suite and Senior Executive roles across corporates, NGOs, technology, fintech, financial services, education and compliance in regulated markets.",
      },
      { property: "og:title", content: "The Collective @ BRQ+" },
      {
        property: "og:description",
        content:
          "Senior operators with real track records. Fractional C-suite executives deployed on confidential mandates across Asia and MENA.",
      },
      { property: "og:url", content: "https://brqplus.ai/collective" },
    ],
    links: [{ rel: "canonical", href: "https://brqplus.ai/collective" }],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(executivesQueryOptions),
  component: CollectivePage,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-5 py-24 text-center text-muted-foreground">
      Could not load the collective right now. {(error as Error).message}
    </div>
  ),
  notFoundComponent: () => <div className="px-5 py-24 text-center">Not found.</div>,
});

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((n) => n.replace(/\./g, "")[0]?.toUpperCase() ?? "")
    .filter(Boolean)
    .slice(0, 2)
    .join("");
}


function CollectivePage() {
  const { data } = useSuspenseQuery(executivesQueryOptions);
  const executives = data.executives;

  const expertiseOptions = useMemo(() => {
    const set = new Set<string>();
    executives.forEach((e) => e.expertise.forEach((t) => set.add(t)));
    return ["All", ...Array.from(set).sort()];
  }, [executives]);

  const [filter, setFilter] = useState<string>("All");

  const filtered = useMemo(
    () =>
      filter === "All"
        ? executives
        : executives.filter((e) => e.expertise.includes(filter)),
    [executives, filter],
  );

  return (
    <>
      {/* SECTION 1 — Hero */}
      <section className="relative isolate overflow-hidden border-b border-border">
        <div className="absolute inset-0">
          <MeshBackground />
        </div>
        <div className="relative mx-auto max-w-7xl px-5 py-24 lg:px-8">
          <Link to="/programs" className="mb-5 block font-mono text-xs uppercase tracking-widest text-gold hover:underline">Programs / The Collective @ BRQ+</Link>
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-xs font-semibold uppercase tracking-[0.25em] text-gold"
          >
            THE COLLECTIVE @ BRQ+
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="font-display mt-5 max-w-4xl text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl"
          >
            Senior Operators. <span className="text-gradient-gold">Real Track Records.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="mt-6 max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            Every executive in the BRQ+ collective has held C-suite or VP-level roles at banks,
            fintechs, regulators, or sovereign institutions. No junior associates. No career
            consultants. Just people who have done the exact thing your organization needs.
            <br />
            <br />
            Where Ordinary Advisory Ends. Execution Begins.
          </motion.p>

          {/* Filters */}
          {expertiseOptions.length > 1 && (
            <div className="mt-12 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/70">
                Expertise:
              </span>
              {expertiseOptions.map((opt) => {
                const active = filter === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setFilter(opt)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      active
                        ? "border-gold/60 bg-gold/15 text-gold"
                        : "border-border bg-charcoal/60 text-muted-foreground hover:border-gold/30 hover:text-gold"
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* SECTION 2 — Cards Grid */}
      <section className="bg-navy px-5 py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground">
              No operators match this filter yet.
            </p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((e, i) => (
                <motion.article
                  key={e.id}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.45, delay: Math.min(i * 0.04, 0.3) }}
                  whileHover={{ y: -6 }}
                  className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 transition-shadow duration-300 hover:border-gold/40 hover:shadow-[0_20px_60px_-20px_color-mix(in_oklab,var(--gold)_30%,transparent)]"
                >
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                  <div className="flex flex-col items-center gap-4 text-center">
                    {e.avatar_url ? (
                      <img
                        src={e.avatar_url}
                        alt={e.name}
                        className="h-40 w-40 shrink-0 rounded-full border-2 border-gold/30 object-cover sm:h-52 sm:w-52 lg:h-[230px] lg:w-[230px]"
                      />
                    ) : (
                      <div
                        className="flex h-40 w-40 shrink-0 items-center justify-center rounded-full border-2 border-gold/30 bg-charcoal font-display text-3xl font-bold text-gold sm:h-52 sm:w-52 lg:h-[230px] lg:w-[230px]"
                      >
                        {initials(e.name)}
                      </div>
                    )}
                    <div>
                      <h3 className="font-display text-lg font-semibold leading-snug">
                        {e.name}
                      </h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">{e.role}</p>
                      {e.company && (
                        <p className="mt-0.5 text-xs font-medium text-cyan/90">{e.company}</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-1.5">
                    {e.expertise.slice(0, 4).map((d) => (
                      <span
                        key={d}
                        className="rounded-full border border-cyan/25 bg-cyan/10 px-2 py-0.5 text-[10px] text-cyan"
                      >
                        {d}
                      </span>
                    ))}
                  </div>

                  {e.markets && e.markets.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {e.markets.slice(0, 5).map((m) => (
                        <span
                          key={m}
                          className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  )}

                  {e.bio && (
                    <p className="mt-4 line-clamp-5 text-sm leading-relaxed text-foreground/85">
                      {e.bio}
                    </p>
                  )}

                  <div className="mt-auto flex flex-col gap-2 pt-5">
                    {e.linkedin_url && (
                      <a
                        href={e.linkedin_url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex w-full items-center justify-center rounded-full border border-border px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:border-cyan/40 hover:text-cyan"
                      >
                        LinkedIn ↗
                      </a>
                    )}
                  </div>
                </motion.article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* SECTION 3 — Mandate CTA Band */}
      <section className="relative overflow-hidden bg-charcoal px-5 py-24 lg:px-8">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            Tell us your mandate.{" "}
            <span className="text-gradient-gold">We'll identify the right operator.</span>
          </h2>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
            Our collective spans specialisations across Asia and MENA. If the expertise exists in
            emerging-market fintech, it's in our collective.
          </p>
          <Link
            to="/contact"
            className="mt-8 inline-flex items-center justify-center rounded-full bg-gold px-6 py-3 text-sm font-semibold uppercase tracking-wider text-navy transition-transform hover:scale-[1.02]"
          >
            Submit a Confidential Brief
          </Link>
        </div>
      </section>

      {/* SECTION 4 — Join Callout */}
      <section className="bg-navy px-5 py-20 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-10 text-center">
          <h2 className="font-display text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
            Are you a senior executive?
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            The BRQ+ collective is invitation-only. If you have C-suite or VP-level experience in
            fintech, Islamic finance, AI, or regulated markets across Asia or MENA — we want to
            hear from you.
          </p>
          <Link
            to="/join"
            className="mt-7 inline-flex items-center justify-center rounded-full border border-gold/50 px-6 py-2.5 text-sm font-semibold uppercase tracking-wider text-gold transition-colors hover:bg-gold hover:text-navy"
          >
            Apply to Join
          </Link>
        </div>
      </section>
    </>
  );
}
