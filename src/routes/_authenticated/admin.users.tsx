import { createFileRoute, Link } from "@tanstack/react-router";
import { FilterChips, useUrlFilters } from "@/components/admin/UrlFilters";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listPortalUsers,
  createPortalUser,
  grantPortalRole,
  revokePortalRole,
} from "@/lib/admins.functions";
import { adminListMembers } from "@/lib/membership.functions";
import { downloadCsv } from "@/lib/membership-options";
import { isForbiddenError } from "@/lib/authz-error";
import { AccessDenied } from "@/components/access-denied";
import { AdminErrorBoundary } from "@/components/admin-error-boundary";
import { CreateMemberButton } from "@/components/admin/AdminCreateForms";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: "Portal Users — BRQ+ Admin" }] }),
  component: () => (
    <AdminErrorBoundary>
      <PortalUsersAdmin />
    </AdminErrorBoundary>
  ),
});

const ROLES = ["admin", "moderator", "collective_member", "user"] as const;
type Role = (typeof ROLES)[number];

const roleStyles: Record<Role, string> = {
  admin: "bg-gold/20 text-gold border-gold/40",
  moderator: "bg-cyan/15 text-cyan border-cyan/40",
  collective_member: "bg-primary/15 text-primary border-primary/40",
  user: "bg-muted text-muted-foreground border-border",
};

