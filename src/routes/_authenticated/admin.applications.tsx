import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listApplications,
  deleteApplication,
  rejectApplication,
} from "@/lib/admin-stats.functions";
import { inviteMember } from "@/lib/onboarding.functions";
import { AccessDenied } from "@/components/access-denied";
import { AdminErrorBoundary } from "@/components/admin-error-boundary";
import { isForbiddenError } from "@/lib/authz-error";
import { MembershipInbox } from "@/components/admin/MembershipInbox";

export const Route = createFileRoute("/_authenticated/admin/applications")({
  head: () => ({ meta: [{ title: "Membership Applications — BRQ+ Admin" }] }),
  component: () => (
    <AdminErrorBoundary>
      <MembershipInbox legacy={<ApplicationsPage />} />
    </AdminErrorBoundary>
  ),
  errorComponent: ({ error }) =>
    isForbiddenError(error) ? <AccessDenied /> : (
      <div role="alert" className="px-5 py-12 text-destructive">Failed to load: {(error as Error).message}</div>
    ),
  notFoundComponent: () => <div className="px-5 py-12 text-muted-foreground">Page not found.</div>,
});

type AppStatus = "pending" | "invited" | "rejected";

type App = {
  id: string;
  reference: string;
  full_name: string;
  email: string;
  linkedin_url: string;
  role_title: string;
  primary_domain: string;
  markets: string[];
  mandate_description: string;
  referral_source: string;
  created_at: string;
  status: AppStatus;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reviewed_by_email: string | null;
  rejection_reason: string | null;
};

const TABS: Array<{ key: "all" | AppStatus; label: string }> = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "invited", label: "Invited" },
  { key: "rejected", label: "Rejected" },
];

function StatusBadge({ status }: { status: AppStatus }) {
  const cls =
    status === "invited"
      ? "border-cyan/50 text-cyan"
      : status === "rejected"
        ? "border-destructive/40 text-destructive"
        : "border-gold/50 text-gold";
  const label = status === "invited" ? "Invited" : status === "rejected" ? "Rejected" : "Pending";
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}>
      {label}
    </span>
  );
}

