import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getMission,
  listMissionDocuments,
  uploadMissionDocument,
  signMissionDocumentUrl,
  deleteMissionDocument,
  updateMissionDocument,
  setMissionStatus,
} from "@/lib/workspace.functions";
import { listChannelMessages, sendChannelMessage } from "@/lib/chat.functions";
import { ProjectStatusChart } from "@/components/ProjectStatusChart";
import { MissionProgressPanel } from "@/components/MissionProgressPanel";
import { BillingPanel } from "@/components/BillingPanel";
import { listBillingMilestones } from "@/lib/billing.functions";
import { NdaPanel } from "@/components/agreements/NdaPanel";

export const Route = createFileRoute("/_authenticated/mission/$missionId")({
  head: () => ({ meta: [{ title: "Mission workspace — BRQ+" }] }),
  component: WorkspacePage,
});

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  in_review: "In review",
  not_started: "Not started",
  on_hold: "On hold",
  completed: "Completed",
  cancelled: "Cancelled",
};
const STATUS_STYLES: Record<string, string> = {
  active: "bg-cyan/15 text-cyan border-cyan/40",
  in_review: "bg-gold/15 text-gold border-gold/40",
  not_started: "bg-muted/40 text-muted-foreground border-border",
  on_hold: "bg-muted/40 text-muted-foreground border-border",
  completed: "bg-cyan/15 text-cyan border-cyan/40",
  cancelled: "bg-destructive/15 text-destructive border-destructive/40",
};

const COLOR_MAP: Record<string, string> = {
  green: "bg-cyan/80 text-background",
  blue: "bg-cyan/70 text-background",
  amber: "bg-gold/80 text-background",
  teal: "bg-cyan/60 text-background",
};

const CATEGORIES = ["Brief", "Regulatory", "Financial Model", "Report", "Other"] as const;
type Category = (typeof CATEGORIES)[number];

const FILE_TYPE_COLORS: Record<string, string> = {
  pdf: "bg-destructive/15 text-destructive",
  xlsx: "bg-cyan/15 text-cyan",
  xls: "bg-cyan/15 text-cyan",
  csv: "bg-cyan/15 text-cyan",
  docx: "bg-cyan/15 text-cyan",
  doc: "bg-cyan/15 text-cyan",
  pptx: "bg-gold/15 text-gold",
  ppt: "bg-gold/15 text-gold",
  png: "bg-cyan/15 text-cyan",
  jpg: "bg-cyan/15 text-cyan",
  jpeg: "bg-cyan/15 text-cyan",
  txt: "bg-muted text-muted-foreground",
};

function fileExt(name: string) {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toLowerCase() : "";
}

function formatSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function relTime(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return `${Math.floor(day / 30)}mo ago`;
}

function initialsFor(p: { full_name: string | null; initials: string | null }) {
  if (p.initials) return p.initials.slice(0, 2).toUpperCase();
  if (!p.full_name) return "··";
  return p.full_name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");
}