function PortalUsersAdmin() {
  const qc = useQueryClient();
  const fetchUsers = useServerFn(listPortalUsers);
  const createFn = useServerFn(createPortalUser);
  const grantFn = useServerFn(grantPortalRole);
  const revokeFn = useServerFn(revokePortalRole);

  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const uf = useUrlFilters();
  const fType = uf.get("type");
  const fStatus = uf.get("status");
  const [formError, setFormError] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["portal-users"],
    queryFn: () => fetchUsers(),
    retry: false,
  });

  const create = useMutation({
    mutationFn: (vars: { email: string; password: string; full_name: string | null; role: Role }) =>
      createFn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal-users"] });
      setShowCreate(false);
      setFormError(null);
    },
    onError: (e: any) => setFormError(e?.message ?? "Could not create user"),
  });

  const grant = useMutation({
    mutationFn: (vars: { user_id: string; role: Role }) => grantFn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portal-users"] }),
  });

  const revoke = useMutation({
    mutationFn: (vars: { user_id: string; role: Role }) => revokeFn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portal-users"] }),
    onError: (e: any) => alert(e?.message ?? "Could not revoke role"),
  });

  const fetchMembers = useServerFn(adminListMembers);
  const mq = useQuery({ queryKey: ["admin-members"], queryFn: () => fetchMembers(), retry: false });
  const memberById = new Map<string, any>((mq.data ?? []).map((m: any) => [m.id, m]));

  const forbidden = isForbiddenError(q.error) || (q.data as any)?.forbidden === true;
  const errorMsg = q.error instanceof Error ? q.error.message : "";
  const users = forbidden ? [] : q.data?.users ?? [];
  const currentUserId = q.data?.current_user_id;

  const filtered = users.filter((u: any) => {
    const m = memberById.get(u.user_id ?? u.id);
    // Collective members are personal members too.
    const effType = m ? (m.company_id || m.companies ? "corporate" : m.member_type === "personal" || m.collective_status === "approved" ? "personal" : m.member_type) : undefined;
    if (fType && effType !== fType) return false;
    if (fStatus && m?.membership_status !== fStatus) return false;
    if (!search.trim()) return true;
    const s = search.trim().toLowerCase();
    return (
      String(u.email).toLowerCase().includes(s) ||
      String(u.full_name ?? "").toLowerCase().includes(s)
    );
  });

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const full_name = String(form.get("full_name") ?? "").trim() || null;
    const role = String(form.get("role") ?? "admin") as Role;
    if (password.length < 12) {
      setFormError("Password must be at least 12 characters.");
      return;
    }
    create.mutate({ email, password, full_name, role });
  }

  return (
    <div className="min-h-screen bg-navy px-5 py-12 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gold">Admin</p>
            <h1 className="mt-2 font-display text-3xl font-bold text-foreground">Portal Users & Roles</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {users.length} users with portal roles · {filtered.length} in view
            </p>
            <div className="mt-3">
              <FilterChips
                chips={[...(fType ? [{ key: "type", label: `Type: ${fType}` }] : []), ...(fStatus ? [{ key: "status", label: `Status: ${fStatus}` }] : [])]}
                onRemove={(k) => uf.set({ [k]: undefined })}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CreateMemberButton />
            <button
              type="button"
              onClick={() => downloadCsv("brq-members.csv", (mq.data ?? []).map(({ companies, ...m }: any) => ({ ...m, company: companies?.legal_name ?? "" })))}
              className="rounded-md border border-border px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              Export members CSV
            </button>
            <Link
              to="/admin/companies"
              className="rounded-md border border-border px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              Companies
            </Link>
            <Link
              to="/admin/leads"
              className="rounded-md border border-border px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              Leads
            </Link>
            <Link
              to="/admin/audit"
              className="rounded-md border border-border px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              Audit
            </Link>
            <Link
              to="/admin/onboarding"
              className="rounded-md border border-border px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              Onboarding
            </Link>
            <button
              onClick={() => {
                setFormError(null);
                setShowCreate(true);
              }}
              className="rounded-md bg-gold px-4 py-2 text-xs font-semibold uppercase tracking-wider text-navy hover:bg-gold/90"
            >
              + Add account
            </button>
          </div>
        </div>

        {q.isLoading && <p className="mt-12 text-sm text-muted-foreground">Loading users…</p>}

        {forbidden && (
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
            <div className="mt-8">
              <div className="relative w-full md:w-96">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search email or name…"
                  className="w-full rounded-md border border-border bg-card px-3 py-2 pl-9 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-gold"
                />
                <svg
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-charcoal/50 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Member type</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Roles</th>
                      <th className="px-4 py-3">Last sign-in</th>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                          No users match your search.
                        </td>
                      </tr>
                    )}
                    {filtered.map((u: any) => {
                      const isSelf = u.user_id === currentUserId;
                      return (
                        <tr key={u.user_id} className="border-t border-border align-top hover:bg-charcoal/30">
                          <td className="px-4 py-3 font-medium text-foreground">
                            {u.full_name || <span className="text-muted-foreground">—</span>}
                            {isSelf && (
                              <span className="ml-2 rounded bg-gold/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gold">
                                you
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-cyan">{u.email}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {(() => { const m = memberById.get(u.user_id); if (!m) return "—"; const co = m.companies; return co ? `Corporate · ${co.trading_name || co.legal_name}` : m.member_type ? "Personal" : "Legacy"; })()}
                          </td>
                          <td className="px-4 py-3 text-xs capitalize text-muted-foreground">
                            {memberById.get(u.user_id)?.membership_status ?? "—"}
                            <Link to="/admin/members/$userId" params={{ userId: u.user_id }} className="mt-1 block normal-case text-cyan hover:underline">Dossier →</Link>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1.5">
                              {u.roles.map((r: Role) => (
                                <span
                                  key={r}
                                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${roleStyles[r]}`}
                                >
                                  {r}
                                  <button
                                    type="button"
                                    title={`Revoke ${r}`}
                                    disabled={revoke.isPending}
                                    onClick={() => {
                                      if (!confirm(`Revoke "${r}" from ${u.email}?`)) return;
                                      revoke.mutate({ user_id: u.user_id, role: r });
                                    }}
                                    className="ml-0.5 opacity-60 hover:opacity-100 disabled:opacity-30"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : "—"}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <RoleAdder
                              userRoles={u.roles}
                              onAdd={(role) => grant.mutate({ user_id: u.user_id, role })}
                              disabled={grant.isPending}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 pt-24"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-border px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gold">New account</p>
                <h2 className="mt-1 font-display text-xl font-bold text-foreground">
                  Create portal user
                </h2>
              </div>
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-md p-1 text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4 px-6 py-5">
              <Field label="Full name (optional)">
                <input
                  name="full_name"
                  type="text"
                  maxLength={200}
                  className="w-full rounded-md border border-border bg-charcoal/40 px-3 py-2 text-sm text-foreground outline-none focus:border-gold"
                />
              </Field>
              <Field label="Email">
                <input
                  name="email"
                  type="email"
                  required
                  maxLength={254}
                  className="w-full rounded-md border border-border bg-charcoal/40 px-3 py-2 text-sm text-foreground outline-none focus:border-gold"
                />
              </Field>
              <Field label="Temporary password (min 12 chars)">
                <input
                  name="password"
                  type="text"
                  required
                  minLength={12}
                  maxLength={128}
                  className="w-full rounded-md border border-border bg-charcoal/40 px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-gold"
                />
              </Field>
              <Field label="Role">
                <select
                  name="role"
                  defaultValue="admin"
                  className="w-full rounded-md border border-border bg-charcoal/40 px-3 py-2 text-sm text-foreground outline-none focus:border-gold"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r} className="bg-charcoal">
                      {r}
                    </option>
                  ))}
                </select>
              </Field>
              {formError && (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {formError}
                </p>
              )}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-md border border-border px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={create.isPending}
                  className="rounded-md bg-gold px-4 py-2 text-xs font-semibold uppercase tracking-wider text-navy hover:bg-gold/90 disabled:opacity-50"
                >
                  {create.isPending ? "Creating…" : "Create account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function RoleAdder({
  userRoles,
  onAdd,
  disabled,
}: {
  userRoles: Role[];
  onAdd: (role: Role) => void;
  disabled: boolean;
}) {
  const available = ROLES.filter((r) => !userRoles.includes(r));
  if (available.length === 0) {
    return <span className="text-xs text-muted-foreground">All roles</span>;
  }
  return (
    <select
      value=""
      disabled={disabled}
      onChange={(e) => {
        const v = e.target.value as Role;
        if (v) onAdd(v);
        e.currentTarget.value = "";
      }}
      className="rounded-md border border-border bg-charcoal/40 px-2 py-1 text-xs text-muted-foreground outline-none hover:text-foreground"
    >
      <option value="">+ Add role…</option>
      {available.map((r) => (
        <option key={r} value={r} className="bg-charcoal text-foreground">
          {r}
        </option>
      ))}
    </select>
  );
}
