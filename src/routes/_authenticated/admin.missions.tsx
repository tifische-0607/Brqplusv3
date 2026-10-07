import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FilterChips, useUrlFilters } from "@/components/admin/UrlFilters";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useState, useMemo, useEffect, useRef, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";

import {
  listMissions,
  listExpertsForPicker,
  createMission,
  updateMission,
  deleteMission,
} from "@/lib/missions.functions";
import { getRequestAccessEmail, setRequestAccessEmail } from "@/lib/app-settings.functions";
import { isForbiddenError } from "@/lib/authz-error";
import { AccessDenied } from "@/components/access-denied";
import { AdminErrorBoundary } from "@/components/admin-error-boundary";

const MISSION_STATUSES = ["not_started", "active", "completed", "cancelled"] as const;
type MissionStatus = (typeof MISSION_STATUSES)[number];

const missionStatusLabels: Record<MissionStatus, string> = {
  not_started: "Not Started",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
};

const missionStatusStyles: Record<MissionStatus, string> = {
  not_started: "bg-muted/50 text-muted-foreground border-border",
  active: "bg-cyan/15 text-cyan border-cyan/40",
  completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
  cancelled: "bg-destructive/15 text-destructive border-destructive/40",
};

const priorityStyles: Record<string, string> = {
  P1: "bg-destructive/15 text-destructive border-destructive/40",
  P2: "bg-gold/15 text-gold border-gold/40",
  P3: "bg-cyan/15 text-cyan border-cyan/40",
  P4: "bg-muted/40 text-muted-foreground border-border",
  P5: "bg-muted/40 text-muted-foreground border-border",
};

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

