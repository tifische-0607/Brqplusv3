import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listExecutives,
  createExecutive,
  updateExecutive,
  deleteExecutive,
  type Executive,
} from "@/lib/executives.functions";
import { listMemberDirectory } from "@/lib/member-portal.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  ExecutiveCard,
  AVAILABILITY,
  availLabel,
  type Availability,
} from "@/components/ExecutiveCard";
import { ExecutiveForm, type ExecFormValues } from "@/components/ExecutiveForm";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/directory")({
  head: () => ({ meta: [{ title: "Member directory — BRQ+" }] }),
  component: DirectoryTabs,
});

function DirectoryTabs() {
  const [tab, setTab] = useState<"collective" | "members" | "companies">("collective");
  const execFn = useServerFn(listExecutives);
  const dirFn = useServerFn(listMemberDirectory);
  const eq = useQuery({ queryKey: ["executives"], queryFn: () => execFn() });
  const dq = useQuery({ queryKey: ["member-directory"], queryFn: () => dirFn() });
  const counts = {
    collective: eq.data?.executives?.length,
    members: dq.data?.members?.length,
    companies: dq.data?.companies?.length,
  };
  return (
    <div>
      <div role="tablist" className="mb-6 flex gap-2 border-b border-border">
        {(["collective", "members", "companies"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm ${tab === t ? "border-gold text-foreground" : "border-transparent text-muted-foreground hover:text-cyan"}`}>
            {t === "collective" ? "The Collective" : t === "members" ? "Members" : "Companies"}
            {counts[t] !== undefined && <span className="ml-2 text-xs text-muted-foreground">{counts[t]}</span>}
          </button>
        ))}
      </div>
      {tab === "collective" ? <DirectoryPage /> : <MemberDirectory view={tab} />}
    </div>
  );
}

function MemberDirectory({ view }: { view: "members" | "companies" }) {
  const fetchFn = useServerFn(listMemberDirectory);
  const q = useQuery({ queryKey: ["member-directory"], queryFn: () => fetchFn() });
  const [type, setType] = useState<"all" | "personal" | "corporate" | "collective">("all");
  const [search, setSearch] = useState("");
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (q.isError) return <p className="text-sm text-destructive">{(q.error as Error).message}</p>;
  if ((q.data as any)?.locked) return <p role="status" className="rounded-xl border border-warning bg-warning/10 p-5 text-sm">The BRQ+ directory unlocks once your membership invoice is paid.</p>;
  const s = search.toLowerCase();
  if (view === "companies") {
    const rows = (q.data?.companies ?? []).filter((c: any) => !s || `${c.legal_name} ${c.trading_name ?? ""} ${c.sector ?? ""} ${c.country ?? ""}`.toLowerCase().includes(s));
    return (
      <div className="space-y-4">
        <input className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" placeholder="Search companies" value={search} onChange={(e) => setSearch(e.target.value)} />
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">No active corporate members yet.</p> : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((c: any) => (
              <article key={c.id} className="group relative cursor-pointer rounded-xl border border-border bg-card p-5 transition-colors hover:border-gold/60">
                <h3 className="font-display text-lg font-bold text-foreground"><Link to="/directory/companies/$companyId" params={{ companyId: c.id }} className="rounded hover:text-gold focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-gold after:absolute after:inset-0 after:rounded-xl">{c.trading_name || c.legal_name}</Link></h3>
                <p className="mt-1 text-xs text-muted-foreground">{[c.sector, c.hq_city, c.country].filter(Boolean).join(" · ")}</p>
                {c.description && <p className="mt-3 line-clamp-4 text-sm text-muted-foreground">{c.description}</p>}
                {c.website && <a href={c.website} target="_blank" rel="noopener noreferrer" className="relative z-10 mt-3 inline-block text-xs text-cyan hover:underline focus-visible:outline-2 focus-visible:outline-gold">Website →</a>}
              </article>
            ))}
          </div>
        )}
      </div>
    );
  }
  const seen = new Set<string>();
  const rows = (q.data?.members ?? []).filter((m: any) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    const corp = !!m.companies;
    const coll = m.collective_status === "approved";
    if (type === "personal" && corp) return false;
    if (type === "corporate" && !corp) return false;
    if (type === "collective" && !coll) return false;
    return !s || `${m.full_name ?? ""} ${m.job_title ?? ""} ${m.organisation ?? ""} ${m.companies?.legal_name ?? ""} ${m.country ?? ""}`.toLowerCase().includes(s);
  });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <input className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" placeholder="Search members" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select aria-label="Member type" className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" value={type} onChange={(e) => setType(e.target.value as any)}>
          <option value="all">All</option><option value="personal">Personal</option><option value="corporate">Corporate</option><option value="collective">The Collective</option>
        </select>
      </div>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">No members match.</p> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((m: any) => (
            <article key={m.id} className="group relative cursor-pointer rounded-xl border border-border bg-card p-5 transition-colors hover:border-gold/60">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gold">{m.companies ? `Corporate · ${m.companies.trading_name || m.companies.legal_name}` : "Personal"}</p>
                {m.collective_status === "approved" && <span className="rounded-full border border-gold/50 bg-gold/10 px-2 py-0.5 text-[10px] font-semibold text-gold">The Collective</span>}
              </div>
              <h3 className="mt-2 font-display text-lg font-bold text-foreground"><Link to="/members/$memberId" params={{ memberId: m.id }} className="rounded hover:text-gold focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-gold after:absolute after:inset-0 after:rounded-xl">{m.full_name ?? "Member"}</Link></h3>
              <p className="text-sm text-muted-foreground">{[m.job_title, m.organisation].filter(Boolean).join(" · ")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{[m.sector, m.country].filter(Boolean).join(" · ")}</p>
              {m.expertise?.length > 0 && <p className="mt-3 text-xs text-muted-foreground">{m.expertise.slice(0, 4).join(" · ")}</p>}
              {(m.email || m.phone || m.linkedin_url) && <p className="mt-2 flex flex-wrap gap-x-3 text-xs">{m.email && <a href={`mailto:${m.email}`} className="relative z-10 text-gold hover:underline focus-visible:outline-2 focus-visible:outline-gold">{m.email}</a>}{m.phone && <span className="text-muted-foreground">{m.phone}</span>}{m.linkedin_url && <a href={m.linkedin_url} target="_blank" rel="noopener noreferrer" className="relative z-10 text-gold hover:underline focus-visible:outline-2 focus-visible:outline-gold">LinkedIn</a>}</p>}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function DirectoryPage() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listExecutives);
  const createFn = useServerFn(createExecutive);
  const updateFn = useServerFn(updateExecutive);
  const deleteFn = useServerFn(deleteExecutive);

  const q = useQuery({ queryKey: ["executives"], queryFn: () => fetchList() });

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | Availability>("all");
  const [isAdmin, setIsAdmin] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Executive | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!data);
    })();
  }, []);

  const members: Executive[] = q.data?.executives ?? [];

  const filtered = useMemo(() => {
    let rows = filter === "all" ? members : members.filter((m) => m.availability === filter);
    const qry = search.trim().toLowerCase();
    if (qry) {
      rows = rows.filter((m) =>
        [m.name, m.role, m.bio, ...(m.expertise ?? [])]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(qry)),
      );
    }
    return rows;
  }, [members, search, filter]);

  function openCreate() {
    setEditing(null);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(m: Executive) {
    setEditing(m);
    setFormError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setFormError(null);
  }

  const createM = useMutation({
    mutationFn: (data: ExecFormValues) => createFn({ data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["executives"] });
      closeModal();
    },
    onError: (e: any) => setFormError(e?.message ?? "Failed to create"),
  });

  const updateM = useMutation({
    mutationFn: (vars: { id: string; patch: ExecFormValues }) => updateFn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["executives"] });
      closeModal();
    },
    onError: (e: any) => setFormError(e?.message ?? "Failed to update"),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["executives"] }),
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Collective directory</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Fractional executives in the BRQ+ collective · {members.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, role, expertise…"
            className="w-72 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none"
          />
          {isAdmin && (
            <button
              onClick={openCreate}
              className="rounded-md border border-gold bg-gold/10 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gold hover:bg-gold/20"
            >
              + Add
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {(["all", ...AVAILABILITY] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s as any)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
              filter === s
                ? "border-gold bg-gold/10 text-gold"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {s === "all" ? "all" : availLabel[s as Availability]}
          </button>
        ))}
      </div>

      {q.isLoading && <p className="mt-8 text-sm text-muted-foreground">Loading members…</p>}
      {q.isError && (
        <p className="mt-8 text-sm text-destructive">
          {q.error instanceof Error ? q.error.message : "Failed to load directory"}
        </p>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((m) => (
          <ExecutiveCard
            key={m.id}
            executive={m}
            linkToProfile
            actions={
              isAdmin ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openEdit(m)}
                    className="text-xs font-semibold hover:border-cyan hover:text-cyan"
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (confirm(`Delete ${m.name}?`)) deleteM.mutate(m.id);
                    }}
                    className="text-xs font-semibold text-muted-foreground hover:border-destructive hover:text-destructive"
                  >
                    Delete
                  </Button>
                </>
              ) : undefined
            }
          />
        ))}
        {q.isSuccess && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">No members match your filters.</p>
        )}
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={closeModal}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-card p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-foreground">
                {editing ? "Edit executive" : "Add executive"}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <ExecutiveForm
              key={editing?.id ?? "new"}
              initial={editing}
              submitLabel={editing ? "Save changes" : "Create"}
              submitting={createM.isPending || updateM.isPending}
              onCancel={closeModal}
              externalError={formError}
              onSubmit={(values) => {
                setFormError(null);
                if (editing) updateM.mutate({ id: editing.id, patch: values });
                else createM.mutate(values);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
