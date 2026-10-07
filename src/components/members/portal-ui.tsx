import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";

export const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background";
export const inputCls = `w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-gold ${focusRing}`;
export const labelCls = "text-xs font-semibold uppercase tracking-wider text-muted-foreground";
export const btnGold = `min-h-11 rounded-md border border-gold bg-gold/10 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gold hover:bg-gold/20 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;
export const linkGold = `rounded-sm text-xs font-semibold uppercase tracking-wider text-gold hover:underline ${focusRing}`;

export function PageIntro({ eyebrow, title, children, actions }: { eyebrow?: string; title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-widest text-gold">{eyebrow}</p>}
        <h2 className="mt-1 font-display text-2xl font-bold text-foreground md:text-3xl">{title}</h2>
        {children && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{children}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Panel({ title, action, children, className = "" }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-border bg-card p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gold">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return <div className="space-y-2" aria-busy="true" aria-label="Loading">{Array.from({ length: rows }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-md bg-muted/30" />)}</div>;
}

export function Empty({ children, cta }: { children: ReactNode; cta?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      <p>{children}</p>
      {cta && <div className="mt-3">{cta}</div>}
    </div>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  return <p role="alert" className="text-sm text-destructive">{error instanceof Error ? error.message : "Something went wrong."}</p>;
}

const STATUS: Record<string, [string, string]> = {
  active: ["Active", "border-cyan/40 bg-cyan/10 text-cyan"],
  in_review: ["In review", "border-gold/40 bg-gold/10 text-gold"],
  not_started: ["Not started", "border-border bg-muted/30 text-muted-foreground"],
  on_hold: ["On hold", "border-border bg-muted/30 text-muted-foreground"],
  completed: ["Completed", "border-cyan/40 bg-cyan/10 text-cyan"],
  cancelled: ["Cancelled", "border-destructive/40 bg-destructive/10 text-destructive"],
  executed: ["Executed", "border-cyan/40 bg-cyan/10 text-cyan"],
  pending: ["Pending", "border-gold/40 bg-gold/10 text-gold"],
  approved: ["Approved", "border-cyan/40 bg-cyan/10 text-cyan"],
  rejected: ["Not progressed", "border-border bg-muted/30 text-muted-foreground"],
};

export function Pill({ status, label }: { status: string; label?: string }) {
  const [l, c] = STATUS[status] ?? [status.replace(/_/g, " "), "border-border bg-muted/30 text-muted-foreground"];
  return <span aria-label={`Status: ${label ?? l}`} className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${c}`}>{label ?? l}</span>;
}

export const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");

export type Engagement = {
  id: string; title: string; status: string; mission_type: string | null; customer: string | null; role: string;
  lead: string | null; start: string | null; end: string | null;
  next_milestone: { title: string; target_date: string } | null; nda_status: string | null;
};

const FILTERS = [
  ["all", "All"], ["active", "Active"], ["in_review", "In review"], ["not_started", "Not started"], ["on_hold", "On hold"], ["completed", "Completed"],
] as const;

export function EngagementsList({ items, compact = false }: { items: Engagement[]; compact?: boolean }) {
  const [f, setF] = useState<string>("all");
  const rows = useMemo(() => (f === "all" ? items : items.filter((i) => i.status === f)), [items, f]);
  return (
    <div>
      {!compact && (
        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          {FILTERS.map(([k, l]) => (
            <button key={k} type="button" onClick={() => setF(k)} aria-pressed={f === k}
              className={`min-h-11 rounded-full border px-3 py-1 text-xs ${focusRing} ${f === k ? "border-gold bg-gold/10 text-gold" : "border-border text-muted-foreground hover:text-foreground"}`}>
              {l} {k === "all" ? `(${items.length})` : `(${items.filter((i) => i.status === k).length})`}
            </button>
          ))}
        </div>
      )}
      {!rows.length ? (
        <Empty>{items.length ? "No engagements match this filter." : "No engagements yet. When BRQ+ adds you to a mission, it appears here."}</Empty>
      ) : (
        <ul className="grid gap-3">
          {rows.map((e) => (
            <li key={e.id}>
              <Link to="/mission/$missionId" params={{ missionId: e.id }} className={`block rounded-xl border border-border bg-background/40 p-4 transition-colors hover:border-gold/60 ${focusRing}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{e.mission_type ?? "Mission"} · {e.role}</p>
                    <p className="mt-1 truncate font-display text-base font-semibold text-foreground">{e.title}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <Pill status={e.status} />
                    <Pill status={e.nda_status ?? "none"} label={e.nda_status === "executed" ? "NDA executed" : e.nda_status ? "NDA pending" : "No NDA"} />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                  {e.lead && <span>Lead: <span className="text-foreground">{e.lead}</span></span>}
                  <span>{fmtDate(e.start)}{e.end ? ` → ${fmtDate(e.end)}` : ""}</span>
                  {e.next_milestone && <span>Next: <span className="text-foreground">{e.next_milestone.title}</span> · {fmtDate(e.next_milestone.target_date)}</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <span>
        <span className="block text-sm text-foreground">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${focusRing} ${checked ? "border-gold bg-gold/80" : "border-border bg-muted/40"}`}>
        <span aria-hidden="true" className={`absolute top-1 h-[18px] w-[18px] rounded-full bg-foreground transition-all ${checked ? "left-6" : "left-1"}`} />
      </button>
    </label>
  );
}

export type Strength = { score: 0 | 1 | 2 | 3 | 4; label: string; tone: string };
export function scorePassword(pw: string): Strength {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  if (pw.length < 8) score = 0;
  const map: Strength[] = [
    { score: 0, label: "Too short", tone: "bg-destructive" },
    { score: 1, label: "Weak", tone: "bg-destructive" },
    { score: 2, label: "Fair", tone: "bg-gold/80" },
    { score: 3, label: "Good", tone: "bg-cyan/80" },
    { score: 4, label: "Strong", tone: "bg-cyan" },
  ];
  return map[score]!;
}

export function StrengthMeter({ password, id }: { password: string; id?: string }) {
  if (!password) return null;
  const s = scorePassword(password);
  return (
    <div id={id} className="mt-2" aria-live="polite">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div className={`h-full transition-all ${s.tone}`} style={{ width: `${(s.score / 4) * 100}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">Password strength: {s.label}. 12+ characters with mixed case, numbers, and a symbol is ideal.</p>
    </div>
  );
}
