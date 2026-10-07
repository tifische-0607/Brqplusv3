import { createFileRoute, Link } from "@tanstack/react-router";
import { FilterChips, useUrlFilters } from "@/components/admin/UrlFilters";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { adminListCompanies } from "@/lib/membership.functions";
import { AdminErrorBoundary } from "@/components/admin-error-boundary";
import { AccessDenied } from "@/components/access-denied";
import { isForbiddenError } from "@/lib/authz-error";
import { downloadCsv } from "@/lib/membership-options";
import { MembershipStatusBadge } from "@/components/admin/MembershipInbox";
import { CreateCompanyButton, CreateMemberButton } from "@/components/admin/AdminCreateForms";

export const Route = createFileRoute("/_authenticated/admin/companies/")({
  head: () => ({ meta: [{ title: "Companies — BRQ+ Admin" }] }),
  component: () => <AdminErrorBoundary><Companies /></AdminErrorBoundary>,
  errorComponent: ({ error }) => isForbiddenError(error) ? <AccessDenied /> : <div role="alert" className="py-12 text-destructive">{(error as Error).message}</div>,
  notFoundComponent: () => <div className="py-12 text-muted-foreground">Page not found.</div>,
});

function Companies() {
  const fetchFn = useServerFn(adminListCompanies);
  const q = useQuery({ queryKey: ["admin-companies"], queryFn: () => fetchFn(), retry: false });
  const [search, setSearch] = useState("");
  const uf = useUrlFilters();
  const st = uf.get("status");
  if (q.isError) return isForbiddenError(q.error) ? <AccessDenied /> : <p className="text-destructive">{(q.error as Error).message}</p>;
  const rows = (q.data ?? []).filter((c: any) => !st || c.membership_status === st).filter((c: any) => !search || `${c.legal_name} ${c.trading_name ?? ""} ${c.country ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-wider text-gold">Admin</p><h1 className="mt-2 font-display text-3xl font-bold text-foreground">Companies</h1></div>
      <div className="flex flex-wrap gap-2"><CreateMemberButton /><button onClick={() => downloadCsv("brq-companies.csv", rows.map(({ company_members, ...c }: any) => ({ ...c, members: company_members?.[0]?.count ?? 0 })))} className="rounded-md border border-border px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:border-gold hover:text-gold">Export CSV</button></div>
    </header>
    <CreateCompanyButton />
    <FilterChips chips={st ? [{ key: "status", label: `Status: ${st}` }] : []} onRemove={(k) => uf.set({ [k]: undefined })} />
    <input className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" placeholder="Search companies" value={search} onChange={e => setSearch(e.target.value)} />
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-left text-sm">
        <thead className="bg-charcoal/50 text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="px-4 py-3">Company</th><th className="px-4 py-3">Country</th><th className="px-4 py-3">Sector</th><th className="px-4 py-3">Members</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Since</th></tr></thead>
        <tbody>
          {q.isLoading ? <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Loading…</td></tr>
            : rows.length === 0 ? <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No companies yet. Approved corporate applications appear here.</td></tr>
            : rows.map((c: any) => <tr key={c.id} className="border-t border-border">
              <td className="px-4 py-3"><Link to="/admin/companies/$companyId" params={{ companyId: c.id }} className="text-foreground hover:text-gold">{c.legal_name}</Link>{c.trading_name && <span className="block text-xs text-muted-foreground">{c.trading_name}</span>}</td>
              <td className="px-4 py-3 text-muted-foreground">{c.country}</td><td className="px-4 py-3 text-muted-foreground">{c.sector}</td>
              <td className="px-4 py-3">{c.company_members?.[0]?.count ?? 0}</td>
              <td className="px-4 py-3"><MembershipStatusBadge status={c.membership_status} /></td>
              <td className="px-4 py-3 text-xs text-muted-foreground">{c.membership_since ? new Date(c.membership_since).toLocaleDateString() : "—"}</td>
            </tr>)}
        </tbody>
      </table>
    </div>
  </div>;
}
