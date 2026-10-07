import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AdminErrorBoundary } from "@/components/admin-error-boundary";
import { AccessDenied } from "@/components/access-denied";
import { isForbiddenError } from "@/lib/authz-error";
import { Panel } from "@/components/admin/DossierParts";
import { DocumentsList } from "@/components/agreements/DocumentsList";
import { FilterChips, useUrlFilters } from "@/components/admin/UrlFilters";
import { listPendingDocuments } from "@/lib/admin-queues.functions";

export const Route = createFileRoute("/_authenticated/admin/documents")({
  head: () => ({ meta: [{ title: "Documents — BRQ+ Admin" }] }),
  component: () => (
    <AdminErrorBoundary>
      <AdminDocuments />
    </AdminErrorBoundary>
  ),
  errorComponent: ({ error }) => (isForbiddenError(error) ? <AccessDenied /> : <div role="alert" className="py-12 text-destructive">{(error as Error).message}</div>),
});

function PendingDocuments() {
  const fn = useServerFn(listPendingDocuments);
  const q = useQuery({ queryKey: ["admin-pending-documents"], queryFn: () => fn(), retry: false });
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (q.isError) return <p role="alert" className="text-sm text-destructive">{(q.error as Error).message}</p>;
  const d = q.data!;
  return (
    <div className="space-y-6">
      <Panel title={`Engagement NDA parties awaiting signature (${d.ndas.length})`}>
        {d.ndas.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : (
          <ul className="divide-y divide-border text-sm">
            {d.ndas.map((p: (typeof d.ndas)[number]) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-foreground">{p.name}{p.email && <span className="ml-2 text-xs text-muted-foreground">{p.email}</span>}</span>
                {p.mission_id ? <Link to="/mission/$missionId" params={{ missionId: p.mission_id }} className="text-xs text-cyan hover:underline">{p.mission_title ?? "Mission"} →</Link> : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title={`Members yet to sign the current Membership Agreement${d.agreement_version ? ` (v${d.agreement_version})` : ""} (${d.members.length})`}>
        {d.members.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : (
          <ul className="divide-y divide-border text-sm">
            {d.members.map((m: (typeof d.members)[number]) => (
              <li key={m.id} className="flex items-center justify-between gap-2 py-2">
                <Link to="/admin/members/$userId" params={{ userId: m.id }} className="text-foreground hover:text-gold">{m.full_name || "Unnamed member"}</Link>
                <span className="text-xs uppercase text-muted-foreground">{m.member_type ?? "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function AdminDocuments() {
  const uf = useUrlFilters();
  const status = uf.get("status");
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-gold">Admin</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-foreground">Documents</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every Engagement NDA signature, including external (non-member) signers, with individual and fully executed PDFs.</p>
      </header>
      <div className="flex flex-wrap items-center gap-3">
        <FilterChips chips={status ? [{ key: "status", label: `Status: ${status}` }] : []} onRemove={(k) => uf.set({ [k]: undefined })} />
        {!status && <button type="button" onClick={() => uf.set({ status: "pending" })} className="rounded-md border border-border px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:border-gold hover:text-gold">Show awaiting signature</button>}
      </div>
      {status === "pending" ? <PendingDocuments /> : (
        <Panel title="Engagement NDA signatures">
          <DocumentsList scope={{ allNdas: true }} showSigner />
        </Panel>
      )}
    </div>
  );
}
