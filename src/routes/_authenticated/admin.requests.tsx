import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminErrorBoundary } from "@/components/admin-error-boundary";
import { AccessDenied } from "@/components/access-denied";
import { isForbiddenError } from "@/lib/authz-error";
import { FilterChips, useUrlFilters } from "@/components/admin/UrlFilters";
import { listDeletionRequests, markDeletionRequestHandled } from "@/lib/admin-queues.functions";

export const Route = createFileRoute("/_authenticated/admin/requests")({
  head: () => ({ meta: [{ title: "Account Requests — BRQ+ Admin" }] }),
  component: () => (
    <AdminErrorBoundary>
      <Requests />
    </AdminErrorBoundary>
  ),
  errorComponent: ({ error }) => (isForbiddenError(error) ? <AccessDenied /> : <div role="alert" className="py-12 text-destructive">{(error as Error).message}</div>),
});

function Requests() {
  const qc = useQueryClient();
  const fn = useServerFn(listDeletionRequests);
  const markFn = useServerFn(markDeletionRequestHandled);
  const q = useQuery({ queryKey: ["admin-deletion-requests"], queryFn: () => fn(), retry: false });
  const uf = useUrlFilters();
  const status = uf.get("status");
  const mark = useMutation({
    mutationFn: (id: string) => markFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-deletion-requests"] }); qc.invalidateQueries({ queryKey: ["admin-queue-kpis"] }); },
  });
  if (q.isError) return isForbiddenError(q.error) ? <AccessDenied /> : <p role="alert" className="text-destructive">{(q.error as Error).message}</p>;
  const isOpen = (s: string) => s === "pending" || s === "in_progress";
  const rows = (q.data ?? []).filter((r) => !status || (status === "open" ? isOpen(r.status) : r.status === status));
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-gold">Admin</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-foreground">Account deletion requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">Members' requests to delete their BRQ+ account. Mark each as handled once processed.</p>
      </header>
      <div className="flex flex-wrap items-center gap-3">
        <FilterChips chips={status ? [{ key: "status", label: `Status: ${status}` }] : []} onRemove={(k) => uf.set({ [k]: undefined })} />
        {!status && <button type="button" onClick={() => uf.set({ status: "open" })} className="rounded-md border border-border px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:border-gold hover:text-gold">Open only</button>}
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Account deletion requests</caption>
          <thead className="bg-charcoal/50 text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="px-4 py-3">Email</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">Requested</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"><span className="sr-only">Action</span></th></tr></thead>
          <tbody>
            {q.isLoading ? <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Loading…</td></tr>
              : rows.length === 0 ? <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No requests.</td></tr>
              : rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3 text-cyan">{r.email ?? "—"}</td>
                  <td className="px-4 py-3 whitespace-pre-wrap text-muted-foreground">{r.reason ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-xs uppercase text-muted-foreground">{r.status.replace("_", " ")}{r.handled_at ? ` · ${new Date(r.handled_at).toLocaleDateString()}` : ""}</td>
                  <td className="px-4 py-3 text-right">
                    {isOpen(r.status) && <button type="button" disabled={mark.isPending} onClick={() => mark.mutate(r.id)} className="min-h-9 rounded-md border border-gold/60 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gold hover:bg-gold/10 disabled:opacity-50">Mark as handled</button>}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {mark.isError && <p role="alert" className="text-sm text-destructive">{(mark.error as Error).message}</p>}
    </div>
  );
}
