import { Link } from "@tanstack/react-router";
import type { Executive } from "@/lib/executives.functions";

export const AVAILABILITY = ["available", "limited", "unavailable", "not_deployed"] as const;
export type Availability = (typeof AVAILABILITY)[number];

export const availStyles: Record<Availability, string> = {
  available: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
  limited: "bg-gold/15 text-gold border-gold/40",
  unavailable: "bg-muted text-muted-foreground border-border",
  not_deployed: "bg-muted text-muted-foreground border-border",
};

export const availLabel: Record<Availability, string> = {
  available: "available",
  limited: "limited",
  unavailable: "unavailable",
  not_deployed: "not deployed",
};

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}

export function ExecutiveAvatar({
  url,
  name,
  size = 48,
  className,
}: {
  url: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  const hasCustomSize = !!className;
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        style={hasCustomSize ? undefined : { width: size, height: size }}
        className={`rounded-full border border-border object-cover ${className ?? ""}`}
      />
    );
  }
  return (
    <div
      style={hasCustomSize ? undefined : { width: size, height: size }}
      className={`grid place-items-center rounded-full border border-border bg-muted text-sm font-semibold uppercase text-muted-foreground ${className ?? ""}`}
    >
      {initials(name) || "?"}
    </div>
  );
}

export function AvailabilityBadge({ availability }: { availability: Availability }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${availStyles[availability]}`}
    >
      {availLabel[availability]}
    </span>
  );
}

export function ExpertiseTags({ expertise }: { expertise: string[] }) {
  if (!expertise || expertise.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {expertise.map((tag) => (
        <span
          key={tag}
          className="rounded-full border border-cyan/30 bg-cyan/10 px-2 py-0.5 text-[11px] text-cyan"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

export function ExecutiveCard({
  executive,
  actions,
  linkToProfile,
}: {
  executive: Executive;
  actions?: React.ReactNode;
  linkToProfile?: boolean;
}) {
  return (
    <article className={`group relative rounded-xl border border-border bg-card p-5 ${linkToProfile ? "cursor-pointer transition-colors hover:border-gold/60" : ""}`}>
      <div className="flex flex-col items-center gap-3 text-center">
        <ExecutiveAvatar
          url={executive.avatar_url}
          name={executive.name}
          className="h-40 w-40 sm:h-52 sm:w-52 lg:h-[230px] lg:w-[230px]"
        />
        <div>
          <h2 className="font-semibold text-foreground">
            {linkToProfile ? (
              executive.user_id ? (
                <Link to="/members/$memberId" params={{ memberId: executive.user_id }} className="rounded hover:text-gold focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-gold after:absolute after:inset-0 after:rounded-xl">{executive.name}</Link>
              ) : (
                <Link to="/members/exec/$executiveId" params={{ executiveId: executive.id }} className="rounded hover:text-gold focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-gold after:absolute after:inset-0 after:rounded-xl">{executive.name}</Link>
              )
            ) : executive.name}
          </h2>
          <p className="text-xs text-muted-foreground">{executive.role}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <AvailabilityBadge availability={executive.availability} />
        <span className="text-[11px] text-muted-foreground">
          {executive.mission_count} mission{executive.mission_count === 1 ? "" : "s"}
        </span>
      </div>

      {executive.bio && <p className="mt-3 text-sm text-muted-foreground">{executive.bio}</p>}

      {executive.expertise.length > 0 && (
        <div className="mt-3">
          <ExpertiseTags expertise={executive.expertise} />
        </div>
      )}

      {executive.markets && executive.markets.length > 0 && (
        <div className="mt-2">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Markets
          </p>
          <div className="flex flex-wrap gap-1">
            {executive.markets.map((m) => (
              <span
                key={m}
                className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[11px] text-gold"
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      )}

      {executive.linkedin_url && (
        <a
          href={executive.linkedin_url}
          target="_blank"
          rel="noreferrer"
          className="relative z-10 mt-4 inline-block text-xs font-semibold uppercase tracking-wider text-cyan hover:underline focus-visible:outline-2 focus-visible:outline-gold"
        >
          LinkedIn →
        </a>
      )}

      {actions && <div className="relative z-10 mt-4 flex items-center gap-2">{actions}</div>}
    </article>
  );
}
