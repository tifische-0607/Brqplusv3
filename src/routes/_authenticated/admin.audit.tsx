import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listRoleAudit } from "@/lib/admins.functions";
import { isForbiddenError } from "@/lib/authz-error";
import { AccessDenied } from "@/components/access-denied";
import { AdminErrorBoundary } from "@/components/admin-error-boundary";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  head: () => ({ meta: [{ title: "Role Audit Log — BRQ+ Admin" }] }),
  component: () => (
    <AdminErrorBoundary>
      <RoleAuditPage />
    </AdminErrorBoundary>
  ),
});

function RoleAuditPage() {
  const fetchAudit = useServerFn(listRoleAudit);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "grant" | "revoke">("all");

  const q = useQuery({
    queryKey: ["role-audit"],
    queryFn: () => fetchAudit(),
    retry: false,
  });

  const forbidden = isForbiddenError(q.error);
  const errorMsg = q.error instanceof Error ? q.error.message : "";
  const entries = forbidden ? [] : q.data?.entries ?? [];

  const filtered = entries.filter((e: any) => {
    if (filter !== "all" && e.action !== filter) return false;
    if (!search.trim()) return true;
    const s = search.trim().toLowerCase();
    return (
      String(e.target_email ?? "").toLowerCase().includes(s) ||
      String(e.actor_email ?? "").toLowerCase().includes(s) ||
      String(e.role ?? "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="min-h-screen bg-navy px-5 py-12 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gold">Admin</p>
            <h1 className="mt-2 font-display text-3xl font-bold text-foreground">Role Audit Log</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {entries.length} events recorded · {filtered.length} in view (most recent 500)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/admin/users"
              className="rounded-md border border-border px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              Users
            </Link>
            <Link
              to="/admin/leads"
              className="rounded-md border border-border px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              Leads
            </Link>
          </div>
        </div>

        {q.isLoading && <p className="mt-12 text-sm text-muted-foreground">Loading audit log…</p>}

        {q.isError && forbidden && (
          <div className="mt-10">
            <AccessDenied
              fullScreen={false}
              title="Admin role required"
              message="Your account is signed in but has no admin role."
            />
          </div>
        )}

        {q.isError && !forbidden && (
          <p className="mt-10 text-sm text-destructive">Failed to load: {errorMsg}</p>
        )}

        {q.data && (
          <>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <div className="relative w-full md:w-96">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by email or role…"
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-gold"
                />
              </div>
              <div className="flex gap-1 rounded-md border border-border bg-card p-1">
                {(["all", "grant", "revoke"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`rounded px-3 py-1 text-xs font-semibold uppercase tracking-wider transition ${
                      filter === f
                        ? "bg-gold text-navy"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <button
                onClick={() => downloadAuditCsv(filtered)}
                className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                Export CSV
              </button>
            </div>

            <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-charcoal/50 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">When</th>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Target</th>
                      <th className="px-4 py-3">By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                          No audit events match.
                        </td>
                      </tr>
                    )}
                    {filtered.map((e: any) => (
                      <tr key={e.id} className="border-t border-border align-top hover:bg-charcoal/30">
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(e.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                              e.action === "grant"
                                ? "bg-cyan/15 text-cyan border-cyan/40"
                                : "bg-destructive/15 text-destructive border-destructive/40"
                            }`}
                          >
                            {e.action}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex rounded-md border border-border bg-charcoal/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground">
                            {e.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-cyan">
                          {e.target_email || (
                            <span className="font-mono text-xs text-muted-foreground">
                              {e.target_user_id}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {e.actor_email || (
                            <span className="font-mono text-xs">{e.actor_user_id ?? "—"}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function downloadAuditCsv(rows: any[]) {
  const headers = ["When", "Action", "Role", "Target Email", "Target ID", "Actor Email", "Actor ID"];
  const csv = [
    headers.join(","),
    ...rows.map((e) =>
      [
        new Date(e.created_at).toISOString(),
        e.action,
        e.role,
        `"${(e.target_email ?? "").replace(/"/g, '""')}"`,
        e.target_user_id,
        `"${(e.actor_email ?? "").replace(/"/g, '""')}"`,
        e.actor_user_id,
      ].join(","),
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
