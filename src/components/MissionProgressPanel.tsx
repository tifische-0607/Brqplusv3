import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listMissionProgress,
  logProgressEntry,
  updateMilestoneStatus,
  type MissionMilestone,
  type MissionProgressEntry,
} from "@/lib/progress.functions";

type Props = {
  missionId: string;
  userRole: "client" | "operator" | "brqplus_lead" | "admin" | "viewer";
  missionCreatedAt: string;
  targetDays: number;
};

const BRAND = "#1a1a1a";
const BRAND_ACCENT = "#c9a84c";

function fmtShort(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}
function addDays(d: Date, days: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

const MILESTONE_PILL: Record<string, string> = {
  completed: "bg-cyan/15 text-cyan border-cyan/40",
  in_progress: "bg-gold/15 text-gold border-gold/40",
  upcoming: "bg-muted/40 text-muted-foreground border-border",
  overdue: "bg-destructive/15 text-destructive border-destructive/40",
};

export function MissionProgressPanel({ missionId, userRole, missionCreatedAt, targetDays }: Props) {
  const isLead = userRole === "admin" || userRole === "brqplus_lead";
  const qc = useQueryClient();
  const listFn = useServerFn(listMissionProgress);
  const logFn = useServerFn(logProgressEntry);
  const updateMilestoneFn = useServerFn(updateMilestoneStatus);

  const queryKey = ["mission-progress", missionId];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => listFn({ data: { mission_id: missionId } }),
  });

  // Collapse persistence
  const storageKey = `brqplus_progress_collapsed_${missionId}`;
  const [isCollapsed, setIsCollapsed] = useState(false);
  useEffect(() => {
    const v = typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null;
    if (v === "true") setIsCollapsed(true);
  }, [storageKey]);
  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(storageKey, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`mission-progress-${missionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mission_progress_entries", filter: `mission_id=eq.${missionId}` },
        () => qc.invalidateQueries({ queryKey }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mission_milestones", filter: `mission_id=eq.${missionId}` },
        () => qc.invalidateQueries({ queryKey }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missionId]);

  const entries = data?.entries ?? [];
  const milestones = data?.milestones ?? [];

  // Derived stats
  const createdAt = useMemo(() => new Date(missionCreatedAt), [missionCreatedAt]);
  const now = new Date();
  const currentPct = entries.length ? entries[entries.length - 1].completion_pct : 0;
  const elapsedDays = Math.max(0, daysBetween(createdAt, now));
  const dailyRate = elapsedDays > 0 && currentPct > 0 ? currentPct / elapsedDays : 0;
  const projectedCloseDate =
    dailyRate > 0 && currentPct < 100 ? addDays(createdAt, Math.ceil(100 / dailyRate)) : null;
  const targetEnd = addDays(createdAt, targetDays);
  const milestonesHit = milestones.filter((m) => m.status === "completed").length;

  const elapsedColor =
    elapsedDays > targetDays
      ? "text-destructive"
      : elapsedDays >= targetDays * 0.8
        ? "text-gold"
        : "text-foreground";
  const closeColor =
    projectedCloseDate && projectedCloseDate > targetEnd ? "text-gold" : "text-foreground";
  const milestoneColor =
    milestones.length > 0 && milestonesHit === milestones.length ? "text-cyan" : "text-foreground";

  // Chart data
  const actualPoints = useMemo(
    () =>
      entries.map((e) => {
        const d = new Date(e.recorded_at);
        return {
          date: fmtShort(d),
          timestamp: d.getTime(),
          pct: e.completion_pct,
          isProjected: false as const,
        };
      }),
    [entries],
  );
  const todayLabel = fmtShort(now);
  const projectedPoints = useMemo(() => {
    if (!projectedCloseDate || currentPct >= 100 || entries.length === 0) return [];
    return [
      { date: todayLabel, timestamp: now.getTime(), pct: currentPct, isProjected: true as const },
      {
        date: fmtShort(projectedCloseDate),
        timestamp: projectedCloseDate.getTime(),
        pct: 100,
        isProjected: true as const,
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectedCloseDate, currentPct, entries.length]);

  const chartData = useMemo(() => {
    // Merge with x labels; we use date strings as the categorical x. Add a row per actual + projected
    const map = new Map<string, { date: string; timestamp: number; actual?: number; projected?: number }>();
    for (const p of actualPoints) {
      map.set(p.date, { date: p.date, timestamp: p.timestamp, actual: p.pct });
    }
    for (const p of projectedPoints) {
      const ex = map.get(p.date);
      if (ex) ex.projected = p.pct;
      else map.set(p.date, { date: p.date, timestamp: p.timestamp, projected: p.pct });
    }
    return Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
  }, [actualPoints, projectedPoints]);

  // Log update drawer
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const logMut = useMutation({
    mutationFn: (vars: {
      completion_pct: number;
      note?: string;
      milestone_id?: string | null;
      mark_milestone_complete?: boolean;
      recorded_at?: string;
    }) =>
      logFn({
        data: {
          mission_id: missionId,
          completion_pct: vars.completion_pct,
          note: vars.note,
          milestone_id: vars.milestone_id ?? null,
          mark_milestone_complete: vars.mark_milestone_complete,
          recorded_at: vars.recorded_at,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Progress update saved.");
      setDrawerOpen(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save update"),
  });

  // Milestone popover
  const [openMilestoneId, setOpenMilestoneId] = useState<string | null>(null);
  const markCompleteMut = useMutation({
    mutationFn: (id: string) => updateMilestoneFn({ data: { milestone_id: id, status: "completed" } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Milestone marked complete.");
      setOpenMilestoneId(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <div className="border-b border-border bg-card/40 overflow-hidden">
      {/* Stat header row — always visible */}
      <div className="flex items-center justify-between gap-4 px-5 py-2 lg:px-8 h-14">
        <div className="flex items-center gap-5 divide-x divide-border">
          <div className="pr-5">
            <div className="text-[22px] font-medium leading-none text-foreground">
              {entries.length ? `${currentPct}%` : "—"}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">Mission progress</div>
          </div>
          <div className="pl-5 pr-5 hidden sm:block">
            <div className={`text-sm font-medium ${elapsedColor}`}>Day {elapsedDays}</div>
            <div className="text-[11px] text-muted-foreground">of {targetDays} target</div>
          </div>
          <div className="pl-5 pr-5 hidden md:block">
            <div className={`text-sm font-medium ${milestoneColor}`}>
              {milestonesHit} of {milestones.length}
            </div>
            <div className="text-[11px] text-muted-foreground">milestones hit</div>
          </div>
          <div className="pl-5 hidden md:block">
            <div className={`text-sm font-medium ${closeColor}`}>
              {projectedCloseDate ? fmtShort(projectedCloseDate) : "—"}
            </div>
            <div className="text-[11px] text-muted-foreground">projected close</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isLead && (
            <button
              onClick={() => setDrawerOpen(true)}
              className="rounded-md border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            >
              + Log update
            </button>
          )}
          <button
            onClick={toggleCollapsed}
            title={isCollapsed ? "Expand graph" : "Collapse graph"}
            className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground hover:text-foreground"
          >
            <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true">
              {isCollapsed ? (
                <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
              ) : (
                <path d="M2 8l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Graph + milestone track */}
      {!isCollapsed && (
        <div className="px-5 lg:px-8 pb-2">
          {isLoading ? (
            <div className="h-[150px] w-full animate-pulse rounded bg-muted/40" />
          ) : entries.length === 0 ? (
            <div className="flex h-[120px] flex-col items-center justify-center text-center">
              <div className="text-sm font-medium text-foreground">No progress logged yet</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Progress updates will appear here as the mission advances.
              </div>
              {isLead && (
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="mt-2 text-xs font-medium text-cyan hover:underline"
                >
                  Log first update →
                </button>
              )}
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <ComposedChart data={chartData} margin={{ top: 8, right: 20, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "currentColor" }}
                    tickLine={false}
                    axisLine={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 0.5 }}
                    interval="preserveStartEnd"
                    padding={{ left: 8, right: 8 }}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fontSize: 10, fill: "currentColor" }}
                    tickLine={false}
                    axisLine={false}
                    width={34}
                    ticks={[0, 25, 50, 75, 100]}
                    className="text-muted-foreground"
                  />
                  <Tooltip content={<CustomTooltip milestones={milestones} />} />
                  <defs>
                    <linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={BRAND_ACCENT} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={BRAND_ACCENT} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <ReferenceLine
                    x={todayLabel}
                    stroke={BRAND_ACCENT}
                    strokeWidth={0.5}
                    strokeDasharray="4 3"
                    label={{ value: "Today", position: "top", fontSize: 9, fill: BRAND_ACCENT }}
                  />
                  <Area
                    type="monotone"
                    dataKey="actual"
                    stroke="none"
                    fill="url(#actualFill)"
                    connectNulls
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    stroke={BRAND_ACCENT}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: BRAND_ACCENT, strokeWidth: 0 }}
                    connectNulls
                    isAnimationActive
                    animationDuration={600}
                    animationEasing="ease-out"
                  />
                  <Line
                    type="monotone"
                    dataKey="projected"
                    stroke="currentColor"
                    strokeWidth={1}
                    strokeDasharray="5 3"
                    dot={false}
                    activeDot={false}
                    opacity={0.4}
                    connectNulls
                    isAnimationActive={false}
                  />
                  {milestones.map((m) => {
                    const target = new Date(m.target_date).getTime();
                    let closest = actualPoints[0];
                    let bestDiff = Infinity;
                    for (const p of actualPoints) {
                      const diff = Math.abs(p.timestamp - target);
                      if (diff < bestDiff) {
                        bestDiff = diff;
                        closest = p;
                      }
                    }
                    if (!closest) return null;
                    return (
                      <ReferenceDot
                        key={m.id}
                        x={closest.date}
                        y={closest.pct}
                        r={m.status === "in_progress" ? 6 : 4}
                        fill={
                          m.status === "completed"
                            ? BRAND_ACCENT
                            : m.status === "in_progress"
                              ? "var(--background)"
                              : "var(--muted)"
                        }
                        stroke={
                          m.status === "completed"
                            ? "#ffffff"
                            : m.status === "in_progress"
                              ? BRAND_ACCENT
                              : "var(--border)"
                        }
                        strokeWidth={m.status === "upcoming" ? 1 : 2}
                        strokeDasharray={m.status === "upcoming" ? "3 2" : "0"}
                      />
                    );
                  })}
                </ComposedChart>
              </ResponsiveContainer>

              {/* Milestone pill track */}
              {milestones.length > 0 && (
                <div className="mt-1 flex gap-1.5 overflow-x-auto pb-1">
                  {[...milestones]
                    .sort((a, b) => new Date(a.target_date).getTime() - new Date(b.target_date).getTime())
                    .map((m) => {
                      const cls = MILESTONE_PILL[m.status] ?? MILESTONE_PILL.upcoming;
                      const icon = m.status === "completed" ? "✓" : m.status === "in_progress" ? "●" : "○";
                      const label = m.title.length > 18 ? `${m.title.slice(0, 18)}…` : m.title;
                      return (
                        <div key={m.id} className="relative">
                          <button
                            onClick={() => setOpenMilestoneId((p) => (p === m.id ? null : m.id))}
                            className={`rounded-full border px-2 py-0.5 text-[10px] whitespace-nowrap ${cls}`}
                          >
                            <span className="mr-1">{icon}</span>
                            {label}
                          </button>
                          {openMilestoneId === m.id && (
                            <MilestonePopover
                              milestone={m}
                              isLead={isLead}
                              onClose={() => setOpenMilestoneId(null)}
                              onMarkComplete={() => markCompleteMut.mutate(m.id)}
                              busy={markCompleteMut.isPending}
                            />
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {isDrawerOpen && isLead && (
        <LogUpdateDrawer
          onClose={() => setDrawerOpen(false)}
          milestones={milestones}
          currentPct={currentPct}
          onSubmit={(payload) => logMut.mutate(payload)}
          submitting={logMut.isPending}
        />
      )}
    </div>
  );
}

function CustomTooltip({ active, payload, label, milestones }: any) {
  if (!active || !payload || !payload.length) return null;
  const pct = payload[0]?.value;
  const matchingMilestone = (milestones as MissionMilestone[]).find((m) => {
    const d = new Date(m.target_date);
    return fmtShort(d) === label;
  });
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs">
      <div className="text-muted-foreground">{label}</div>
      <div className="text-foreground font-medium text-[13px]">{pct}% complete</div>
      {matchingMilestone && (
        <>
          <div className="mt-1 italic text-muted-foreground">{matchingMilestone.title}</div>
          <span
            className={`mt-1 inline-block rounded-full border px-1.5 py-0.5 text-[10px] ${MILESTONE_PILL[matchingMilestone.status] ?? MILESTONE_PILL.upcoming}`}
          >
            {matchingMilestone.status.replace("_", " ")}
          </span>
        </>
      )}
    </div>
  );
}

function MilestonePopover({
  milestone,
  isLead,
  onClose,
  onMarkComplete,
  busy,
}: {
  milestone: MissionMilestone;
  isLead: boolean;
  onClose: () => void;
  onMarkComplete: () => void;
  busy: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-milestone-popover]")) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [onClose]);
  return (
    <div
      data-milestone-popover
      className="absolute left-0 top-full z-30 mt-1 w-60 rounded-lg border border-border bg-card p-3 text-xs shadow-lg"
    >
      <div className="text-sm font-medium text-foreground">{milestone.title}</div>
      <span
        className={`mt-1 inline-block rounded-full border px-1.5 py-0.5 text-[10px] ${MILESTONE_PILL[milestone.status] ?? MILESTONE_PILL.upcoming}`}
      >
        {milestone.status.replace("_", " ")}
      </span>
      <div className="mt-2 text-muted-foreground">
        Target: {fmtShort(new Date(milestone.target_date))}
      </div>
      {milestone.completed_at && (
        <div className="text-muted-foreground">
          Completed: {fmtShort(new Date(milestone.completed_at))}
        </div>
      )}
      {milestone.description && (
        <div className="mt-2 text-muted-foreground">{milestone.description}</div>
      )}
      {isLead && milestone.status !== "completed" && (
        <button
          disabled={busy}
          onClick={onMarkComplete}
          className="mt-3 w-full rounded-md border border-border bg-cyan/10 px-2 py-1 text-[11px] font-medium text-cyan hover:bg-cyan/20 disabled:opacity-50"
        >
          {busy ? "Marking…" : "Mark complete"}
        </button>
      )}
    </div>
  );
}

function LogUpdateDrawer({
  onClose,
  milestones,
  currentPct,
  onSubmit,
  submitting,
}: {
  onClose: () => void;
  milestones: MissionMilestone[];
  currentPct: number;
  onSubmit: (p: {
    completion_pct: number;
    note?: string;
    milestone_id?: string | null;
    mark_milestone_complete?: boolean;
    recorded_at?: string;
  }) => void;
  submitting: boolean;
}) {
  const [pct, setPct] = useState<number>(currentPct);
  const [note, setNote] = useState("");
  const [milestoneId, setMilestoneId] = useState<string>("");
  const [markComplete, setMarkComplete] = useState(false);
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const selectedMilestone = milestones.find((m) => m.id === milestoneId) || null;

  const submit = () => {
    if (pct < currentPct) {
      setErr(`Progress cannot go below the last recorded value (${currentPct}%).`);
      return;
    }
    setErr(null);
    const recorded_at = new Date(`${date}T12:00:00Z`).toISOString();
    onSubmit({
      completion_pct: pct,
      note: note || undefined,
      milestone_id: milestoneId || null,
      mark_milestone_complete: markComplete,
      recorded_at,
    });
  };

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-[380px] border-l border-border bg-card flex flex-col">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="text-[15px] font-medium text-foreground">Log progress update</div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Completion (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={pct}
              onChange={(e) => setPct(Math.max(0, Math.min(100, Number(e.target.value))))}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
            />
            <div className="mt-2 h-1 w-full rounded bg-muted/40">
              <div
                className="h-full rounded transition-[width] duration-150"
                style={{ width: `${pct}%`, backgroundColor: BRAND_ACCENT }}
              />
            </div>
            {err && <div className="mt-1 text-[11px] text-destructive">{err}</div>}
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Update date</label>
            <input
              type="date"
              value={date}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Associate with milestone</label>
            <select
              value={milestoneId}
              onChange={(e) => setMilestoneId(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
            >
              <option value="">None</option>
              {milestones.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title} — {fmtShort(new Date(m.target_date))}
                </option>
              ))}
            </select>
            {selectedMilestone && selectedMilestone.status !== "completed" && (
              <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={markComplete}
                  onChange={(e) => setMarkComplete(e.target.checked)}
                />
                Mark this milestone as completed
              </label>
            )}
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Update note</label>
            <textarea
              rows={3}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Briefly describe what was achieved in this period…"
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
            />
            <div className="mt-0.5 text-right text-[10px] text-muted-foreground">{note.length}/500</div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="rounded-md px-4 py-1.5 text-xs font-medium"
            style={{ backgroundColor: BRAND, color: "#f0d78c" }}
          >
            {submitting ? "Saving…" : "Save update"}
          </button>
        </div>
      </div>
    </div>
  );
}
