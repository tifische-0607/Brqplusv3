import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listMyCompanyMissions, submitMission, withdrawMission } from "@/lib/tgn-missions.functions";
import { workstreams, workstreamLabels } from "@/lib/tgn-workstreams";
import { Empty, ErrorNote, Panel, btnGold, fmtDate, inputCls, labelCls } from "@/components/members/portal-ui";

const STATUS: Record<string, string> = { pending: "Awaiting BRQ+ review", approved: "Live on The Give Network", rejected: "Not approved", closed: "Closed" };
const blank = { workstream: "C", title: "", summary: "", location: "", commitment: "", contactEmail: "" };

export function CompanyMissionListings() {
  const qc = useQueryClient();
  const list = useServerFn(listMyCompanyMissions);
  const submit = useServerFn(submitMission);
  const withdraw = useServerFn(withdrawMission);
  const q = useQuery({ queryKey: ["company-tgn-missions"], queryFn: () => list() });
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof blank) => (e: any) => setF({ ...f, [k]: e.target.value });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try { await submit({ data: f as any }); toast.success("Mission submitted for BRQ+ review."); setF(blank); qc.invalidateQueries({ queryKey: ["company-tgn-missions"] }); }
    catch (err: any) { toast.error(err?.message?.includes("too_small") ? "Please complete the title and a summary of at least 20 characters." : "Could not submit. Check the fields and try again."); }
    finally { setBusy(false); }
  }

  return (
    <Panel title="The Give Network — list a mission">
      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 sm:col-span-2"><span className={labelCls}>Workstream</span>
          <select className={inputCls} value={f.workstream} onChange={set("workstream")}>{workstreams.map((w) => <option key={w.code} value={w.code}>{workstreamLabels[w.code]}</option>)}</select></label>
        <label className="space-y-1 sm:col-span-2"><span className={labelCls}>Mission title</span><input required minLength={3} maxLength={140} className={inputCls} value={f.title} onChange={set("title")} /></label>
        <label className="space-y-1 sm:col-span-2"><span className={labelCls}>Summary</span><textarea required minLength={20} maxLength={2000} rows={4} className={inputCls} value={f.summary} onChange={set("summary")} /></label>
        <label className="space-y-1"><span className={labelCls}>Location (optional)</span><input maxLength={120} className={inputCls} value={f.location} onChange={set("location")} /></label>
        <label className="space-y-1"><span className={labelCls}>Commitment (optional)</span><input maxLength={160} placeholder="e.g. 3 months · 10 hrs/month" className={inputCls} value={f.commitment} onChange={set("commitment")} /></label>
        <label className="space-y-1 sm:col-span-2"><span className={labelCls}>Contact email (shown publicly)</span><input required type="email" maxLength={255} className={inputCls} value={f.contactEmail} onChange={set("contactEmail")} /></label>
        <div className="sm:col-span-2"><button type="submit" disabled={busy} className={btnGold}>{busy ? "Submitting…" : "Submit for review"}</button></div>
      </form>
      <div className="mt-6 border-t border-border pt-4">
        {q.isLoading ? null : q.isError ? <ErrorNote error={q.error} /> : !q.data!.length ? <Empty>No missions listed yet.</Empty> : (
          <ul className="space-y-3 text-sm">{q.data!.map((m: any) => (
            <li key={m.id} className="flex flex-wrap items-start justify-between gap-2">
              <div><p className="text-foreground">{m.title}</p><p className="text-xs text-muted-foreground">Workstream {m.workstream} · {fmtDate(m.created_at)} · {STATUS[m.status] ?? m.status}</p>
                {m.review_note && <p className="text-xs text-muted-foreground">Note: {m.review_note}</p>}</div>
              {m.status === "pending" && <button type="button" className="text-xs text-muted-foreground underline hover:text-foreground" onClick={async () => { await withdraw({ data: { id: m.id } }); qc.invalidateQueries({ queryKey: ["company-tgn-missions"] }); }}>Withdraw</button>}
            </li>))}</ul>
        )}
      </div>
    </Panel>
  );
}
