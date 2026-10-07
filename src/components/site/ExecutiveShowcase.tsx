import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Briefcase, Linkedin } from "lucide-react";
import { listPublicCollective } from "@/lib/collective-public.functions";

type Member = {
  id: string;
  name: string;
  role: string;
  expertise: string[];
  markets: string[];
  availability: "available" | "limited" | "unavailable" | "not_deployed";
  bio: string | null;
  avatar_url: string | null;
  linkedin_url: string | null;
  mission_count: number;
};

const FOREST = "var(--gold)";
const FOREST_DARK = "var(--gold-light)";
const BORDER = "var(--border)";
const BORDER_HOVER = "color-mix(in oklab, var(--gold) 40%, transparent)";
const TEXT_PRIMARY = "var(--foreground)";
const TEXT_SECONDARY = "var(--muted-foreground)";
const BG_SECONDARY = "var(--secondary)";
const ACCENT_BG = "color-mix(in oklab, var(--gold) 18%, transparent)";
const ACCENT_BORDER = "color-mix(in oklab, var(--gold) 50%, transparent)";
const SURFACE = "var(--card)";
const SURFACE_BASE = "var(--background)";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}

export function ExecutiveShowcase() {
  const fetchPublic = useServerFn(listPublicCollective);
  const { data } = useQuery({
    queryKey: ["public-collective"],
    queryFn: () => fetchPublic(),
    staleTime: 5 * 60 * 1000,
  });

  const members = (data?.members ?? []).filter(
    (m) => m.availability !== "not_deployed",
  );

  if (members.length === 0) return null;

  return (
    <section
      aria-label="The Collective — executives"
      style={{
        background: SURFACE_BASE,
        borderBottom: `0.5px solid ${BORDER}`,
        color: TEXT_PRIMARY,
      }}
      className="w-full px-5 py-9 md:px-8 md:py-10 lg:px-16 lg:py-14"
    >
      <div className="mb-9 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              style={{ width: 18, height: 1.5, background: FOREST, borderRadius: 1 }}
            />
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: FOREST,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              The Collective
            </span>
          </div>
          <h2
            style={{
              fontSize: 26,
              fontWeight: 500,
              color: TEXT_PRIMARY,
              lineHeight: 1.2,
              marginTop: 8,
              fontFamily: "var(--font-display)",
            }}
            className="text-[20px] md:text-[22px] lg:text-[26px]"
          >
            Operators, not advisors.
          </h2>
          <p
            style={{
              fontSize: 14,
              color: TEXT_SECONDARY,
              lineHeight: 1.6,
              marginTop: 6,
              maxWidth: 440,
            }}
          >
            Seasoned executives with decades of hands-on leadership across the region's
            most consequential advisories, corporates, fintechs, banks, and regulators.
          </p>
        </div>
        <Link
          to="/collective"
          className="inline-flex items-center gap-1.5 transition-colors hover:underline"
          style={{ fontSize: 13, color: FOREST, textDecoration: "none" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = FOREST_DARK)}
          onMouseLeave={(e) => (e.currentTarget.style.color = FOREST)}
        >
          Meet the full collective
          <ArrowRight size={13} />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {members.map((m) => (
          <ExecutiveTile key={m.id} member={m} />
        ))}
      </div>
    </section>
  );
}

function ExecutiveTile({ member }: { member: Member }) {
  const [hover, setHover] = useState(false);
  const [imgError, setImgError] = useState(false);
  const hasLink = !!member.linkedin_url;
  const tags = member.expertise.slice(0, 4);
  const tenure =
    member.markets.length > 0 ? member.markets.slice(0, 4).join(" · ") : null;

  const card = (
    <article
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover && hasLink ? BG_SECONDARY : SURFACE,
        border: `0.5px solid ${hover && hasLink ? BORDER_HOVER : BORDER}`,
        borderRadius: 12,
        padding: "24px 20px 20px",
        position: "relative",
        overflow: "hidden",
        cursor: hasLink ? "pointer" : "default",
        transition: "border-color 200ms ease, background 200ms ease",
        height: "100%",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: FOREST,
          opacity: hover && hasLink ? 1 : 0,
          transition: "opacity 200ms ease",
        }}
      />

      <div className="flex flex-col items-center text-center">
        <div className="mb-4 flex flex-col items-center text-center">
          <div
            className="size-24 md:size-28 lg:size-28"
            style={{
              borderRadius: "50%",
              border: `0.5px solid ${BORDER}`,
              overflow: "hidden",
              flexShrink: 0,
              background: BG_SECONDARY,
              color: FOREST,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              fontWeight: 500,
            }}
          >
            {member.avatar_url && !imgError ? (
              <img
                src={member.avatar_url}
                alt={member.name}
                onError={() => setImgError(true)}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span aria-hidden="true">{initials(member.name)}</span>
            )}
          </div>

          {hasLink && (
            <a
              href={member.linkedin_url!}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:border-gold/40 hover:text-gold"
            >
              <Linkedin size={11} />
              LinkedIn
            </a>
          )}
        </div>

        <h3
          style={{
            fontSize: 15,
            fontWeight: 500,
            color: TEXT_PRIMARY,
            marginBottom: 3,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            fontFamily: "var(--font-display)",
          }}
        >
          {member.name}
        </h3>

        <p
          style={{
            fontSize: 12,
            color: TEXT_SECONDARY,
            lineHeight: 1.45,
            marginBottom: 12,
          }}
        >
          {member.role}
        </p>

        <hr style={{ border: "none", borderTop: `0.5px solid ${BORDER}`, margin: "0 0 12px", width: "100%" }} />

        {tags.length > 0 && (
          <ul
            className="m-0 mb-3 flex list-none flex-wrap justify-center gap-1.5 p-0"
            style={{ marginBottom: 12 }}
          >
            {tags.map((tag, i) => {
              const isPrimary = i < 2;
              const isFourth = i === 3;
              return (
                <li
                  key={`${tag}-${i}`}
                  className={isFourth ? "max-[374px]:hidden" : ""}
                  style={{
                    fontSize: 10,
                    padding: "2px 8px",
                    borderRadius: 10,
                    background: isPrimary ? ACCENT_BG : BG_SECONDARY,
                    border: `0.5px solid ${isPrimary ? ACCENT_BORDER : BORDER}`,
                    color: isPrimary ? FOREST : TEXT_SECONDARY,
                  }}
                >
                  {tag}
                </li>
              );
            })}
          </ul>
        )}

        {tenure && (
          <p
            className="m-0 flex items-center justify-center gap-1"
            style={{ fontSize: 11, color: TEXT_SECONDARY }}
          >
            <Briefcase size={11} style={{ flexShrink: 0 }} aria-hidden="true" />
            <span>{tenure}</span>
          </p>
        )}
      </div>
    </article>
  );

  if (!hasLink) return card;
  return (
    <a
      href={member.linkedin_url!}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`View ${member.name} on LinkedIn`}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      {card}
    </a>
  );
}
