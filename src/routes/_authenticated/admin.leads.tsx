import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FilterChips, useUrlFilters } from "@/components/admin/UrlFilters";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listLeads, updateLeadStatus, getLeadHistory } from "@/lib/leads.functions";
import { isForbiddenError } from "@/lib/authz-error";
import { AccessDenied } from "@/components/access-denied";
import { AdminErrorBoundary } from "@/components/admin-error-boundary";



export const Route = createFileRoute("/_authenticated/admin/leads")({
  head: () => ({ meta: [{ title: "Leads — BRQ+ Admin" }] }),
  component: () => (
    <AdminErrorBoundary>
      <LeadsAdmin />
    </AdminErrorBoundary>
  ),

});

const STATUSES = ["new", "contacted", "qualified", "mission_active", "closed", "archived"] as const;
type Status = (typeof STATUSES)[number];

const statusStyles: Record<Status, string> = {
  new: "bg-cyan/15 text-cyan border-cyan/40",
  contacted: "bg-gold/15 text-gold border-gold/40",
  qualified: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
  mission_active: "bg-primary/20 text-primary border-primary/40",
  closed: "bg-muted text-muted-foreground border-border",
  archived: "bg-muted/50 text-muted-foreground border-border",
};

type SortKey = "reference" | "created_at" | "name" | "email" | "mission" | "industry" | "status";
type SortDir = "asc" | "desc";

