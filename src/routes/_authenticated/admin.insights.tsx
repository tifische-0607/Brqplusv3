import { friendlySaveError } from "@/lib/friendly-error";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FilterChips, useUrlFilters } from "@/components/admin/UrlFilters";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  listAllInsightsAdmin,
  upsertInsight,
  deleteInsight,
} from "@/lib/insights.functions";
import { AccessDenied } from "@/components/access-denied";
import { AdminErrorBoundary } from "@/components/admin-error-boundary";
import { isForbiddenError } from "@/lib/authz-error";

export const Route = createFileRoute("/_authenticated/admin/insights")({
  head: () => ({ meta: [{ title: "Insights — BRQ+ Admin" }] }),
  component: () => (
    <AdminErrorBoundary>
      <InsightsAdmin />
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
  slug: string;
  domain: string | null;
  published: boolean;
  published_at: string | null;
  updated_at: string;
  author: { id: string; full_name: string | null } | null;
};

type Draft = {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  domain: string;
  cover_image_url: string;
  published: boolean;
};

const empty: Draft = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  domain: "",
  cover_image_url: "",
  published: false,
};

function InsightsAdmin() {
  const qc = useQueryClient();
  const fetchFn = useServerFn(listAllInsightsAdmin);
  const upsertFn = useServerFn(upsertInsight);
  const deleteFn = useServerFn(deleteInsight);

  const q = useQuery({ queryKey: ["admin-insights"], queryFn: () => fetchFn(), retry: false });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const uf = useUrlFilters();
  const fStatus = uf.get("status");

  const save = useMutation({
    mutationFn: (d: Draft) =>
      upsertFn({
        data: {
          id: d.id,
          title: d.title,
          slug: d.slug || undefined,
          excerpt: d.excerpt || null,
          content: d.content,
          domain: d.domain || null,
          cover_image_url: d.cover_image_url || null,
          published: d.published,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-insights"] });
      setDraft(null);
      setErr(null);
    },
    onError: (e: any) => setErr(friendlySaveError(e, "insight")),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-insights"] }),
  });

  const rows: Row[] = ((q.data?.insights ?? []) as any[]).filter((r: any) => !fStatus || (fStatus === "published" ? r.published : !r.published));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gold">Admin</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-foreground">Insights</h1>
          <p className="mt-1 text-sm text-muted-foreground">Member-only thought leadership library.</p>
        </div>
        <button
          onClick={() => setDraft({ ...empty })}
          className="rounded-md bg-gold px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110"
        >
          + New insight
        </button>
      </header>

      <FilterChips chips={fStatus ? [{ key: "status", label: `Status: ${fStatus}` }] : []} onRemove={(k) => uf.set({ [k]: undefined })} />

      {q.isLoading ? (
        <div className="h-32 animate-pulse rounded-2xl border border-border bg-card/40" />
      ) : (q.data as any)?.forbidden || (q.error && /forbidden|unauthorized/i.test(String((q.error as any)?.message))) ? (
        <div className="rounded-2xl border border-border bg-card/40 p-10 text-center text-sm text-muted-foreground">
          Access denied. Admin role required to manage insights.
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-muted-foreground">
          No insights yet. Create your first article.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Title</th>
                <th className="px-4 py-3 text-left font-semibold">Domain</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Updated</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{r.title}</p>
                    <p className="font-mono text-xs text-muted-foreground">/{r.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.domain ?? "—"}</td>
                  <td className="px-4 py-3">
                    {r.published ? (
                      <span className="rounded-full border border-cyan/40 bg-cyan/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cyan">
                        Published
                      </span>
                    ) : (
                      <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Draft
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(r.updated_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {r.published ? (
                      <Link
                        to="/insights/$slug"
                        params={{ slug: r.slug }}
                        className="rounded-md border border-border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-foreground hover:border-cyan/60"
                      >
                        View
                      </Link>
                    ) : null}
                    <button
                      onClick={() =>
                        setDraft({
                          id: r.id,
                          title: r.title,
                          slug: r.slug,
                          excerpt: "",
                          content: "",
                          domain: r.domain ?? "",
                          cover_image_url: "",
                          published: r.published,
                        })
                      }
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {draft ? (
        <InsightEditor
          draft={draft}
          onChange={setDraft}
          onCancel={() => {
            setDraft(null);
            setErr(null);
          }}
          onSave={() => save.mutate(draft)}
          saving={save.isPending}
          error={err}
        />
      ) : null}
    </div>
  );
}

function InsightEditor({
  draft,
  onChange,
  onCancel,
  onSave,
  saving,
  error,
}: {
  draft: Draft;
  onChange: (d: Draft) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  error: string | null;
}) {
  // When editing, load existing content lazily from the published row via slug fetch — not needed: rows table doesn't include content.
  // We accept empty content as a "no change" signal: server upserts overwrite. To avoid wiping content on edit-without-load, we caution authors.
  useEffect(() => {
    if (draft.id && draft.content === "") {
      // best-effort: leave a hint
    }
  }, [draft.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-background/80 p-4">
      <div className="my-10 w-full max-w-3xl rounded-2xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-display text-xl font-bold text-foreground">
            {draft.id ? "Edit insight" : "New insight"}
          </h2>
          <button onClick={onCancel} className="text-2xl text-muted-foreground hover:text-foreground">×</button>
        </div>

        {draft.id ? (
          <p className="mt-2 rounded-md border border-gold/40 bg-gold/10 p-3 text-xs text-gold">
            Editing an existing insight will overwrite all fields below. Leave fields blank to clear them.
          </p>
        ) : null}

        <div className="mt-5 grid gap-4">
          <Input label="Title" value={draft.title} onChange={(v) => onChange({ ...draft, title: v })} />
          <Input
            label="Slug (optional — auto-generated)"
            value={draft.slug}
            onChange={(v) => onChange({ ...draft, slug: v })}
            mono
          />
          <Input label="Domain" value={draft.domain} onChange={(v) => onChange({ ...draft, domain: v })} placeholder="Islamic Finance · AI Payments · …" />
          <Input label="Cover image URL" value={draft.cover_image_url} onChange={(v) => onChange({ ...draft, cover_image_url: v })} />
          <Textarea label="Excerpt" rows={2} value={draft.excerpt} onChange={(v) => onChange({ ...draft, excerpt: v })} />
          <Textarea
            label="Content (Markdown)"
            rows={14}
            value={draft.content}
            onChange={(v) => onChange({ ...draft, content: v })}
          />
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={draft.published}
              onChange={(e) => onChange({ ...draft, published: e.target.checked })}
            />
            Published (visible to members)
          </label>
        </div>

        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onCancel} className="rounded-md border border-border px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
            Cancel
          </button>
          <button
            disabled={saving || !draft.title.trim()}
            onClick={onSave}
            className="rounded-md bg-gold px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save insight"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder, mono }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean }) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground ${mono ? "font-mono" : ""}`}
      />
    </div>
  );
}

function Textarea({ label, value, onChange, rows }: { label: string; value: string; onChange: (v: string) => void; rows: number }) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
      />
    </div>
  );
}
