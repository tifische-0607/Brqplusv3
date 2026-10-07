import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { inviteColleague, removeColleague, transferCompanyAdmin } from "@/lib/member-portal.functions";
import { getCompanyTeam, resendColleagueInvite } from "@/lib/portal.functions";
import { CompanyGate } from "@/components/members/CompanyGate";
import { Empty, ErrorNote, PageIntro, Panel, Pill, SkeletonRows, btnGold, focusRing, fmtDate, inputCls, labelCls } from "@/components/members/portal-ui";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/company/team")({
  head: () => ({ meta: [{ title: "Team — BRQ+ Members" }] }),
  component: () => <CompanyGate adminOnly><TeamPage /></CompanyGate>,
});

type Confirm = { kind: "remove" | "transfer"; user_id: string; name: string } | null;

function TeamPage() {
  const qc = useQueryClient();
  const fn = useServerFn(getCompanyTeam);
  const q = useQuery({ queryKey: ["company-team"], queryFn: () => fn() });
  const inviteFn = useServerFn(inviteColleague);
  const removeFn = useServerFn(removeColleague);
  const transferFn = useServerFn(transferCompanyAdmin);
  const resendFn = useServerFn(resendColleagueInvite);
  const [email, setEmail] = useState(""); const [name, setName] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const refresh = () => ["company-team", "my-company", "company-home", "portal-context"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  const ok = (text: string) => { setMsg({ ok: true, text }); refresh(); };
  const err = (e: any) => setMsg({ ok: false, text: e?.message ?? "Failed" });
  const redirect_to = () => `${window.location.origin}/onboarding`;
  const invite = useMutation({ mutationFn: () => inviteFn({ data: { email, full_name: name || undefined, redirect_to: redirect_to() } }), onSuccess: () => { ok(`Invitation sent to ${email}`); setEmail(""); setName(""); }, onError: err });
  const remove = useMutation({ mutationFn: (user_id: string) => removeFn({ data: { user_id } }), onSuccess: () => ok("Member removed"), onError: err });
  const transfer = useMutation({ mutationFn: (user_id: string) => transferFn({ data: { user_id } }), onSuccess: () => ok("Company Admin role transferred"), onError: err });
  const resend = useMutation({
    mutationFn: (user_id: string) => resendFn({ data: { user_id, redirect_to: redirect_to() } }),
    onSuccess: (r) => { if (r.emailed) ok("Invitation resent"); else { setMsg({ ok: true, text: `This person already has an account. Share this onboarding link: ${r.link}` }); refresh(); } },
    onError: err,
  });

  return (
    <div className="space-y-6">
      <PageIntro eyebrow="Team" title="Company team">Invite colleagues, resend invitations, remove members or hand over the Company Admin role.</PageIntro>
      <Panel title="Invite a colleague">
        <form onSubmit={(e) => { e.preventDefault(); invite.mutate(); }} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <label className="flex flex-col gap-1"><span className={labelCls}>Colleague's full name</span><input className={inputCls} autoComplete="name" maxLength={200} value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="flex flex-col gap-1"><span className={labelCls}>Work email</span><input className={inputCls} type="email" required autoComplete="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <button disabled={invite.isPending} className={btnGold}>{invite.isPending ? "Sending…" : "Invite"}</button>
        </form>
        {msg && <p role={msg.ok ? "status" : "alert"} className={`mt-3 break-all text-sm ${msg.ok ? "text-cyan" : "text-destructive"}`}>{msg.text.replace(/^SEAT_LIMIT: /, "")}</p>}
        {msg && !msg.ok && msg.text.startsWith("SEAT_LIMIT") && <Link to="/company" className="mt-2 inline-block rounded-md border border-gold px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gold hover:bg-gold/10">Upgrade plan</Link>}
      </Panel>
      <Panel title={`Members${q.data ? ` (${q.data.members.length})` : ""}`}>
        {q.isLoading ? <SkeletonRows rows={4} /> : q.isError ? <ErrorNote error={q.error} /> : !q.data!.members.length ? <Empty>No team members yet.</Empty> : (
          <ul className="divide-y divide-border text-sm">
            {q.data!.members.map((m: any) => (
              <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-foreground">{m.full_name ?? m.email ?? "Invited member"} {m.role === "admin" && <span className="ml-1 text-[10px] uppercase tracking-wider text-gold">Company Admin</span>}</p>
                  <p className="text-xs text-muted-foreground">{[m.job_title, m.email].filter(Boolean).join(" · ")} · Joined {fmtDate(m.joined_at)}</p>
                  <div className="mt-1 flex gap-1.5"><Pill status={m.membership_status === "active" ? "active" : "pending"} label={m.membership_status} /><Pill status={m.agreement_signed ? "executed" : "pending"} label={m.agreement_signed ? "Agreement signed" : "Agreement not signed"} /></div>
                </div>
                {m.role !== "admin" && (
                  <div className="flex flex-wrap gap-2">
                    {m.membership_status !== "active" && <button type="button" onClick={() => resend.mutate(m.user_id)} className={`min-h-11 rounded-md border border-border px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground ${focusRing}`}>Resend invite</button>}
                    <button type="button" onClick={() => setConfirm({ kind: "transfer", user_id: m.user_id, name: m.full_name ?? m.email ?? "this person" })} className={`min-h-11 rounded-md border border-cyan/50 px-3 py-2 text-[11px] uppercase tracking-wider text-cyan ${focusRing}`}>Make admin</button>
                    <button type="button" onClick={() => setConfirm({ kind: "remove", user_id: m.user_id, name: m.full_name ?? m.email ?? "this person" })} className={`min-h-11 rounded-md border border-destructive/50 px-3 py-2 text-[11px] uppercase tracking-wider text-destructive ${focusRing}`}>Remove</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.kind === "transfer" ? "Transfer Company Admin?" : "Remove from company?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "transfer"
                ? `${confirm.name} will become the Company Admin. You will become a Company User and lose team management.`
                : `${confirm?.name} will no longer be linked to your company on BRQ+.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (!confirm) return; confirm.kind === "transfer" ? transfer.mutate(confirm.user_id) : remove.mutate(confirm.user_id); setConfirm(null); }}>
              {confirm?.kind === "transfer" ? "Transfer" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
