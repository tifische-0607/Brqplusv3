import { motion } from "motion/react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { SectionTitle } from "./SectionTitle";
import { listPublicCollective } from "@/lib/collective-public.functions";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type Member = {
  id: string;
  name: string;
  role: string;
  expertise: string[];
  markets?: string[];
  availability: string;
  bio: string | null;
  avatar_url: string | null;
  linkedin_url: string | null;
  mission_count: number;
};


type CollectiveProps = {
  expertId?: string;
  onExpertChange?: (id: string | null) => void;
};


function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}

export function Collective({ expertId, onExpertChange }: CollectiveProps) {
  const fetchPublic = useServerFn(listPublicCollective);
  const { data, isLoading } = useQuery({
    queryKey: ["public-collective"],
    queryFn: () => fetchPublic(),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });

  const live: Member[] = data?.members ?? [];
  const visible = live.filter((m) => m.availability !== "not_deployed");
  const display = visible;


  const modalMember = useMemo(
    () => (expertId ? visible.find((m) => m.id === expertId) ?? null : null),
    [expertId, visible],
  );

  // Scroll into view when a deep-linked expert card exists
  useEffect(() => {
    if (expertId && !isLoading) {
      const el = document.getElementById("collective");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }, [expertId, isLoading]);

  const [copied, setCopied] = useState(false);

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const canShare = typeof navigator !== "undefined" && !!navigator.share;

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // silently fail
    }
  };

  const handleShare = async () => {
    if (!modalMember || !shareUrl) return;
    if (canShare) {
      try {
        await navigator.share({
          title: `${modalMember.name} — ${modalMember.role} @ BRQ+`,
          text: `Check out ${modalMember.name}, ${modalMember.role} at The Collective @ BRQ+`,
          url: shareUrl,
        });
      } catch {
        // user cancelled or share failed — fall through to clipboard
      }
      return;
    }
    // Fallback to clipboard when native share is unavailable
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // silently fail
    }
  };

  return (
    <section id="collective" className="relative bg-background px-5 py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <SectionTitle
            eyebrow="The Collective @ BRQ+"
            title={<>The Collective @ BRQ+.{"\n"}<span className="text-gradient-gold">A special unit, not a firm.</span></>}
            description={<>The Collective @ BRQ+ focuses on specialized projects in social enterprise, enterprise transformation, ethical finance, and digital inclusion, with a cadre of veteran operators deployed where impact is maximized.</>}
            descriptionClassName="text-sm tracking-tight sm:text-base sm:tracking-normal"
          />
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={`sk-${i}`}
                  className="relative overflow-hidden rounded-2xl border border-border bg-card p-6"
                >
                  <Skeleton shimmer className="mx-auto size-40 rounded-full sm:size-52" />
                  <Skeleton shimmer className="mx-auto mt-5 h-5 w-3/4 rounded-md" />
                  <Skeleton shimmer className="mx-auto mt-2 h-4 w-1/2 rounded-md" />
                  <Skeleton shimmer className="mt-4 h-3 w-full rounded-md" />
                </div>
              ))
            : display.map((m, i) => {
                const hasLinkedIn = !!m.linkedin_url;
                return (
                  <motion.article
                    key={m.id}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ duration: 0.45, delay: Math.min(i * 0.04, 0.3) }}
                    whileHover={{ y: -6 }}
                    onClick={() => !hasLinkedIn && onExpertChange?.(m.id)}
                    className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 transition-shadow duration-300 hover:border-gold/40 hover:shadow-[0_20px_60px_-20px_color-mix(in_oklab,var(--gold)_30%,transparent)] cursor-pointer"
                  >
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                    <div className="flex flex-col items-center gap-4 text-center">
                      {m.avatar_url ? (
                        <img
                          src={m.avatar_url}
                          alt={m.name}
                          className="h-40 w-40 shrink-0 rounded-full border-2 border-gold/30 object-cover sm:h-52 sm:w-52 lg:h-[230px] lg:w-[230px]"
                        />
                      ) : (
                        <div className="flex h-40 w-40 shrink-0 items-center justify-center rounded-full border-2 border-gold/30 bg-charcoal font-display text-3xl font-bold text-gold sm:h-52 sm:w-52 lg:h-[230px] lg:w-[230px]">
                          {initials(m.name)}
                        </div>
                      )}
                      <div>
                        <h3 className="font-display text-lg font-semibold leading-snug">
                          {m.name}
                        </h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">{m.role}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-1.5">
                      {(m.expertise ?? []).slice(0, 4).map((d) => (
                        <span
                          key={d}
                          className="rounded-full border border-cyan/25 bg-cyan/10 px-2 py-0.5 text-[10px] text-cyan"
                        >
                          {d}
                        </span>
                      ))}
                    </div>

                    {m.markets && m.markets.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {m.markets.slice(0, 5).map((mk) => (
                          <span
                            key={mk}
                            className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold"
                          >
                            {mk}
                          </span>
                        ))}
                      </div>
                    )}

                    {m.bio && (
                      <p className="mt-4 line-clamp-5 text-sm leading-relaxed text-foreground/85">
                        {m.bio}
                      </p>
                    )}

                    <div className="mt-auto flex flex-col gap-2 pt-5">
                      {m.linkedin_url && (
                        <a
                          href={m.linkedin_url}
                          target="_blank"
                          rel="noreferrer noopener"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex w-full items-center justify-center rounded-full border border-border px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:border-cyan/40 hover:text-cyan"
                        >
                          LinkedIn ↗
                        </a>
                      )}
                    </div>
                  </motion.article>
                );
              })}
        </div>

      </div>

      <Dialog open={!!modalMember} onOpenChange={(open) => !open && onExpertChange?.(null)}>
        <DialogContent className="border-border bg-card text-foreground sm:max-w-md">
          <DialogTitle className="sr-only">
            {modalMember ? `${modalMember.name} — ${modalMember.role}` : "Expert profile"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Detailed profile information for this Collective member.
          </DialogDescription>
          {modalMember && (
            <div className="flex flex-col items-center text-center">
              {modalMember.avatar_url ? (
                <img
                  src={modalMember.avatar_url}
                  alt={modalMember.name}
                  className="size-20 rounded-2xl border border-border object-cover"
                />
              ) : (
                <div className="flex size-20 items-center justify-center rounded-2xl border border-border bg-charcoal font-display text-2xl font-bold text-gold">
                  {initials(modalMember.name)}
                </div>
              )}
              <h3 className="font-display mt-5 text-xl font-semibold">{modalMember.name}</h3>
              <div className="mt-2 inline-flex items-center rounded-full border border-cyan/25 bg-cyan/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-cyan">
                {modalMember.role}
              </div>
              {modalMember.mission_count > 0 && (
                <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <span className="inline-flex size-5 items-center justify-center rounded-full border border-gold/30 bg-gold/10 text-[10px] text-gold">
                    {modalMember.mission_count}
                  </span>
                  <span>{modalMember.mission_count === 1 ? "Mission" : "Missions"}</span>
                </div>
              )}
              {modalMember.expertise.length > 0 && (
                <div className="mt-5 w-full">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/60">Expertise</span>
                  <div className="mt-2 flex flex-wrap justify-center gap-2">
                    {modalMember.expertise.map((tag: string) => (
                      <span key={tag} className="rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {modalMember.bio && (
                <p className="mt-5 w-full border-l-2 border-gold/30 pl-4 text-left text-[13px] leading-[1.65] text-gold/80 sm:text-sm">
                  {modalMember.bio}
                </p>
              )}
              {modalMember.linkedin_url && (
                <a
                  href={modalMember.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex items-center gap-2 rounded-full border border-cyan/25 bg-cyan/10 px-5 py-2 text-sm font-semibold text-cyan hover:bg-cyan/20 transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden="true">
                    <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.36V9h3.41v1.56h.05c.47-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
                  </svg>
                  View on LinkedIn
                </a>
              )}

              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={handleShare}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:border-gold/40 hover:text-gold transition-colors"
                >
                  {canShare ? (
                    <>
                      <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                        <line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>
                      </svg>
                      Share
                    </>
                  ) : (
                    <>
                      <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                      </svg>
                      {copied ? "Copied!" : "Copy link"}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
