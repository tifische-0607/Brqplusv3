import { friendlySaveError } from "@/lib/friendly-error";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listAnnouncementsAdmin,
  upsertAnnouncement,
  deleteAnnouncement,
} from "@/lib/insights.functions";
import { AccessDenied } from "@/components/access-denied";
import { AdminErrorBoundary } from "@/components/admin-error-boundary";
import { isForbiddenError } from "@/lib/authz-error";

export const Route = createFileRoute("/_authenticated/admin/announcements")({
  head: () => ({ meta: [{ title: "Announcements — BRQ+ Admin" }] }),
  component: () => (
    <AdminErrorBoundary>
      <AnnouncementsAdmin />
    </AdminErrorBoundary>
  ),
  errorComponent: ({ error }) =>
    isForbiddenError(error) ? <AccessDenied /> : (
      <div role="alert" className="px-5 py-12 text-destructive">Failed to load: {(error as Error).message}</div>
    ),
  notFoundComponent: () => <div className="px-5 py-12 text-muted-foreground">Page not found.</div>,
});

type Row = {
  id: string;
  title: string;
  body: string;
  audience: "all" | "members" | "admins";
  published_at: string;
  created_at: string;
};

type Draft = { id?: string; title: string; body: string; audience: "all" | "members" | "admins" };
const empty: Draft = { title: "", body: "", audience: "members" };

function AnnouncementsAdmin() {
  const qc = useQueryClient();
  const fetchFn = useServerFn(listAnnouncementsAdmin);
  const upsertFn = useServerFn(upsertAnnouncement);
  const deleteFn = useServerFn(deleteAnnouncement);

  const q = useQuery({ queryKey: ["admin-announcements"], queryFn: () => fetchFn(), retry: false });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (d: Draft) => upsertFn({ data: { id: d.id, title: d.title, body: d.body, audience: d.audience } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-announcements"] });
      setDraft(null);
      setErr(null);
    },
    onError: (e: any) => setErr(friendlySaveError(e, "announcement")),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-announcements"] }),
  });

  const rows: Row[] = (q.data?.announcements ?? []) as any;

  if ((q.data as any)?.forbidden) return <AccessDenied />;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gold">Admin</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-foreground">Announcements</h1>
          <p className="mt-1 text-sm text-muted-foreground">Broadcast updates to the collective.</p>
        </div>
        <button
          onClick={() => setDraft({ ...empty })}
          className="rounded-md bg-gold px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110"
        >
          + New announcement
        </button>
      </header>

      {q.isLoading ? (
        <div className="h-32 animate-pulse rounded-2xl border border-border bg-card/40" />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-muted-foreground">
          No announcements yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-base font-semibold text-foreground">{r.title}</h3>
                    <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {r.audience}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">
                    {new Date(r.published_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDraft({ id: r.id, title: r.title, body: r.body, audience: r.audience })}
                    className="rounded-md border border-border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-foreground hover:border-cyan/60"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${r.title}"?`)) remove.mutate(r.id);
                    }}
                    className="rounded-md border border-destructive/40 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-destructive hover:bg-destructive/10"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{r.body}</p>
            </li>
          ))}
        </ul>
      )}

      {draft ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-background/80 p-4">
          <div className="my-10 w-full max-w-2xl rounded-2xl border border-border bg-card p-6">
            <div className="flex items-start justify-between gap-4">
              <h2 className="font-display text-xl font-bold text-foreground">{draft.id ? "Edit announcement" : "New announcement"}</h2>
              <button onClick={() => setDraft(null)} className="text-2xl text-muted-foreground hover:text-foreground">×</button>
            </div>

            <div className="mt-5 grid gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Title</label>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Body</label>
                <textarea
                  rows={6}
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Audience</label>
                <select
                  value={draft.audience}
                  onChange={(e) => setDraft({ ...draft, audience: e.target.value as Draft["audience"] })}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                >
                  <option value="all">All authenticated</option>
                  <option value="members">Members only</option>
                  <option value="admins">Admins only</option>
                </select>
              </div>
            </div>

            {err ? <p className="mt-3 text-sm text-destructive">{err}</p> : null}

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setDraft(null)} className="rounded-md border border-border px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
                Cancel
              </button>
              <button
                disabled={save.isPending || !draft.title.trim() || !draft.body.trim()}
                onClick={() => save.mutate(draft)}
                className="rounded-md bg-gold px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 disabled:opacity-60"
              >
                {save.isPending ? "Saving…" : "Publish"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
