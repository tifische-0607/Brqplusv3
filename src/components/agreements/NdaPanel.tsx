import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createMissionNda, getMissionNda, getNdaPrefill, renewNdaLink } from "@/lib/nda.functions";
import { getDocumentPdfUrl, getExecutedNdaUrl } from "@/lib/documents.functions";
import { DraftBanner } from "./AgreementMarkdown";

const input = "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none";
const lab = "text-xs font-semibold uppercase tracking-wider text-muted-foreground";
const btn = "rounded-md border border-gold bg-gold/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gold hover:bg-gold/20 disabled:opacity-50";
const KIND: Record<string, string> = { member: "Member", customer: "Customer", facilitator: "Facilitator", external: "External" };

export function NdaPanel({ missionId }: { missionId: string }) {
  const fn = useServerFn(getMissionNda);
  const q = useQuery({ queryKey: ["mission-nda", missionId], queryFn: () => fn({ data: { mission_id: missionId } }) });
  const [creating, setCreating] = useState(false);
  const dlExec = useServerFn(getExecutedNdaUrl);
  const dlParty = useServerFn(getDocumentPdfUrl);
  const renew = useServerFn(renewNdaLink);
  const qc = useQueryClient();

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading NDA…</p>;
  if (q.isError) return <p className="text-sm text-destructive">{(q.error as Error).message}</p>;
  const d = q.data!;

  async function openUrl(p: Promise<{ url: string }>) {
    try {
      window.open((await p).url, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    }
  }

  if (!d.nda) {
    return (
      <div className="max-w-3xl rounded-xl border border-border bg-card p-6">
        <h2 className="font-display text-lg font-bold text-foreground">Engagement NDA</h2>
        <p className="mt-1 text-sm text-muted-foreground">No NDA has been created for this mission yet.</p>
        {d.can_manage && !creating && (
          <button className={`${btn} mt-4`} disabled={!d.current_version} onClick={() => setCreating(true)}>Create NDA</button>
        )}
        {d.can_manage && !d.current_version && <p className="mt-2 text-xs text-destructive">No current Engagement NDA version is published.</p>}
        {creating && <CreateNda missionId={missionId} onDone={() => { setCreating(false); qc.invalidateQueries({ queryKey: ["mission-nda", missionId] }); qc.invalidateQueries({ queryKey: ["mission", missionId] }); }} />}
      </div>
    );
  }

  const n = d.nda;
  const signed = n.parties.filter((p) => p.status === "signed").length;
  return (
    <div className="max-w-4xl space-y-4">
      {n.version_status === "draft" && <DraftBanner />}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">Engagement NDA · version {n.version}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {n.status === "executed" ? `Executed ${new Date(n.executed_at!).toLocaleString()}` : `${signed} of ${n.parties.length} parties signed`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${n.status === "executed" ? "bg-gold/15 text-gold" : "bg-warning/15 text-warning"}`}>{n.status === "executed" ? "Executed" : "Awaiting signatures"}</span>
            {n.status === "executed" && n.has_executed_pdf && <button className={btn} onClick={() => openUrl(dlExec({ data: { nda_id: n.id } }))}>Executed PDF</button>}
          </div>
        </div>
        {d.my_party_id && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-gold/40 bg-gold/10 p-4">
            <p className="text-sm text-foreground">Your signature is needed on this NDA.</p>
            <Link to="/nda/$partyId" params={{ partyId: d.my_party_id }} className="rounded-md bg-gold px-4 py-2 text-xs font-semibold uppercase tracking-wider text-primary-foreground">Review & sign</Link>
          </div>
        )}
        <ul className="mt-5 divide-y divide-border/60 text-sm">
          {n.parties.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div>
                <p className="text-foreground">{p.name}{p.is_me ? " (you)" : ""}</p>
                <p className="text-xs text-muted-foreground">{KIND[p.party_kind]}{p.company_name ? ` · ${p.company_name}` : ""}{p.country ? ` · ${p.country}` : ""}{p.email ? ` · ${p.email}` : ""}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {p.status === "signed" ? (
                  <span className="text-xs text-gold">Signed {new Date(p.signed_at!).toLocaleDateString()}</span>
                ) : (
                  <span className="text-xs text-warning">Pending</span>
                )}
                {p.status === "signed" && p.has_pdf && d.can_manage && (
                  <button className="text-xs font-semibold uppercase tracking-wider text-gold hover:underline" onClick={() => openUrl(dlParty({ data: { kind: "nda", id: p.id } }))}>PDF</button>
                )}
                {p.sign_token && (
                  <button
                    className="text-xs font-semibold uppercase tracking-wider text-gold hover:underline"
                    onClick={async () => {
                      await navigator.clipboard.writeText(`${window.location.origin}/sign/${p.sign_token}`);
                      toast.success("Signing link copied — send it to the signer.");
                    }}
                  >
                    Copy signing link
                  </button>
                )}
                {(p.token_expired || (d.can_manage && p.sign_token)) && (
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={async () => {
                      try {
                        await renew({ data: { party_id: p.id } });
                        qc.invalidateQueries({ queryKey: ["mission-nda", missionId] });
                        toast.success("New 14-day link created.");
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Failed");
                      }
                    }}
                  >
                    {p.token_expired ? "Link expired — renew" : "Renew link"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {d.can_manage && n.parties.some((p) => p.sign_token) && (
          <p className="mt-3 text-xs text-muted-foreground">Emails are not sent automatically yet. Copy each external signer's link and send it to them; links are single-use and expire after 14 days.</p>
        )}
      </div>
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-display text-base font-bold text-foreground">Schedule</h3>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-[200px_1fr]">
          {[
            ["Engagement / mission", `${n.schedule.mission_title}${n.schedule.reference ? ` (${n.schedule.reference})` : ""}`],
            ["Program", n.schedule.program || "—"],
            ["Purpose", n.schedule.purpose || "—"],
            ["Start date", "Date of first signature"],
            ["Confidentiality period", n.schedule.confidentiality_period],
            ["Special terms", n.schedule.special_terms || "None"],
          ].map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="whitespace-pre-wrap text-foreground">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

type Party = { party_kind: "member" | "customer" | "external"; user_id: string | null; name: string; email: string | null; company_name: string | null; country: string | null };

function CreateNda({ missionId, onDone }: { missionId: string; onDone: () => void }) {
  const prefillFn = useServerFn(getNdaPrefill);
  const createFn = useServerFn(createMissionNda);
  const q = useQuery({ queryKey: ["nda-prefill", missionId], queryFn: () => prefillFn({ data: { mission_id: missionId } }) });
  const [sch, setSch] = useState<any>(null);
  const [parties, setParties] = useState<Party[] | null>(null);
  const m = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          mission_id: missionId,
          schedule: { ...sch, reference: sch.reference || null, program: sch.program || null, purpose: sch.purpose || null, special_terms: sch.special_terms || null },
          parties: parties!.map((p) => ({ ...p, email: p.user_id ? null : p.email?.trim() || null, company_name: p.company_name || null, country: p.country || null })),
        },
      }),
    onSuccess: () => { toast.success("NDA created. Signing requests are ready."); onDone(); },
  });
  useEffect(() => {
    if (q.data && !sch) {
      setSch(q.data.schedule);
      setParties(q.data.parties as Party[]);
    }
  }, [q.data, sch]);

  if (q.isLoading) return <p className="mt-4 text-sm text-muted-foreground">Preparing…</p>;
  if (q.isError) return <p className="mt-4 text-sm text-destructive">{(q.error as Error).message}</p>;
  const s = sch ?? q.data!.schedule;
  const ps: Party[] = parties ?? (q.data!.parties as Party[]);
  const setS = (patch: any) => setSch({ ...s, ...patch });
  const setP = (i: number, patch: Partial<Party>) => setParties(ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  return (
    <form className="mt-6 space-y-5" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className={lab}>Engagement / mission</label><input className={input} required value={s.mission_title} onChange={(e) => setS({ mission_title: e.target.value })} /></div>
        <div><label className={lab}>Reference</label><input className={input} value={s.reference ?? ""} onChange={(e) => setS({ reference: e.target.value })} /></div>
        <div><label className={lab}>Program</label><input className={input} value={s.program ?? ""} onChange={(e) => setS({ program: e.target.value })} /></div>
        <div><label className={lab}>Confidentiality period</label><input className={input} required value={s.confidentiality_period} onChange={(e) => setS({ confidentiality_period: e.target.value })} /></div>
      </div>
      <div><label className={lab}>Purpose</label><textarea className={`${input} h-24`} value={s.purpose ?? ""} onChange={(e) => setS({ purpose: e.target.value })} /></div>
      <div><label className={lab}>Special terms (optional)</label><textarea className={`${input} h-20`} value={s.special_terms ?? ""} onChange={(e) => setS({ special_terms: e.target.value })} /></div>

      <div>
        <p className={lab}>Parties</p>
        <p className="mt-1 text-xs text-muted-foreground">BRQ Plus Sdn Bhd is added automatically as facilitator. Members sign in the portal; others get a secure signing link.</p>
        <ul className="mt-3 space-y-3">
          {ps.map((p, i) => (
            <li key={i} className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[110px_1fr_1fr_1fr_1fr_auto]">
              <span className="self-center text-xs text-muted-foreground">{KIND[p.party_kind]}{p.user_id ? " · member" : ""}</span>
              <input className={input} placeholder="Full name" required value={p.name} disabled={!!p.user_id} onChange={(e) => setP(i, { name: e.target.value })} />
              <input className={input} placeholder="Company" value={p.company_name ?? ""} onChange={(e) => setP(i, { company_name: e.target.value })} />
              <input className={input} placeholder="Country" value={p.country ?? ""} onChange={(e) => setP(i, { country: e.target.value })} />
              {p.user_id ? <span className="self-center text-xs text-muted-foreground">Signs in portal</span> : <input className={input} type="email" required placeholder="Email" value={p.email ?? ""} onChange={(e) => setP(i, { email: e.target.value })} />}
              <button type="button" className="self-center text-xs text-muted-foreground hover:text-destructive" onClick={() => setParties(ps.filter((_, j) => j !== i))}>Remove</button>
            </li>
          ))}
        </ul>
        <button type="button" className={`${btn} mt-3`} onClick={() => setParties([...ps, { party_kind: "external", user_id: null, name: "", email: "", company_name: "", country: "" }])}>Add external signer</button>
      </div>
      {m.isError && <p className="text-sm text-destructive">{(m.error as Error).message}</p>}
      <div className="flex gap-3">
        <button type="submit" className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60" disabled={m.isPending || !ps.length}>{m.isPending ? "Creating…" : "Create NDA & signing requests"}</button>
        <button type="button" className="text-sm text-muted-foreground" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}