function MissionStatusTimeline({ history }: { history: { status: MissionStatus; created_at: string }[] }) {
  const [open, setOpen] = useState(false);
  if (!history || history.length === 0) return null;

  return (
    <div className="mt-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-cyan transition-colors"
      >
        <svg className={`h-3 w-3 transition-transform ${open ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        Status Timeline ({history.length} change{history.length === 1 ? "" : "s"})
      </button>
      {open && (
        <div className="mt-2 space-y-0">
          {history.map((h, i) => {
            const isLast = i === history.length - 1;
            return (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="inline-block h-2 w-2 rounded-full bg-cyan" />
                  {!isLast && <span className="h-full w-px bg-border" />}
                </div>
                <div className="pb-3">
                  <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${missionStatusStyles[h.status]}`}>
                    {missionStatusLabels[h.status]}
                  </span>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {new Date(h.created_at).toLocaleString()} · {formatRelativeTime(h.created_at)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

type MissionForm = {
  id?: string;
  title: string;
  description: string;
  country: string;
  customer: string;
  status: MissionStatus;
  priority: "P1" | "P2" | "P3" | "P4" | "P5";
  expert_ids: string[];
  lead_executive_id: string | null;
  brief: string;
  estimated_timeline: string;
  estimated_fee: string;
  expected_outcome: string;
};

const EMPTY_FORM: MissionForm = {
  title: "",
  description: "",
  country: "",
  customer: "",
  status: "not_started",
  priority: "P3",
  expert_ids: [],
  lead_executive_id: null,
  brief: "",
  estimated_timeline: "",
  estimated_fee: "",
  expected_outcome: "",
};


const missionsQueryOptions = () =>
  queryOptions({
    queryKey: ["missions"],
    queryFn: () => listMissions(),
    staleTime: 0,
    refetchOnMount: "always",
  });

export const Route = createFileRoute("/_authenticated/admin/missions")({
  head: () => ({ meta: [{ title: "Missions — BRQ+" }] }),
  loader: ({ context }) => context.queryClient.fetchQuery(missionsQueryOptions()),
  component: () => (
    <AdminErrorBoundary>
      <MissionsPage />
    </AdminErrorBoundary>
  ),

  pendingComponent: () => (
    <div className="min-h-screen bg-navy px-5 py-12">
      <p className="text-sm text-muted-foreground">Loading missions…</p>
    </div>
  ),
  errorComponent: ({ error }) =>
    isForbiddenError(error) ? (
      <AccessDenied message="You need an admin role to manage missions." />
    ) : (
      <div role="alert" className="min-h-screen bg-navy px-5 py-12 text-destructive">
        Failed to load missions: {(error as Error).message}
      </div>
    ),

  notFoundComponent: () => (
    <div className="min-h-screen bg-navy px-5 py-12 text-muted-foreground">No missions found.</div>
  ),
});

export default function MissionsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchMissions = useServerFn(listMissions);
  const fetchExperts = useServerFn(listExpertsForPicker);
  const create = useServerFn(createMission);
  const update = useServerFn(updateMission);
  const remove = useServerFn(deleteMission);

  const [search, setSearch] = useState("");
  const uf = useUrlFilters();
  const fStatus = uf.get("status");
  const [editing, setEditing] = useState<MissionForm | null>(null);
  const [channelStatus, setChannelStatus] = useState<"connecting" | "connected" | "disconnected" | "denied">("connecting");
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!data);
    })();
  }, []);

  const missionsQ = useSuspenseQuery(missionsQueryOptions());
  const missions = missionsQ.data.missions;

  const expertsQ = useQuery({
    queryKey: ["mission-experts-picker"],
    queryFn: () => fetchExperts(),
    enabled: isAdmin,
    retry: false,
  });

  // Real-time: refresh mission cards when missions or status history change
  useEffect(() => {
    const handleChange = () => {
      qc.invalidateQueries({ queryKey: ["missions"] });
      setIsSyncing(true);
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(() => setIsSyncing(false), 1500);
    };

    const channel = supabase
      .channel("missions-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "missions" },
        handleChange,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mission_status_history" },
        handleChange,
      )
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          setChannelStatus("connected");
          setBannerDismissed(false);
        } else if (status === "CHANNEL_ERROR") {
          // RLS on realtime.messages rejects non-admins → surface as access denied
          const msg = (err?.message ?? "").toLowerCase();
          if (msg.includes("rls") || msg.includes("permission") || msg.includes("policy") || msg.includes("unauthorized")) {
            setChannelStatus("denied");
          } else {
            setChannelStatus("denied");
          }
        } else if (status === "CLOSED" || status === "TIMED_OUT") {
          setChannelStatus("disconnected");
        } else {
          setChannelStatus("connecting");
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);


  const saveMutation = useMutation({
    mutationFn: async (form: MissionForm) => {
      const payload = {
        title: form.title,
        description: form.description || null,
        country: form.country || null,
        customer: form.customer || null,
        status: form.status,
        priority: form.priority,
        expert_ids: form.expert_ids,
        lead_executive_id: form.lead_executive_id,
        brief: form.brief || null,
        estimated_timeline: form.estimated_timeline || null,
        estimated_fee: form.estimated_fee || null,
        expected_outcome: form.expected_outcome || null,
      };
      if (form.id) {
        return update({ data: { ...payload, id: form.id } });
      }
      return create({ data: payload });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["missions"] });
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["missions"] }),
  });

  const fetchRequestAccessEmail = useServerFn(getRequestAccessEmail);
  const updateRequestAccessEmail = useServerFn(setRequestAccessEmail);
  const accessEmailQ = useQuery({
    queryKey: ["app-settings", "request_access_email"],
    queryFn: () => fetchRequestAccessEmail({}),
  });
  const requestAccessEmail = accessEmailQ.data?.email ?? "admin@brqplus.ai";
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");
  const emailMutation = useMutation({
    mutationFn: (email: string) => updateRequestAccessEmail({ data: { email } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app-settings", "request_access_email"] });
      setEditingEmail(false);
    },
  });


  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = q
      ? missions.filter((m: any) =>
          [m.title, m.customer, m.country, m.description]
            .filter(Boolean)
            .some((v: string) => v.toLowerCase().includes(q)),
        )
      : [...missions];
    if (fStatus) result = result.filter((m: any) => m.status === fStatus);
    result.sort((a: any, b: any) => {
      const pa = parseInt((a.priority ?? "P3").slice(1), 10);
      const pb = parseInt((b.priority ?? "P3").slice(1), 10);
      return pa - pb;
    });
    return result;
  }, [missions, search, fStatus]);

  return (
    <>
    <div className="min-h-screen bg-navy px-5 py-12 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gold">{isAdmin ? "Admin" : "Members"}</p>
            <h1 className="mt-2 font-display text-3xl font-bold text-foreground">Missions</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {missions.length} total · {filtered.length} in view
            </p>
            <div className="mt-3"><FilterChips chips={fStatus ? [{ key: "status", label: `Status: ${fStatus === "open" ? "open (new, contacted, qualified)" : fStatus}` }] : []} onRemove={(k) => uf.set({ [k]: undefined })} /></div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <>
                <button
                  onClick={() => setEditing({ ...EMPTY_FORM })}
                  className="rounded-md bg-gold px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110"
                >
                  New mission
                </button>
              </>
            )}
          </div>
        </div>

        {isAdmin && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-md border border-border bg-background/40 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider text-muted-foreground">Request-access email:</span>
            {editingEmail ? (
              <>
                <input
                  type="email"
                  value={emailDraft}
                  onChange={(e) => setEmailDraft(e.target.value)}
                  className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
                  placeholder="name@example.com"
                />
                <button
                  onClick={() => emailMutation.mutate(emailDraft)}
                  disabled={emailMutation.isPending || !emailDraft}
                  className="rounded bg-gold px-2 py-1 text-xs font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50"
                >
                  {emailMutation.isPending ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => setEditingEmail(false)}
                  className="rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                {emailMutation.isError && (
                  <span className="text-destructive">
                    {emailMutation.error instanceof Error ? emailMutation.error.message : "Failed to save"}
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="text-foreground">{requestAccessEmail}</span>
                <button
                  onClick={() => {
                    setEmailDraft(requestAccessEmail);
                    setEditingEmail(true);
                  }}
                  className="rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  Edit
                </button>
                <span className="text-muted-foreground/70">Shown in the realtime access-restricted banner. Admins only.</span>
              </>
            )}
          </div>
        )}

        {!bannerDismissed && (channelStatus === "denied" || channelStatus === "disconnected") && (
          <div
            role="alert"
            className={`mt-6 flex items-start justify-between gap-3 rounded-lg border p-4 ${
              channelStatus === "denied"
                ? "border-destructive/40 bg-destructive/10"
                : "border-gold/40 bg-gold/10"
            }`}
          >
            <div className="flex items-start gap-3">
              <svg
                className={`mt-0.5 h-5 w-5 flex-shrink-0 ${channelStatus === "denied" ? "text-destructive" : "text-gold"}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                {channelStatus === "denied" ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m0-10a3 3 0 013 3v2H9V10a3 3 0 013-3zm-7 5a7 7 0 1114 0 7 7 0 01-14 0z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
                )}
              </svg>
              <div>
                <p className={`text-sm font-semibold ${channelStatus === "denied" ? "text-destructive" : "text-gold"}`}>
                  {channelStatus === "denied"
                    ? "Realtime access restricted"
                    : "Realtime connection lost"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {channelStatus === "denied"
                    ? <>Your account does not have permission to subscribe to live mission updates. Realtime channels are restricted to admin users. Mission data will still load, but you won't see live changes — <a href={`mailto:${requestAccessEmail}?subject=Request%20Realtime%20Access`} className="underline hover:text-foreground">request access</a>.</>
                    : "We lost the live connection to the server. Mission data may be out of date until the connection is restored."}
                </p>
              </div>
            </div>
            <button
              onClick={() => setBannerDismissed(true)}
              aria-label="Dismiss"
              className="flex-shrink-0 rounded-md p-1 text-muted-foreground hover:bg-background/50 hover:text-foreground"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <div className="mt-8">
          <div className="relative w-full md:w-96">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search title, customer, country…"
                  className="w-full rounded-md border border-border bg-card px-3 py-2 pl-9 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-gold"
                />
                <svg className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
          </div>

            {filtered.length === 0 ? (
              <div className="mt-10 rounded-xl border border-dashed border-border bg-card p-12 text-center">
                <p className="text-sm text-muted-foreground">No missions yet. Create your first mission.</p>
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filtered.map((m: any) => (
                  <article
                    key={m.id}
                    className="flex flex-col rounded-xl border border-border bg-card p-5 hover:border-gold/40 transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="font-display text-lg font-bold text-foreground">{m.title}</h2>
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {new Date(m.created_at).toLocaleDateString()}
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan">
                          {Math.max(0, Math.floor((Date.now() - new Date(m.created_at).getTime()) / (1000 * 60 * 60 * 24)))} man-days
                        </span>
                        {(() => {
                          const lastHist = ((m.status_history ?? []) as { status: MissionStatus; created_at: string }[])[0];
                          const lastUpdated = lastHist?.created_at ?? m.updated_at;
                          return (
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              Last updated {formatRelativeTime(lastUpdated)}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {(() => {
                        const hist = (m.status_history ?? []) as { status: MissionStatus; created_at: string }[];
                        const current = hist[0];
                        const previous = hist[1];
                        const currentStatus = (m.status ?? "not_started") as MissionStatus;
                        const lastChangedAt = current?.created_at ?? m.updated_at;
                        const tooltipLines = [
                          `Status: ${missionStatusLabels[currentStatus]}`,
                          `Updated: ${new Date(lastChangedAt).toLocaleString()}`,
                          previous
                            ? `Previous: ${missionStatusLabels[previous.status as MissionStatus]} (${new Date(previous.created_at).toLocaleString()})`
                            : "Previous: —",
                        ];
                        return (
                          <span
                            className={`cursor-help rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${missionStatusStyles[currentStatus]}`}
                            title={tooltipLines.join("\n")}
                          >
                            {missionStatusLabels[currentStatus]}
                          </span>
                        );
                      })()}
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${priorityStyles[m.priority ?? "P3"]}`}
                      >
                        {m.priority ?? "P3"}
                      </span>
                      <span
                        className="cursor-help text-[10px] text-muted-foreground"
                        title={`Status last updated ${new Date(((m.status_history ?? [])[0]?.created_at) ?? m.updated_at).toLocaleString()}`}
                      >
                        Updated {formatRelativeTime(((m.status_history ?? [])[0]?.created_at) ?? m.updated_at)}
                      </span>
                      {isSyncing && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-cyan animate-pulse">
                          <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Syncing…
                        </span>
                      )}
                      {(channelStatus === "disconnected" || channelStatus === "denied") && (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] text-destructive"
                          title={channelStatus === "denied" ? "Realtime access denied (admin only)" : "Realtime connection lost"}
                        >
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-destructive" />
                          {channelStatus === "denied" ? "No access" : "Offline"}
                        </span>
                      )}
                      <span>
                        <span className="text-foreground/80">Customer:</span> {m.customer || "—"}
                      </span>
                      <span>
                        <span className="text-foreground/80">Country:</span> {m.country || "—"}
                      </span>
                    </div>
                    <div className="mt-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Description</p>
                      <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{m.description || "—"}</p>
                    </div>
                    <div className="mt-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Mission Brief</p>
                      <p className="mt-1 line-clamp-3 text-xs text-foreground/90">{m.brief || "—"}</p>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Est. Timeline</p>
                        <p className="mt-1 text-xs text-cyan">{m.estimated_timeline || "—"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Est. Fee</p>
                        <p className="mt-1 text-xs text-gold">{m.estimated_fee || "—"}</p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Expected Outcome</p>
                      <p className="mt-1 line-clamp-3 text-xs text-foreground/90">{m.expected_outcome || "—"}</p>
                    </div>
                    <div className="mt-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Mission Lead
                      </p>
                      {m.lead_executive ? (
                        <p className="mt-1 text-xs text-foreground">
                          <span className="text-gold">{m.lead_executive.name}</span>
                          {m.lead_executive.role && (
                            <span className="text-muted-foreground"> · {m.lead_executive.role}</span>
                          )}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground/70">Unassigned</p>
                      )}
                    </div>
                    <div className="mt-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Experts deployed ({m.experts.length})
                      </p>
                      {m.experts.length === 0 ? (
                        <p className="mt-1 text-xs text-muted-foreground/70">None assigned</p>
                      ) : (
                        <ul className="mt-2 space-y-1">
                          {m.experts.map((e: any) => (
                            <li key={e.id} className="text-xs text-foreground">
                              <span className="text-cyan">{e.name}</span>
                              {e.role && <span className="text-muted-foreground"> · {e.role}</span>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <MissionStatusTimeline history={(m.status_history ?? []) as { status: MissionStatus; created_at: string }[]} />
                    {isAdmin && (
                      <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-border pt-3">
                        <button
                          onClick={() =>
                            setEditing({
                              id: m.id,
                              title: m.title,
                              description: m.description ?? "",
                              country: m.country ?? "",
                              customer: m.customer ?? "",
                                  status: (m.status ?? "not_started") as MissionStatus,
                                  priority: (m.priority ?? "P3") as MissionForm["priority"],
                                  expert_ids: m.experts.map((e: any) => e.id),
                                  lead_executive_id: m.lead_executive_id ?? null,
                                  brief: m.brief ?? "",
                                  estimated_timeline: m.estimated_timeline ?? "",
                                  estimated_fee: m.estimated_fee ?? "",
                                  expected_outcome: m.expected_outcome ?? "",
                                })
                              }

                          className="rounded-md border border-border px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete mission "${m.title}"?`)) deleteMutation.mutate(m.id);
                          }}
                          className="rounded-md border border-destructive/40 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-destructive hover:bg-destructive/10"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {editing && (
        <MissionSheet
          form={editing}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          onSave={() => saveMutation.mutate(editing)}
          saving={saveMutation.isPending}
          error={saveMutation.error instanceof Error ? saveMutation.error.message : ""}
          experts={expertsQ.data?.experts ?? []}
        />
      )}

    </>
  );
}

function MissionSheet({
  form,
  onChange,
  onClose,
  onSave,
  saving,
  error,
  experts,
}: {
  form: MissionForm;
  onChange: (f: MissionForm) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  error: string;
  experts: any[];
}) {
  function toggleExpert(id: string) {
    onChange({
      ...form,
      expert_ids: form.expert_ids.includes(id)
        ? form.expert_ids.filter((x) => x !== id)
        : [...form.expert_ids, id],
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 pt-16"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gold">Mission sheet</p>
            <h2 className="mt-1 font-display text-xl font-bold text-foreground">
              {form.id ? "Edit mission" : "New mission"}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:text-foreground">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <Field label="Title" required>
            <input
              type="text"
              value={form.title}
              onChange={(e) => onChange({ ...form, title: e.target.value })}
              className="w-full rounded-md border border-border bg-charcoal/30 px-3 py-2 text-sm text-foreground outline-none focus:border-gold"
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Customer">
              <input
                type="text"
                value={form.customer}
                onChange={(e) => onChange({ ...form, customer: e.target.value })}
                className="w-full rounded-md border border-border bg-charcoal/30 px-3 py-2 text-sm text-foreground outline-none focus:border-gold"
              />
            </Field>
            <Field label="Country">
              <input
                type="text"
                value={form.country}
                onChange={(e) => onChange({ ...form, country: e.target.value })}
                className="w-full rounded-md border border-border bg-charcoal/30 px-3 py-2 text-sm text-foreground outline-none focus:border-gold"
              />
            </Field>
          </div>

          <Field label="Status">
            <select
              value={form.status}
              onChange={(e) => onChange({ ...form, status: e.target.value as MissionStatus })}
              className="w-full rounded-md border border-border bg-charcoal/30 px-3 py-2 text-sm text-foreground outline-none focus:border-gold"
            >
              {MISSION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {missionStatusLabels[s]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Priority">
            <select
              value={form.priority}
              onChange={(e) => onChange({ ...form, priority: e.target.value as MissionForm["priority"] })}
              className="w-full rounded-md border border-border bg-charcoal/30 px-3 py-2 text-sm text-foreground outline-none focus:border-gold"
            >
              {["P1", "P2", "P3", "P4", "P5"].map((p) => (
                <option key={p} value={p}>
                  {p} {p === "P1" ? "(Highest)" : p === "P5" ? "(Lowest)" : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Description">
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) => onChange({ ...form, description: e.target.value })}
              className="w-full rounded-md border border-border bg-charcoal/30 px-3 py-2 text-sm text-foreground outline-none focus:border-gold"
            />
          </Field>

          <Field label="Mission Brief">
            <textarea
              rows={3}
              value={form.brief}
              onChange={(e) => onChange({ ...form, brief: e.target.value })}
              placeholder="Scope, objectives, and key context for this mission."
              className="w-full rounded-md border border-border bg-charcoal/30 px-3 py-2 text-sm text-foreground outline-none focus:border-gold"
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="ESTIMATED TIMELINE (WEEKS)">
              <input
                type="text"
                value={form.estimated_timeline}
                onChange={(e) => onChange({ ...form, estimated_timeline: e.target.value })}
                placeholder="e.g. 6–8 weeks"
                className="w-full rounded-md border border-border bg-charcoal/30 px-3 py-2 text-sm text-foreground outline-none focus:border-gold"
              />
            </Field>
            <Field label="ESTIMATED FEE (USD)">
              <input
                type="text"
                value={form.estimated_fee}
                onChange={(e) => onChange({ ...form, estimated_fee: e.target.value })}
                placeholder="e.g. USD 75k"
                className="w-full rounded-md border border-border bg-charcoal/30 px-3 py-2 text-sm text-foreground outline-none focus:border-gold"
              />
            </Field>
          </div>

          <Field label="Expected Outcome">
            <textarea
              rows={3}
              value={form.expected_outcome}
              onChange={(e) => onChange({ ...form, expected_outcome: e.target.value })}
              placeholder="The deliverables and success criteria."
              className="w-full rounded-md border border-border bg-charcoal/30 px-3 py-2 text-sm text-foreground outline-none focus:border-gold"
            />
          </Field>


          <Field label="Mission Lead">
            <select
              value={form.lead_executive_id ?? ""}
              onChange={(e) =>
                onChange({ ...form, lead_executive_id: e.target.value || null })
              }
              className="w-full rounded-md border border-border bg-charcoal/30 px-3 py-2 text-sm text-foreground outline-none focus:border-gold"
            >
              <option value="">— None —</option>
              {experts.map((e: any) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                  {e.role ? ` — ${e.role}` : ""}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              The fractional executive who leads this mission.
            </p>
          </Field>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Experts deployed
            </p>
            <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-border bg-charcoal/20 p-2">
              {experts.length === 0 ? (
                <p className="p-2 text-xs text-muted-foreground">No experts available.</p>
              ) : (
                experts.map((e: any) => {
                  const checked = form.expert_ids.includes(e.id);
                  return (
                    <label
                      key={e.id}
                      className="flex cursor-pointer items-center gap-3 rounded px-2 py-1.5 hover:bg-charcoal/40"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleExpert(e.id)}
                        className="h-4 w-4 accent-gold"
                      />
                      <span className="flex-1 text-sm text-foreground">{e.name}</span>
                      <span className="text-xs text-muted-foreground">{e.role}</span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                        {e.availability}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{form.expert_ids.length} selected</p>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving || !form.title.trim()}
            className="rounded-md bg-gold px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 disabled:opacity-50"
          >
            {saving ? "Saving…" : form.id ? "Save changes" : "Create mission"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label} {required && <span className="text-gold">*</span>}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

