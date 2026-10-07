import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  getMissionOverview,
  type MissionOverview,
} from "@/lib/mission-overview.functions";

type Props = {
  missionId: string;
  userRole: "client" | "operator" | "brqplus_lead" | "admin" | "viewer";
  fallbackCreatedAt: string;
  fallbackTargetDays: number;
};

function formatMoney(amount: number | null | undefined, currency: string): string {
  const n = Number(amount ?? 0);
  return `${currency} ${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)}`;
}

function fmtDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function MissionOverviewStrip({ missionId, userRole }: Props) {
  const isLead = userRole === "admin" || userRole === "brqplus_lead";
  const fetchFn = useServerFn(getMissionOverview);

  const { data } = useQuery({
    queryKey: ["mission-overview", missionId],
    queryFn: () => fetchFn({ data: { mission_id: missionId } }),
  });

  if (!data) {
    return (
      <div className="grid grid-cols-[1fr_1px_1fr_1px_1fr] border-b border-border/60 bg-card/40">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[120px] animate-pulse px-[18px] py-[14px]">
            <div className="mb-2 h-2 w-20 rounded bg-muted/40" />
            <div className="h-3 w-32 rounded bg-muted/40" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mission-overview-strip grid grid-cols-[1fr_0.5px_1fr_0.5px_1fr] max-md:grid-cols-1 border-b border-border/60 bg-card/40">
      <BriefCell overview={data} isLead={isLead} />
      <div className="bg-border/60 max-md:hidden" />
      <ValueCell overview={data} isLead={isLead} />
      <div className="bg-border/60 max-md:hidden" />
      <TimelineCell overview={data} isLead={isLead} />
    </div>
  );
}

/* ----------------------------- Cell shell ----------------------------- */

function CellShell({
  icon,
  label,
  children,
}: {
  icon: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex h-[120px] flex-col gap-1.5 px-[18px] py-[14px] max-md:h-[80px] max-md:px-4 max-md:py-3 max-md:border-b max-md:border-border/60 max-md:last:border-b-0">
      <div className="flex items-center gap-1.5">
        <Icon name={icon} size={14} className="text-muted-foreground" />
        <span className="text-[11px] font-medium uppercase tracking-[0.03em] text-muted-foreground">
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

function LeadHint() {
  return (
    <p className="text-[10px] italic text-muted-foreground">
      Editable in the Mission Sheet (Admin → Missions).
    </p>
  );
}

/* ------------------------------- Brief --------------------------------- */

function BriefCell({ overview, isLead }: { overview: MissionOverview; isLead: boolean }) {
  const brief = overview.brief;
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const ref = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    if (!ref.current || expanded) return;
    const el = ref.current;
    const ro = new ResizeObserver(() => {
      setOverflowing(el.scrollHeight - 1 > el.clientHeight);
    });
    ro.observe(el);
    setOverflowing(el.scrollHeight - 1 > el.clientHeight);
    return () => ro.disconnect();
  }, [brief, expanded]);

  return (
    <CellShell icon="file-text" label="Project brief">
      {brief ? (
        <>
          <p
            ref={ref}
            className="text-[13px] leading-[1.5] text-muted-foreground"
            style={
              expanded
                ? undefined
                : {
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }
            }
          >
            {brief}
          </p>
          {overflowing && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex items-center gap-0.5 text-[11px] text-cyan hover:text-cyan/80"
              style={{ background: "none", border: "none", padding: 0 }}
            >
              <Icon name={expanded ? "chevron-up" : "chevron-down"} size={11} />
              {expanded ? "Show less" : "Read more"}
            </button>
          )}
        </>
      ) : (
        <p className="text-[12px] italic text-muted-foreground">Brief not yet added.</p>
      )}
      {isLead && !brief && <LeadHint />}
    </CellShell>
  );
}

/* ---------------------------- Est. value ------------------------------- */

function ValueCell({ overview, isLead }: { overview: MissionOverview; isLead: boolean }) {
  const hasContract = overview.contract_fee != null;
  const hasEstimate = !!(overview.estimated_fee && overview.estimated_fee.trim());

  return (
    <CellShell icon="coins" label="CONTRACT FEE (USD)">
      {hasContract ? (
        <>
          <div className="text-[16px] font-medium text-foreground">
            {formatMoney(overview.contract_fee, overview.contract_currency || "MYR")}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {overview.contract_signed_at
              ? `Contract signed ${fmtDateLong(overview.contract_signed_at)}`
              : "Contract confirmed"}
          </div>
          <div className="mt-1 inline-flex w-fit items-center gap-1 rounded-lg bg-cyan/15 px-2 py-0.5 text-[10px] text-cyan">
            <Icon name="check" size={10} />
            Contract confirmed
          </div>
        </>
      ) : hasEstimate ? (
        <>
          <div className="text-[16px] font-medium text-foreground">{overview.estimated_fee}</div>
          <div className="text-[11px] text-muted-foreground">
            Estimated fee · subject to confirmation
          </div>
          <div className="mt-1 inline-flex w-fit items-center gap-1 rounded-lg bg-gold/15 px-2 py-0.5 text-[10px] text-gold">
            <Icon name="clock" size={10} />
            Estimate
          </div>
        </>
      ) : (
        <>
          <p className="text-[12px] italic text-muted-foreground">Fee not yet confirmed.</p>
          {isLead && <LeadHint />}
        </>
      )}
    </CellShell>
  );
}

/* ------------------------------ Timeline ------------------------------- */

function TimelineCell({ overview, isLead }: { overview: MissionOverview; isLead: boolean }) {
  const timeline = overview.estimated_timeline?.trim();

  return (
    <CellShell icon="calendar" label="TIMELINE (WEEKS)">
      {timeline ? (
        <>
          <div className="text-[16px] font-medium text-foreground">{timeline}</div>
          <div className="text-[11px] text-muted-foreground">
            Estimated duration · from kickoff
          </div>
        </>
      ) : (
        <>
          <p className="text-[12px] italic text-muted-foreground">Timeline not yet set.</p>
          {isLead && <LeadHint />}
        </>
      )}
    </CellShell>
  );
}

/* -------------------------------- Icon --------------------------------- */

function Icon({ name, size = 14, className = "" }: { name: string; size?: number; className?: string }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };
  switch (name) {
    case "file-text":
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M8 13h8M8 17h6" />
        </svg>
      );
    case "coins":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="5" />
          <path d="M14.5 9.5a5 5 0 1 1-5 11" />
          <path d="M8 6v4l2 1" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "chevron-down":
      return (
        <svg {...common}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      );
    case "chevron-up":
      return (
        <svg {...common}>
          <path d="m18 15-6-6-6 6" />
        </svg>
      );
    default:
      return null;
  }
}