function ApplicationsPage() {
  const qc = useQueryClient();
  const fetchFn = useServerFn(listApplications);
  const inviteFn = useServerFn(inviteMember);
  const deleteFn = useServerFn(deleteApplication);
  const rejectFn = useServerFn(rejectApplication);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | AppStatus>("all");
  const [inviteMsg, setInviteMsg] = useState<{ id: string; ok: boolean; text: string } | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const q = useQuery({
    queryKey: ["admin-applications", tab],
    queryFn: () => fetchFn(tab === "all" ? { data: {} } : { data: { status: tab } }),
    retry: false,
  });

  const apps: App[] = (q.data?.applications ?? []) as any;
  const selected = apps.find((a) => a.id === selectedId) ?? null;

  const closeModal = () => {
    setSelectedId(null);
    setRejectOpen(false);
    setRejectReason("");
  };

  const invite = useMutation({
    mutationFn: (a: App) =>
      inviteFn({
        data: {
          email: a.email,
          full_name: a.full_name,
          application_id: a.id,
          redirect_to: `${window.location.origin}/onboarding`,
        },
      }),
    onSuccess: (_data, a) => {
      setInviteMsg({ id: a.id, ok: true, text: `Invite sent to ${a.email}` });
      qc.invalidateQueries({ queryKey: ["admin-applications"] });
    },
    onError: (e: any, a) =>
      setInviteMsg({ id: a.id, ok: false, text: e?.message ?? "Could not send invite" }),
  });

  const reject = useMutation({
    mutationFn: (vars: { id: string; reason: string }) =>
      rejectFn({ data: { id: vars.id, reason: vars.reason.trim() || undefined } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-applications"] });
      setRejectOpen(false);
      setRejectReason("");
    },
    onError: (e: any) =>
      setInviteMsg({ id: selectedId ?? "", ok: false, text: e?.message ?? "Could not reject" }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-applications"] });
      closeModal();
    },
    onError: (e: any) =>
      setInviteMsg({ id: selectedId ?? "", ok: false, text: e?.message ?? "Could not delete" }),
  });

  const filtered = apps.filter((a) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      a.full_name.toLowerCase().includes(s) ||
      a.email.toLowerCase().includes(s) ||
      a.primary_domain.toLowerCase().includes(s) ||
      a.role_title.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gold">Admin</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-foreground">Collective applications</h1>
          <p className="mt-1 text-sm text-muted-foreground">{apps.length} shown · review, invite or reject</p>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, domain…"
          className="w-72 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
        />
      </header>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-md border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
              tab === t.key
                ? "border-gold/60 text-gold"
                : "border-border text-muted-foreground hover:border-cyan/60 hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {q.isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-border bg-card/40" />
          ))}
        </div>
      ) : apps.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
          <p className="font-display text-base text-foreground">No applications here.</p>
          <p className="mt-1 text-sm text-muted-foreground">When candidates apply via the public join form, they appear here.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-card text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Reference</th>
                <th className="px-4 py-3 text-left font-semibold">Candidate</th>
                <th className="px-4 py-3 text-left font-semibold">Domain</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Submitted</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{a.reference}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{a.full_name}</p>
                    <p className="text-xs text-muted-foreground">{a.email} · {a.role_title}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{a.primary_domain}</td>
                  <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(a.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => { setSelectedId(a.id); setRejectOpen(false); setRejectReason(""); }}
                      className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-foreground hover:border-cyan/60"
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4"
          onClick={closeModal}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl border border-border bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs text-muted-foreground">{selected.reference}</p>
                <h2 className="mt-1 font-display text-2xl font-bold text-foreground">{selected.full_name}</h2>
                <p className="text-sm text-muted-foreground">{selected.role_title}</p>
                <div className="mt-2"><StatusBadge status={selected.status} /></div>
              </div>
              <button onClick={closeModal} className="text-2xl text-muted-foreground hover:text-foreground">
                ×
              </button>
            </div>

            <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Email" value={selected.email} />
              <Field
                label="LinkedIn"
                value={
                  <a href={selected.linkedin_url} target="_blank" rel="noreferrer" className="text-cyan hover:text-gold">
                    Open profile →
                  </a>
                }
              />
              <Field label="Primary domain" value={selected.primary_domain} />
              <Field label="Markets" value={selected.markets.join(", ") || "—"} />
              <Field label="Referral source" value={selected.referral_source} />
              <Field
                label="Submitted"
                value={new Date(selected.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              />
            </dl>

            <div className="mt-6">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Mandate interest</p>
              <p className="mt-2 whitespace-pre-wrap rounded-lg border border-border bg-background p-4 text-sm text-foreground">
                {selected.mandate_description}
              </p>
            </div>

            {selected.status !== "pending" ? (
              <div className="mt-6 rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
                <span className="text-foreground">
                  {selected.status === "invited" ? "Invited" : "Rejected"}
                </span>{" "}
                by {selected.reviewed_by_email ?? "an admin"}
                {selected.reviewed_at
                  ? ` on ${new Date(selected.reviewed_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`
                  : ""}
                {selected.rejection_reason ? ` · Reason: ${selected.rejection_reason}` : ""}
              </div>
            ) : null}

            {inviteMsg && inviteMsg.id === selected.id ? (
              <p className={`mt-4 text-sm ${inviteMsg.ok ? "text-gold" : "text-destructive"}`}>{inviteMsg.text}</p>
            ) : null}

            {selected.status === "pending" && rejectOpen ? (
              <div className="mt-6">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground" htmlFor="reject-reason">
                  Reason (optional)
                </label>
                <textarea
                  id="reject-reason"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground"
                  placeholder="Shared internally only."
                />
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              {selected.status === "rejected" ? (
                <button
                  onClick={() => {
                    if (confirm(`Delete application ${selected.reference}? This cannot be undone.`)) {
                      remove.mutate(selected.id);
                    }
                  }}
                  disabled={remove.isPending}
                  className="rounded-md border border-destructive/40 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-destructive hover:bg-destructive/10 disabled:opacity-60"
                >
                  {remove.isPending ? "Deleting…" : "Delete"}
                </button>
              ) : null}

              {selected.status === "pending" ? (
                <>
                  {rejectOpen ? (
                    <button
                      onClick={() => reject.mutate({ id: selected.id, reason: rejectReason })}
                      disabled={reject.isPending}
                      className="rounded-md border border-destructive/40 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-destructive hover:bg-destructive/10 disabled:opacity-60"
                    >
                      {reject.isPending ? "Rejecting…" : "Confirm reject"}
                    </button>
                  ) : (
                    <button
                      onClick={() => setRejectOpen(true)}
                      className="rounded-md border border-border px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:border-destructive/40 hover:text-destructive"
                    >
                      Reject
                    </button>
                  )}
                  <button
                    onClick={() => invite.mutate(selected)}
                    disabled={invite.isPending}
                    className="rounded-md bg-gold px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 disabled:opacity-60"
                  >
                    {invite.isPending ? "Sending…" : "Send onboarding invite →"}
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{value}</dd>
    </div>
  );
}