function inferCategory(name: string): Category {
  const n = name.toLowerCase();
  if (/\b(brief|scope|sow)\b/.test(n)) return "Brief";
  if (/(regulation|bnm|mas|license|compliance)/.test(n)) return "Regulatory";
  if (/(model|financial|p&l|forecast|unit econ)/.test(n)) return "Financial Model";
  if (/(report|findings|summary|deck)/.test(n)) return "Report";
  return "Other";
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const result = r.result as string;
      res(result.split(",")[1] ?? "");
    };
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function WorkspacePage() {
  const { missionId } = useParams({ from: "/_authenticated/mission/$missionId" });
  const qc = useQueryClient();

  const fetchMission = useServerFn(getMission);
  const fetchDocs = useServerFn(listMissionDocuments);
  const upload = useServerFn(uploadMissionDocument);
  const signUrl = useServerFn(signMissionDocumentUrl);
  const removeDoc = useServerFn(deleteMissionDocument);
  const updateDoc = useServerFn(updateMissionDocument);
  const updateStatus = useServerFn(setMissionStatus);
  const fetchMessages = useServerFn(listChannelMessages);
  const sendMessage = useServerFn(sendChannelMessage);

  const missionQ = useQuery({
    queryKey: ["mission", missionId],
    queryFn: () => fetchMission({ data: { id: missionId } }),
  });
  const docsQ = useQuery({
    queryKey: ["mission-docs", missionId],
    queryFn: () => fetchDocs({ data: { mission_id: missionId } }),
    enabled: !!missionQ.data && !missionQ.data.nda_blocked,
  });
  const channelId = missionQ.data?.channel_id ?? null;
  const messagesQ = useQuery({
    queryKey: ["mission-messages", channelId],
    queryFn: () => fetchMessages({ data: { channel_id: channelId! } }),
    enabled: !!channelId && !missionQ.data?.nda_blocked,
  });

  const [activeTab, setActiveTab] = useState<"repo" | "chat">("repo");
  const [workspaceTab, setWorkspaceTab] = useState<"workspace" | "billing" | "nda">("workspace");

  // Billing badge count
  const fetchBilling = useServerFn(listBillingMilestones);
  const billingQ = useQuery({
    queryKey: ["billing", missionId],
    queryFn: () => fetchBilling({ data: { mission_id: missionId } }),
    enabled: !!missionId,
  });
  const billingBadge = (() => {
    const ms = billingQ.data?.milestones ?? [];
    const overdue = ms.filter((m: any) => m.status === "overdue").length;
    if (overdue > 0) return { text: `${overdue} overdue`, cls: "bg-red-500/15 text-red-500" };
    const due = ms.filter((m: any) => m.status === "due").length;
    if (due > 0) return { text: `${due} due`, cls: "bg-amber-500/15 text-amber-500" };
    return null;
  })();
  const [activeFilter, setActiveFilter] = useState<"All" | Category>("All");
  const [details, setDetails] = useState(false);
  const [input, setInput] = useState("");
  const [reconnecting, setReconnecting] = useState(false);

  const sendMutation = useMutation({
    mutationFn: (content: string) => sendMessage({ data: { channel_id: channelId!, content } }),
    onSuccess: () => {
      setInput("");
      qc.invalidateQueries({ queryKey: ["mission-messages", channelId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to send"),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) =>
      updateStatus({ data: { mission_id: missionId, status: status as any } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mission", missionId] });
      toast.success("Status updated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  // Realtime: subscribe to messages
  useEffect(() => {
    if (!channelId) return;
    setReconnecting(false);
    const channel = supabase
      .channel(`mission-msgs-${channelId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${channelId}` },
        () => qc.invalidateQueries({ queryKey: ["mission-messages", channelId] }),
      )
      .subscribe((status) => {
        if (status === "CLOSED" || status === "TIMED_OUT" || status === "CHANNEL_ERROR") {
          setReconnecting(true);
        } else if (status === "SUBSCRIBED") {
          setReconnecting(false);
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, qc]);

  // Realtime: docs
  useEffect(() => {
    const channel = supabase
      .channel(`mission-docs-${missionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "documents", filter: `mission_id=eq.${missionId}` },
        () => qc.invalidateQueries({ queryKey: ["mission-docs", missionId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [missionId, qc]);

  if (missionQ.isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading mission…</div>;
  }
  if (missionQ.isError) {
    const msg = missionQ.error instanceof Error ? missionQ.error.message : "Error";
    if (/forbidden/i.test(msg)) {
      return (
        <div className="mx-auto mt-20 max-w-md rounded-xl border border-border bg-card p-8 text-center">
          <h2 className="font-display text-lg font-medium text-foreground">Access restricted</h2>
          <p className="mt-2 text-sm text-muted-foreground">You aren&apos;t a member of this mission.</p>
          <Link to="/dashboard" className="mt-4 inline-block text-xs font-semibold uppercase tracking-wider text-cyan">
            ← Back to MY MISSIONS
          </Link>
        </div>
      );
    }
    return <div className="p-8 text-sm text-destructive">{msg}</div>;
  }
  const mission = missionQ.data!.mission as any;
  const members = missionQ.data!.members;
  const myRole = missionQ.data!.my_role;
  const canManageStatus = myRole === "admin" || myRole === "brqplus_lead";

  return (
    <div className="-mx-5 -my-8 flex h-[calc(100dvh-4rem)] flex-col lg:-mx-8">
      {/* Top bar */}
      <div className="flex h-[90px] shrink-0 items-center justify-between gap-3 overflow-hidden border-b border-border bg-card/50 px-5 lg:px-8">
        <div className="flex items-center gap-2 text-sm">
          <Link to="/dashboard" className="text-muted-foreground hover:text-cyan">
            MY MISSIONS
          </Link>
          <span className="text-muted-foreground">›</span>
          <span className="max-w-[24ch] truncate font-medium text-foreground" title={mission.title}>
            {mission.title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STATUS_STYLES[mission.status] ?? STATUS_STYLES.not_started}`}
          >
            {STATUS_LABELS[mission.status] ?? mission.status}
          </span>
          {mission.mission_type && (
            <span className="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground">
              {mission.mission_type}
            </span>
          )}
          {mission.contract_fee != null && (
            <span className="rounded-full border border-border bg-gold/15 px-2 py-0.5 text-[10px] font-semibold text-gold">
              {mission.contract_currency ?? "MYR"} {Number(mission.contract_fee).toLocaleString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {members.slice(0, 4).map((u: any) => (
              <span
                key={u.user_id}
                title={`${u.full_name ?? "Member"} · ${u.role}`}
                className={`flex h-7 w-7 items-center justify-center rounded-full border border-card text-[10px] font-semibold ${COLOR_MAP[u.avatar_color ?? "green"] ?? "bg-muted text-foreground"}`}
              >
                {initialsFor(u)}
              </span>
            ))}
            {members.length > 4 && (
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-card bg-muted text-[10px] text-muted-foreground">
                +{members.length - 4}
              </span>
            )}
          </div>
          <button
            onClick={() => setDetails(true)}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            Details
          </button>
        </div>
      </div>

      {/* Workspace / Billing tab switcher */}
      <div className="flex items-center border-b border-border bg-card/50 px-4 lg:px-6">
        <button
          onClick={() => setWorkspaceTab("workspace")}
          className={`flex h-10 items-center gap-1.5 px-4 text-[13px] ${workspaceTab === "workspace" ? "border-b-2 border-foreground font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          Workspace
        </button>
        <button
          onClick={() => setWorkspaceTab("billing")}
          className={`flex h-10 items-center gap-1.5 px-4 text-[13px] ${workspaceTab === "billing" ? "border-b-2 border-foreground font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          Billing
          {billingBadge && (
            <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] ${billingBadge.cls}`}>
              {billingBadge.text}
            </span>
          )}
        </button>
        <button
          onClick={() => setWorkspaceTab("nda")}
          className={`flex h-10 items-center gap-1.5 px-4 text-[13px] ${workspaceTab === "nda" ? "border-b-2 border-foreground font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          NDA
          {missionQ.data!.nda_blocked && <span className="ml-1 rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] text-warning">sign</span>}
        </button>
      </div>

      {workspaceTab === "nda" ? (
        <div className="overflow-y-auto p-5 lg:p-8"><NdaPanel missionId={missionId} /></div>
      ) : workspaceTab === "billing" ? (
        <BillingPanel missionId={missionId} userRole={myRole as any} missionTitle={mission.title} />
      ) : missionQ.data!.nda_blocked ? (
        <div className="mx-auto mt-16 max-w-md rounded-xl border border-border bg-card p-8 text-center">
          <h2 className="font-display text-lg font-medium text-foreground">Engagement NDA required</h2>
          <p className="mt-2 text-sm text-muted-foreground">You need to sign this mission&apos;s BRQ+ Engagement NDA before you can open its documents and chat.</p>
          <button onClick={() => setWorkspaceTab("nda")} className="mt-4 rounded-md bg-gold px-4 py-2 text-xs font-semibold uppercase tracking-wider text-primary-foreground">View NDA</button>
        </div>
      ) : (
      <>
      {/* Mission progress panel */}
      <MissionProgressPanel
        missionId={missionId}
        userRole={myRole}
        missionCreatedAt={mission.created_at}
        targetDays={mission.target_days ?? 45}
      />

      {/* Project status linear chart */}
      <ProjectStatusChart missionId={missionId} />

      {/* Mobile tabs */}
      <div className="flex border-b border-border bg-card/30 lg:hidden">
        <button
          onClick={() => setActiveTab("repo")}
          className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wider ${activeTab === "repo" ? "border-b-2 border-cyan text-foreground" : "text-muted-foreground"}`}
        >
          Repository
        </button>
        <button
          onClick={() => setActiveTab("chat")}
          className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wider ${activeTab === "chat" ? "border-b-2 border-cyan text-foreground" : "text-muted-foreground"}`}
        >
          Chat
        </button>
      </div>

      {/* Split panels */}
      <div className="flex min-h-[60vh] flex-1">
        {/* Repository */}
        <div
          className={`min-h-0 flex-col border-r border-border lg:flex lg:w-[56%] ${activeTab === "repo" ? "flex flex-1" : "hidden"}`}
        >
          <RepositoryPanel
            missionId={missionId}
            myRole={myRole}
            docs={docsQ.data?.documents ?? []}
            loading={docsQ.isLoading}
            activeFilter={activeFilter}
            setActiveFilter={setActiveFilter}
            onUpload={async (file, category) => {
              try {
                const b64 = await fileToBase64(file);
                const res = await upload({
                  data: {
                    mission_id: missionId,
                    file_name: file.name,
                    file_size: file.size,
                    file_type: file.type || "application/octet-stream",
                    category,
                    file_base64: b64,
                  },
                });
                qc.invalidateQueries({ queryKey: ["mission-docs", missionId] });
                qc.invalidateQueries({ queryKey: ["mission-messages", channelId] });
                if ((res as any).renamed) toast("Renamed automatically (a file with that name existed).");
                else toast.success(`Uploaded ${file.name}`);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Upload failed");
              }
            }}
            onDownload={async (id) => {
              try {
                const res = await signUrl({ data: { document_id: id } });
                window.open(res.url, "_blank", "noopener");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Download failed");
              }
            }}
            onDelete={async (id) => {
              if (!confirm("Delete this document?")) return;
              try {
                await removeDoc({ data: { document_id: id } });
                qc.invalidateQueries({ queryKey: ["mission-docs", missionId] });
                toast.success("Deleted");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Delete failed");
              }
            }}
            onChangeCategory={async (id, category) => {
              try {
                await updateDoc({ data: { document_id: id, category } });
                qc.invalidateQueries({ queryKey: ["mission-docs", missionId] });
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Failed");
              }
            }}
          />
        </div>

        {/* Chat */}
        <div
          className={`min-h-0 flex-col bg-background/20 lg:flex lg:w-[44%] ${activeTab === "chat" ? "flex flex-1" : "hidden"}`}
        >
          <ChatPanel
            messages={messagesQ.data?.messages ?? []}
            loading={messagesQ.isLoading}
            input={input}
            setInput={setInput}
            onSend={() => {
              if (!input.trim()) return;
              sendMutation.mutate(input.trim());
            }}
            sending={sendMutation.isPending}
            members={members}
            reconnecting={reconnecting}
            disabled={!channelId}
          />
        </div>
      </div>
      </>
      )}

      {/* Details slide-over */}
      {details && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/50" onClick={() => setDetails(false)} />
          <div className="w-full max-w-md overflow-y-auto bg-card p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <h3 className="font-display text-lg font-medium">{mission.title}</h3>
              <button onClick={() => setDetails(false)} className="text-muted-foreground hover:text-foreground">
                ✕
              </button>
            </div>
            <dl className="mt-6 space-y-4 text-sm">
              {mission.mission_type && (
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Type</dt>
                  <dd className="mt-1 text-foreground">{mission.mission_type}</dd>
                </div>
              )}
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Status</dt>
                <dd className="mt-1">
                  {canManageStatus ? (
                    <select
                      value={mission.status}
                      onChange={(e) => statusMutation.mutate(e.target.value)}
                      className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                    >
                      {Object.entries(STATUS_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-foreground">{STATUS_LABELS[mission.status] ?? mission.status}</span>
                  )}
                </dd>
              </div>
              {mission.brief && (
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Brief</dt>
                  <dd className="mt-1 whitespace-pre-wrap text-foreground">{mission.brief}</dd>
                </div>
              )}
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Members</dt>
                <dd className="mt-1 space-y-1">
                  {members.map((u: any) => (
                    <div key={u.user_id} className="flex items-center gap-2 text-sm">
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold ${COLOR_MAP[u.avatar_color ?? "green"] ?? "bg-muted text-foreground"}`}
                      >
                        {initialsFor(u)}
                      </span>
                      <span className="text-foreground">{u.full_name ?? "—"}</span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{u.role}</span>
                    </div>
                  ))}
                  {members.length === 0 && (
                    <span className="text-xs text-muted-foreground">No members added yet.</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Created</dt>
                <dd className="mt-1 text-foreground">{new Date(mission.created_at).toLocaleDateString()}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}

function RepositoryPanel({
  missionId: _missionId,
  myRole,
  docs,
  loading,
  activeFilter,
  setActiveFilter,
  onUpload,
  onDownload,
  onDelete,
  onChangeCategory,
}: {
  missionId: string;
  myRole: string;
  docs: any[];
  loading: boolean;
  activeFilter: "All" | Category;
  setActiveFilter: (c: "All" | Category) => void;
  onUpload: (file: File, category: Category) => Promise<void>;
  onDownload: (id: string) => void;
  onDelete: (id: string) => void;
  onChangeCategory: (id: string, c: Category) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ file: File; category: Category }[]>([]);

  const filtered = activeFilter === "All" ? docs : docs.filter((d) => d.category === activeFilter);
  const grouped = useMemo(() => {
    const g: Record<string, any[]> = {};
    for (const d of filtered) (g[d.category] ||= []).push(d);
    return g;
  }, [filtered]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h2 className="text-sm font-medium text-foreground">📁 MISSION REPOSITORY</h2>
        <button
          onClick={() => fileRef.current?.click()}
          className="rounded-md bg-cyan px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-navy hover:brightness-110"
        >
          ↑ Upload
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".pdf,.docx,.xlsx,.pptx,.png,.jpg,.jpeg,.csv,.txt"
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            const oversized = files.filter((f) => f.size > 50 * 1024 * 1024);
            if (oversized.length) {
              toast.error(`${oversized[0].name} exceeds 50MB`);
            }
            const valid = files.filter((f) => f.size <= 50 * 1024 * 1024);
            setPending(valid.map((f) => ({ file: f, category: inferCategory(f.name) })));
            if (e.target) e.target.value = "";
          }}
        />
      </div>

      <div className="flex gap-1.5 overflow-x-auto border-b border-border px-5 py-2">
        {(["All", ...CATEGORIES] as const).map((c) => (
          <button
            key={c}
            onClick={() => setActiveFilter(c)}
            className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider ${
              activeFilter === c ? "border-cyan text-cyan" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading && <p className="text-xs text-muted-foreground">Loading documents…</p>}
        {!loading && filtered.length === 0 && (
          <p className="rounded-lg border border-dashed border-border bg-card/40 p-8 text-center text-xs text-muted-foreground">
            No documents yet. Upload your first file to get started.
          </p>
        )}
        {Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} className="mb-6">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">{cat}</p>
            <div className="space-y-2">
              {items.map((d) => {
                const ext = fileExt(d.file_name);
                const canDelete =
                  myRole === "admin" || myRole === "brqplus_lead" || d.uploader === undefined;
                return (
                  <div
                    key={d.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                  >
                    <span
                      className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-[10px] font-bold uppercase ${FILE_TYPE_COLORS[ext] ?? "bg-muted text-muted-foreground"}`}
                    >
                      {ext || "·"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-foreground">{d.file_name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {d.uploader?.full_name ?? "Unknown"} · {relTime(d.created_at)} · {formatSize(d.file_size)}
                      </p>
                    </div>
                    <DocMenu
                      myRole={myRole}
                      doc={d}
                      onDownload={() => onDownload(d.id)}
                      onDelete={() => onDelete(d.id)}
                      onChangeCategory={(c) => onChangeCategory(d.id, c)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {pending.length > 0 && (
        <div className="border-t border-border bg-card/80 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Confirm uploads ({pending.length})
          </p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {pending.map((p, i) => (
              <div key={i} className="flex items-center gap-2 rounded border border-border bg-background/30 p-2 text-xs">
                <span className="flex-1 truncate text-foreground">{p.file.name}</span>
                <span className="text-muted-foreground">{formatSize(p.file.size)}</span>
                <select
                  value={p.category}
                  onChange={(e) => {
                    const copy = [...pending];
                    copy[i] = { ...copy[i], category: e.target.value as Category };
                    setPending(copy);
                  }}
                  className="rounded border border-border bg-background px-1 py-0.5 text-xs"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={async () => {
                const items = pending;
                setPending([]);
                for (const p of items) {
                  await onUpload(p.file, p.category);
                }
              }}
              className="rounded-md bg-cyan px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-navy hover:brightness-110"
            >
              Upload {pending.length}
            </button>
            <button
              onClick={() => setPending([])}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DocMenu({
  myRole,
  doc,
  onDownload,
  onDelete,
  onChangeCategory,
}: {
  myRole: string;
  doc: any;
  onDownload: () => void;
  onDelete: () => void;
  onChangeCategory: (c: Category) => void;
}) {
  const [open, setOpen] = useState(false);
  const canDelete = myRole === "admin" || myRole === "brqplus_lead";
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
        aria-label="Actions"
      >
        ⋯
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-7 z-20 w-48 rounded-md border border-border bg-card py-1 shadow-lg">
            <button
              onClick={() => {
                setOpen(false);
                onDownload();
              }}
              className="block w-full px-3 py-1.5 text-left text-xs hover:bg-muted/40"
            >
              Download
            </button>
            <div className="px-3 py-1.5">
              <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Change category</p>
              <select
                defaultValue={doc.category}
                onChange={(e) => {
                  onChangeCategory(e.target.value as Category);
                  setOpen(false);
                }}
                className="w-full rounded border border-border bg-background px-1 py-0.5 text-xs"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            {canDelete && (
              <button
                onClick={() => {
                  setOpen(false);
                  onDelete();
                }}
                className="block w-full border-t border-border px-3 py-1.5 text-left text-xs text-destructive hover:bg-destructive/10"
              >
                Delete
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ChatPanel({
  messages,
  loading,
  input,
  setInput,
  onSend,
  sending,
  members,
  reconnecting,
  disabled,
}: {
  messages: any[];
  loading: boolean;
  input: string;
  setInput: (s: string) => void;
  onSend: () => void;
  sending: boolean;
  members: any[];
  reconnecting: boolean;
  disabled: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [meId, setMeId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMeId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  const memberById = useMemo(() => {
    const m = new Map<string, any>();
    for (const u of members) m.set(u.user_id, u);
    return m;
  }, [members]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h2 className="text-sm font-medium text-foreground">💬 MISSION CHAT</h2>
        {reconnecting && <span className="text-[11px] text-gold">Reconnecting…</span>}
      </div>
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {loading && <p className="text-xs text-muted-foreground">Loading messages…</p>}
        {!loading && messages.length === 0 && (
          <p className="rounded-lg border border-dashed border-border bg-card/40 p-6 text-center text-xs text-muted-foreground">
            No messages yet. Start the conversation with your mission team.
          </p>
        )}
        {messages.map((m) => {
          const mine = m.user_id === meId;
          const member = memberById.get(m.user_id);
          const profile = m.profile ?? member ?? null;
          return (
            <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              <div
                className={`max-w-[78%] rounded-xl px-3 py-2 text-sm ${
                  mine
                    ? "bg-cyan/15 text-cyan rounded-tr-[3px]"
                    : "border border-border bg-card text-foreground rounded-tl-[3px]"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
              </div>
              <p className={`mt-1 text-[10px] text-muted-foreground ${mine ? "text-right" : ""}`}>
                {!mine && (profile?.full_name ?? "Member")} {!mine && "· "}
                {relTime(m.created_at)}
              </p>
            </div>
          );
        })}
      </div>
      <div className="border-t border-border px-3 py-3">
        <div className="flex items-end gap-2 rounded-lg border border-border bg-card p-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder="Message the mission team…"
            rows={1}
            disabled={disabled || sending}
            className="max-h-32 flex-1 resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={onSend}
            disabled={!input.trim() || sending || disabled}
            className="rounded-md bg-cyan px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-navy disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
