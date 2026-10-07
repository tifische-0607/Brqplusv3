import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminCreateAgreementVersion, adminListAgreements, adminMarkAgreementFinal, adminSetCurrentAgreement, adminSetRequiresResign } from "@/lib/agreements.functions";
import { AdminErrorBoundary } from "@/components/admin-error-boundary";
import { AccessDenied } from "@/components/access-denied";
import { isForbiddenError } from "@/lib/authz-error";
import { Panel } from "@/components/admin/DossierParts";
import { AgreementMarkdown } from "@/components/agreements/AgreementMarkdown";
import { downloadCsv } from "@/lib/membership-options";

export const Route = createFileRoute("/_authenticated/admin/agreements")({
  head: () => ({ meta: [
    { title: "Agreements — BRQ+ Admin" },
    { name: "description", content: "Manage BRQ+ legal document versions, electronic signatures and signing coverage." },
    { property: "og:title", content: "Agreements — BRQ+ Admin" },
    { property: "og:description", content: "Manage BRQ+ legal document versions, electronic signatures and signing coverage." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <AdminErrorBoundary><AgreementsAdmin /></AdminErrorBoundary>,
  errorComponent: ({ error }) => isForbiddenError(error) ? <AccessDenied /> : <div role="alert" className="py-12 text-destructive">{(error as Error).message}</div>,
  notFoundComponent: () => <div className="py-12 text-muted-foreground">Not found.</div>,
});

const input = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none";
const lab = "text-xs font-semibold uppercase tracking-wider text-muted-foreground";
const btn = "rounded-md border border-gold bg-gold/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gold hover:bg-gold/20 disabled:opacity-50";

function AgreementsAdmin() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListAgreements);
  const setCur = useServerFn(adminSetCurrentAgreement);
  const setResign = useServerFn(adminSetRequiresResign);
  const markFinal = useServerFn(adminMarkAgreementFinal);
  const q = useQuery({ queryKey: ["admin-agreements"], queryFn: () => listFn(), retry: false });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-agreements"] });
  const cur = useMutation({ mutationFn: (id: string) => setCur({ data: { id } }), onSuccess: refresh });
  const rs = useMutation({ mutationFn: (v: { id: string; requires_resign: boolean }) => setResign({ data: v }), onSuccess: refresh });
  const fin = useMutation({ mutationFn: (id: string) => markFinal({ data: { id } }), onSuccess: refresh });
  const [preview, setPreview] = useState<string | null>(null);

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (q.isError) return isForbiddenError(q.error) ? <AccessDenied /> : <p className="text-destructive">{(q.error as Error).message}</p>;
  if (q.data!.forbidden) return <AccessDenied />;
  const { versions, coverage } = q.data as Extract<typeof q.data, { forbidden: false }>;
  const mutErr = (cur.error || rs.error || fin.error) as Error | null;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-gold">Admin</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-foreground">Agreements</h1>
        <p className="mt-1 text-sm text-muted-foreground">Versions, electronic signatures and signing coverage. <Link to="/membership/agreement" className="text-cyan hover:underline" target="_blank">Membership Agreement</Link> · <Link to="/terms" className="text-cyan hover:underline" target="_blank">Terms of Service</Link> · <Link to="/privacy" className="text-cyan hover:underline" target="_blank">Privacy Policy</Link></p>
      </header>

      <Panel title={`Signing coverage${coverage.current_version ? ` — version ${coverage.current_version}` : ""}`}
        action={<button className={btn} disabled={!coverage.unsigned.length} onClick={() => downloadCsv(`brq-unsigned-${coverage.current_version ?? "none"}.csv`, coverage.unsigned)}>Export unsigned CSV</button>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-md border border-border p-4"><p className={lab}>Signed</p><p className="mt-1 font-display text-3xl font-bold text-cyan">{coverage.signed}</p></div>
          <div className="rounded-md border border-border p-4"><p className={lab}>Not yet signed</p><p className="mt-1 font-display text-3xl font-bold text-gold">{coverage.unsigned_count}</p></div>
        </div>
        {coverage.unsigned.length > 0 && (
          <ul className="mt-4 max-h-72 space-y-1 overflow-y-auto text-sm">
            {coverage.unsigned.map((m: any) => (
              <li key={m.id} className="flex flex-wrap justify-between gap-2 border-b border-border/50 py-1.5">
                <Link to="/admin/members/$userId" params={{ userId: m.id }} className="text-foreground hover:text-gold">{m.full_name ?? m.email ?? m.id}</Link>
                <span className="text-xs text-muted-foreground">{m.email ?? ""} · {m.member_type}{m.company ? ` · ${m.company}` : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Versions">
        {mutErr && <p className="mb-3 text-sm text-destructive">{mutErr.message}</p>}
        <ul className="space-y-3">
          {versions.map((v: any) => (
            <li key={v.id} className="rounded-md border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{v.doc_type === "engagement_nda" ? "Engagement NDA" : v.doc_type === "privacy_notice" ? "Privacy Policy" : v.doc_type === "terms_of_service" ? "Terms of Service" : "Membership Agreement"}</p>
                  <p className="font-semibold text-foreground">Version {v.version} <span className={`ml-2 rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${v.status === "draft" ? "bg-warning/15 text-warning" : "bg-gold/15 text-gold"}`}>{v.status === "draft" ? "Draft" : "Final"}</span> {v.is_current && <span className="ml-2 rounded bg-gold/15 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-gold">Current</span>}</p>
                  <p className="text-xs text-muted-foreground">{v.title} · Effective {v.effective_date} · Created {new Date(v.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {v.doc_type === "membership_agreement" && <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input type="checkbox" className="accent-gold" checked={v.requires_resign} disabled={rs.isPending} onChange={(e) => rs.mutate({ id: v.id, requires_resign: e.target.checked })} /> Requires re-sign
                  </label>}
                  {v.status === "draft" && <button className={btn} disabled={fin.isPending} onClick={() => { if (confirm(`Mark version ${v.version} as final? The draft banner will be removed.`)) fin.mutate(v.id); }}>Mark as final</button>}
                  <button className={btn} onClick={() => setPreview(preview === v.id ? null : v.id)}>{preview === v.id ? "Hide" : "Preview"}</button>
                  {!v.is_current && <button className={btn} disabled={cur.isPending} onClick={() => { if (confirm(`Make version ${v.version} the current agreement?${v.requires_resign ? " Existing members will be asked to re-sign." : ""}`)) cur.mutate(v.id); }}>Set current</button>}
                </div>
              </div>
              {preview === v.id && <div className="mt-4 max-h-96 overflow-y-auto rounded-md border border-border bg-background p-4"><AgreementMarkdown body={v.body_markdown} highlightToConfirm /></div>}
            </li>
          ))}
        </ul>
      </Panel>

      <NewVersion onCreated={refresh} />
    </div>
  );
}

function NewVersion({ onCreated }: { onCreated: () => void }) {
  const createFn = useServerFn(adminCreateAgreementVersion);
  const [v, setV] = useState({ version: "", title: "BRQ+ Membership Agreement", body_markdown: "", effective_date: new Date().toISOString().slice(0, 10), requires_resign: false, doc_type: "membership_agreement" as "membership_agreement" | "engagement_nda" | "privacy_notice" | "terms_of_service" });
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const m = useMutation({
    mutationFn: () => createFn({ data: v }),
    onSuccess: () => { setV({ ...v, version: "", body_markdown: "" }); onCreated(); },
  });
  return (
    <Panel title="Create a new version">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-3"><label className={lab}>Document type</label><select className={input} value={v.doc_type} onChange={(e) => { const t = e.target.value as typeof v.doc_type; setV({ ...v, doc_type: t, title: t === "engagement_nda" ? "BRQ+ Engagement Non-Disclosure Agreement" : t === "privacy_notice" ? "BRQ+ Privacy Policy" : t === "terms_of_service" ? "BRQ+ Terms of Service" : "BRQ+ Membership Agreement" }); }}><option value="membership_agreement">Membership Agreement</option><option value="engagement_nda">Engagement NDA</option><option value="privacy_notice">Privacy Policy</option><option value="terms_of_service">Terms of Service</option></select></div>
          <div><label className={lab}>Version</label><input className={input} required placeholder="e.g. 1.1" value={v.version} onChange={(e) => setV({ ...v, version: e.target.value })} /></div>
          <div><label className={lab}>Title</label><input className={input} required value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} /></div>
          <div><label className={lab}>Effective date</label><input type="date" className={input} required value={v.effective_date} onChange={(e) => setV({ ...v, effective_date: e.target.value })} /></div>
        </div>
        <div>
          <div className="flex gap-4 text-xs font-semibold uppercase tracking-wider">
            {(["edit", "preview"] as const).map((t) => <button key={t} type="button" onClick={() => setTab(t)} className={tab === t ? "text-gold" : "text-muted-foreground"}>{t === "edit" ? "Markdown" : "Preview"}</button>)}
          </div>
          {tab === "edit"
            ? <textarea className={`${input} mt-2 h-80 font-mono`} required value={v.body_markdown} onChange={(e) => setV({ ...v, body_markdown: e.target.value })} placeholder="# BRQ+ Membership Agreement&#10;&#10;## 1. Definitions…" />
            : <div className="mt-2 h-80 overflow-y-auto rounded-md border border-border bg-background p-4"><AgreementMarkdown body={v.body_markdown || "_Nothing to preview yet._"} highlightToConfirm /></div>}
        </div>
        {v.doc_type === "membership_agreement" && <label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" className="accent-gold" checked={v.requires_resign} onChange={(e) => setV({ ...v, requires_resign: e.target.checked })} /> Existing members must re-sign when this version becomes current</label>}
        {m.isError && <p className="text-sm text-destructive">{(m.error as Error).message}</p>}
        {m.isSuccess && <p className="text-sm text-cyan">Version created. Use "Set current" above to publish it.</p>}
        <button type="submit" className={btn} disabled={m.isPending}>{m.isPending ? "Saving…" : "Create version"}</button>
      </form>
    </Panel>
  );
}
