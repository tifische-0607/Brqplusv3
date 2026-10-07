import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { adminDeleteMission, adminListMissions, adminUpdateMission } from "@/lib/tgn-missions.functions";
import { workstreamLabels } from "@/lib/tgn-workstreams";
import { Button } from "@/components/ui/button";
import { AdminErrorBoundary } from "@/components/admin-error-boundary";
import { AccessDenied } from "@/components/access-denied";
import { isForbiddenError } from "@/lib/authz-error";

export const Route = createFileRoute("/_authenticated/admin/tgn-missions")({
  head: () => ({ meta: [
    { title: "Give Network Missions — BRQ+ Admin" },
    { name: "description", content: "Review and manage missions listed by corporate members on The Give Network." },
    { property: "og:title", content: "Give Network Missions — BRQ+ Admin" },
    { property: "og:description", content: "Review and manage missions listed by corporate members." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <AdminErrorBoundary><AdminTgnMissions /></AdminErrorBoundary>,
});

const FILTERS = ["pending", "approved", "rejected", "closed", "all"] as const;

function AdminTgnMissions() {
  const qc = useQueryClient();
  const list = useServerFn(adminListMissions);
  const update = useServerFn(adminUpdateMission);
  const del = useServerFn(adminDeleteMission);
  const q = useQuery({ queryKey: ["admin-tgn-missions"], queryFn: () => list() });
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});

  if (q.isError && isForbiddenError(q.error)) return <AccessDenied />;
  const rows = (q.data ?? []).filter((m: any) => filter === "all" || m.status === filter);
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-tgn-missions"] });
  async function setStatus(id: string, status: "approved" | "rejected" | "closed" | "pending") {
    try { await update({ data: { id, status, reviewNote: notes[id] ?? undefined } }); toast.success(`Mission ${status}.`); refresh(); }
    catch { toast.error("Could not update mission."); }
  }

  return (
    <div className="space-y-6 p-6">
      <div><p className="text-xs font-semibold uppercase tracking-wider text-gold">The Give Network</p>
        <h1 className="font-display text-3xl font-bold">Mission listings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Approve missions submitted by corporate members before they appear on the public Give Network page.</p></div>
      <div className="flex flex-wrap gap-2">{FILTERS.map((s) => (
        <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} onClick={() => setFilter(s)} className="capitalize">
          {s} ({s === "all" ? q.data?.length ?? 0 : (q.data ?? []).filter((m: any) => m.status === s).length})
        </Button>))}</div>
      {q.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : !rows.length ? <p className="text-sm text-muted-foreground">No missions in this view.</p> : (
        <div className="space-y-4">{rows.map((m: any) => (
          <article key={m.id} className="rounded-md border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p className="font-mono text-xs text-gold">{workstreamLabels[m.workstream]}</p>
                <h2 className="font-display mt-1 text-lg font-semibold">{m.title}</h2>
                <p className="text-sm text-muted-foreground">{m.company_name} · {m.contact_email} · {new Date(m.created_at).toLocaleDateString()}</p></div>
              <span className="rounded-full border border-border px-3 py-1 text-xs capitalize">{m.status}</span>
            </div>
            {(m.location || m.commitment) && <p className="mt-3 text-sm font-semibold">{[m.location, m.commitment].filter(Boolean).join(" · ")}</p>}
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{m.summary}</p>
            <input aria-label="Review note" placeholder={m.review_note || "Review note (optional, visible to the company)"} maxLength={500}
              className="mt-4 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" value={notes[m.id] ?? ""} onChange={(e) => setNotes({ ...notes, [m.id]: e.target.value })} />
            <div className="mt-3 flex flex-wrap gap-2">
              {m.status !== "approved" && <Button size="sm" onClick={() => setStatus(m.id, "approved")}>Approve & publish</Button>}
              {m.status !== "rejected" && <Button size="sm" variant="outline" onClick={() => setStatus(m.id, "rejected")}>Reject</Button>}
              {m.status === "approved" && <Button size="sm" variant="outline" onClick={() => setStatus(m.id, "closed")}>Close listing</Button>}
              {m.status !== "pending" && <Button size="sm" variant="ghost" onClick={() => setStatus(m.id, "pending")}>Move to pending</Button>}
              <Button size="sm" variant="ghost" onClick={async () => { if (!confirm("Delete this mission permanently?")) return; await del({ data: { id: m.id } }); refresh(); }}>Delete</Button>
            </div>
          </article>))}</div>
      )}
    </div>
  );
}