export default function LeadsAdmin() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchLeads = useServerFn(listLeads);
  const update = useServerFn(updateLeadStatus);
  
  const fetchHistory = useServerFn(getLeadHistory);
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [search, setSearch] = useState("");
  const uf = useUrlFilters();
  const fStatus = uf.get("status");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "created_at", dir: "desc" });
  const [selectedLead, setSelectedLead] = useState<any | null>(null);

  const q = useQuery({
    queryKey: ["leads"],
    queryFn: () => fetchLeads(),
    retry: false,
  });

  const historyQ = useQuery({
    queryKey: ["lead-history", selectedLead?.id],
    queryFn: () => fetchHistory({ data: { leadId: selectedLead.id } }),
    enabled: !!selectedLead,
    retry: false,
  });

  const mutate = useMutation({
    mutationFn: (vars: { id: string; status: Status }) => update({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      if (selectedLead) {
        qc.invalidateQueries({ queryKey: ["lead-history", selectedLead.id] });
      }
    },
  });


  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  const errorMsg = q.error instanceof Error ? q.error.message : "";
  const forbidden = isForbiddenError(q.error);

  const leads = forbidden ? [] : q.data?.leads ?? [];


  const filtered = useMemo(() => {
    let rows = filter === "all" ? leads : leads.filter((l: any) => l.status === filter);
    if (fStatus) rows = rows.filter((l: any) => (fStatus === "open" ? ["new", "contacted", "qualified"].includes(l.status) : l.status === fStatus));
    const qry = search.trim().toLowerCase();
    if (qry) {
      rows = rows.filter((l: any) =>
        [l.reference, l.name, l.email, l.mission, l.industry, l.brief]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(qry)),
      );
    }
    rows = [...rows].sort((a: any, b: any) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      const av = a[sort.key] ?? "";
      const bv = b[sort.key] ?? "";
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
    return rows;
  }, [leads, filter, search, sort, fStatus]);

  const counts = STATUSES.reduce<Record<string, number>>(
    (acc, s) => ({ ...acc, [s]: leads.filter((l: any) => l.status === s).length }),
    { all: leads.length },
  );

  function toggleSort(key: SortKey) {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  function downloadCSV(rows: any[]) {
    const headers = ["Reference", "Received", "Name", "Email", "Mission", "Industry", "Status", "Brief"];
    const csv = [
      headers.join(","),
      ...rows.map((l) =>
        [
          l.reference,
          new Date(l.created_at).toISOString(),
          `"${String(l.name).replace(/"/g, '""')}"`,
          l.email,
          l.mission,
          l.industry ? `"${String(l.industry).replace(/"/g, '""')}"` : "",
          l.status,
          l.brief ? `"${String(l.brief).replace(/"/g, '""')}"` : "",
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `brq-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function SortHeader({ label, sortKey }: { label: string; sortKey: SortKey }) {
    const active = sort.key === sortKey;
    return (
      <th onClick={() => toggleSort(sortKey)} className="cursor-pointer select-none px-4 py-3">
        <span className="inline-flex items-center gap-1">
          {label}
          {active && <span className="text-[10px] text-gold">{sort.dir === "asc" ? "↑" : "↓"}</span>}
        </span>
      </th>
    );
  }

  return (
    <div className="min-h-screen bg-navy px-5 py-12 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gold">Admin</p>
            <h1 className="mt-2 font-display text-3xl font-bold text-foreground">Incoming leads</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {leads.length} total · {filtered.length} in view
            </p>
            <div className="mt-3"><FilterChips chips={fStatus ? [{ key: "status", label: `Status: ${fStatus === "open" ? "open (new, contacted, qualified)" : fStatus}` }] : []} onRemove={(k) => uf.set({ [k]: undefined })} /></div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/admin/missions"
              className="rounded-md border border-border px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              Missions
            </Link>
            <button
              onClick={signOut}
              className="rounded-md border border-border px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              Sign out
            </button>
          </div>
        </div>

        {q.isLoading && <p className="mt-12 text-sm text-muted-foreground">Loading leads…</p>}

        {q.isError && forbidden && (
          <div className="mt-10">
            <AccessDenied
              fullScreen={false}
              title="Admin role required"
              message="Your account is signed in but has no admin role. Contact an existing admin to be granted access."
            />
          </div>
        )}

        {q.isError && !forbidden && <p className="mt-10 text-sm text-destructive">Failed to load: {errorMsg}</p>}


        {q.data && (
          <>
            <div className="mt-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap gap-2">
                <FilterChip label={`All · ${counts.all}`} active={filter === "all"} onClick={() => setFilter("all")} />
                {STATUSES.map((s) => (
                  <FilterChip key={s} label={`${s} · ${counts[s] ?? 0}`} active={filter === s} onClick={() => setFilter(s)} />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-full md:w-72">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name, email, ref, mission…"
                    className="w-full rounded-md border border-border bg-card px-3 py-2 pl-9 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-gold"
                  />
                  <svg className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <button
                  onClick={() => downloadCSV(filtered)}
                  disabled={filtered.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:hover:text-muted-foreground"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export CSV
                </button>
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-charcoal/50 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <SortHeader label="Reference" sortKey="reference" />
                      <SortHeader label="Received" sortKey="created_at" />
                      <SortHeader label="Name" sortKey="name" />
                      <SortHeader label="Email" sortKey="email" />
                      <SortHeader label="Mission" sortKey="mission" />
                      <SortHeader label="Industry" sortKey="industry" />
                      <SortHeader label="Status" sortKey="status" />
                      <th className="px-4 py-3">Linked Mission</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                          No leads match your filters.
                        </td>
                      </tr>
                    )}
                    {filtered.map((l: any) => (
                      <tr
                        key={l.id}
                        onClick={() => setSelectedLead(l)}
                        className="cursor-pointer border-t border-border align-top hover:bg-charcoal/30"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-gold">{l.reference}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString()}</td>
                        <td className="px-4 py-3 font-medium text-foreground">{l.name}</td>
                        <td className="px-4 py-3">
                          <a href={`mailto:${l.email}`} className="text-cyan hover:underline" onClick={(e) => e.stopPropagation()}>
                            {l.email}
                          </a>
                        </td>
                        <td className="px-4 py-3 capitalize text-muted-foreground">{l.mission}</td>
                        <td className="px-4 py-3 text-muted-foreground">{l.industry || "—"}</td>
                        <td className="px-4 py-3">
                          <select
                            value={l.status}
                            disabled={mutate.isPending}
                            onChange={(e) => {
                              e.stopPropagation();
                              mutate.mutate({ id: l.id, status: e.target.value as Status });
                            }}
                            className={`rounded-md border px-2 py-1 text-xs font-semibold uppercase tracking-wider outline-none ${statusStyles[l.status as Status]}`}
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s} className="bg-charcoal text-foreground">
                                {s}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          {l.status === "mission_active" && l.linked_mission && (
                            <Link
                              to="/admin/missions"
                              className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/20"
                            >
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                              </svg>
                              {l.linked_mission.title}
                            </Link>
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

      {selectedLead && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 pt-16"
          onClick={() => setSelectedLead(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-xl border border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-border px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gold">Lead Detail</p>
                <h2 className="mt-1 font-display text-xl font-bold text-foreground">
                  {selectedLead.reference}
                </h2>
              </div>
              <button
                onClick={() => setSelectedLead(null)}
                className="rounded-md p-1 text-muted-foreground hover:text-foreground"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-6 px-6 py-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</p>
                  <p className="mt-1 text-sm text-foreground">{selectedLead.name}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</p>
                  <a href={`mailto:${selectedLead.email}`} className="mt-1 inline-block text-sm text-cyan hover:underline">
                    {selectedLead.email}
                  </a>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mission</p>
                  <p className="mt-1 text-sm capitalize text-foreground">{selectedLead.mission}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Industry</p>
                  <p className="mt-1 text-sm text-foreground">{selectedLead.industry || "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Submitted</p>
                  <p className="mt-1 text-sm text-foreground">{new Date(selectedLead.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Last Updated</p>
                  <p className="mt-1 text-sm text-foreground">{new Date(selectedLead.updated_at).toLocaleString()}</p>
                </div>
              </div>

              {selectedLead.brief && (
                <div className="rounded-lg border border-border bg-charcoal/30 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Project Brief</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{selectedLead.brief}</p>
                </div>
              )}

              {selectedLead.status === "mission_active" && selectedLead.linked_mission && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wider text-primary">Linked Mission</p>
                      <p className="mt-1 font-display text-lg font-bold text-foreground truncate">{selectedLead.linked_mission.title}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {selectedLead.linked_mission.customer && (
                          <span className="rounded-full border border-border bg-card px-2 py-0.5">{selectedLead.linked_mission.customer}</span>
                        )}
                        {selectedLead.linked_mission.country && (
                          <span className="rounded-full border border-border bg-card px-2 py-0.5">{selectedLead.linked_mission.country}</span>
                        )}
                      </div>
                      {selectedLead.linked_mission.description && (
                        <p className="mt-2 text-sm text-foreground line-clamp-3">{selectedLead.linked_mission.description}</p>
                      )}
                    </div>
                    <Link
                      to="/admin/missions"
                      className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110"
                    >
                      View mission
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </Link>
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status History</p>
                {historyQ.isLoading && <p className="mt-2 text-xs text-muted-foreground">Loading history…</p>}
                {historyQ.isError && <p className="mt-2 text-xs text-destructive">Failed to load history</p>}
                {historyQ.data && historyQ.data.history.length === 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">No recorded changes yet.</p>
                )}
                {historyQ.data && historyQ.data.history.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {historyQ.data.history.map((h: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 rounded-md border border-border bg-charcoal/20 px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider border ${statusStyles[h.status as Status]}`}>
                          {h.status}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(h.created_at).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-border px-6 py-4">
              <select
                value={selectedLead.status}
                disabled={mutate.isPending}
                onChange={(e) => {
                  mutate.mutate({ id: selectedLead.id, status: e.target.value as Status });
                  setSelectedLead({ ...selectedLead, status: e.target.value });
                }}
                className={`rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-wider outline-none ${statusStyles[selectedLead.status as Status]}`}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s} className="bg-charcoal text-foreground">
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize tracking-wider transition ${
        active
          ? "border-gold bg-gold/10 text-gold"
          : "border-border bg-card text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
