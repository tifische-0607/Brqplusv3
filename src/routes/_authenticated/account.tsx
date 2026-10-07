import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { exportMyData, getMyAccount, logAccountEvent, requestAccountDeletion, updateMyPreferences } from "@/lib/portal.functions";
import { MyMembershipBilling } from "@/components/billing/MembershipBilling";
import { LegalDocumentLinks } from "@/components/members/LegalDocumentLinks";
import { ErrorNote, PageIntro, Panel, SkeletonRows, StrengthMeter, Toggle, btnGold, focusRing, fmtDate, inputCls, labelCls } from "@/components/members/portal-ui";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({ meta: [
    { title: "Account & Security — BRQ+ Members" },
    { name: "description", content: "Manage BRQ+ sign-in, security, privacy preferences and account data." },
    { property: "og:title", content: "Account & Security — BRQ+ Members" },
    { property: "og:description", content: "Manage BRQ+ sign-in, security, privacy preferences and account data." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AccountPage,
});

type Msg = { ok: boolean; text: string } | null;
const Note = ({ m }: { m: Msg }) => (m ? <p role={m.ok ? "status" : "alert"} className={`text-sm ${m.ok ? "text-cyan" : "text-destructive"}`}>{m.text}</p> : null);

const ACTION_LABELS: Record<string, string> = {
  password_changed: "Password changed", password_set: "Password set", email_change_requested: "Email change requested",
  signed_out_other_sessions: "Signed out other devices", password_reset_requested: "Password reset email requested", deletion_requested: "Account deletion requested",
};

function AccountPage() {
  const [user, setUser] = useState<User | null>(null);
  const loadUser = () => supabase.auth.getUser().then(({ data }) => setUser(data.user));
  useEffect(() => { loadUser(); }, []);
  const accFn = useServerFn(getMyAccount);
  const acc = useQuery({ queryKey: ["my-account"], queryFn: () => accFn() });
  if (!user) return <SkeletonRows rows={6} />;
  const providers = new Set((user.identities ?? []).map((i) => i.provider));
  const hasPassword = providers.has("email");

  return (
    <div className="space-y-6">
      <PageIntro eyebrow="Account & Security" title="Sign-in and privacy">Manage how you sign in to BRQ+ and what we hold about you.</PageIntro>
      <div className="grid gap-6 lg:grid-cols-2">
        <EmailSection user={user} onChanged={loadUser} />
        <Panel title="Sign-in methods">
          <ul className="space-y-2 text-sm">
            <li className="flex items-center justify-between"><span className="text-foreground">Email & password</span><span className={hasPassword ? "text-cyan" : "text-muted-foreground"}>{hasPassword ? "Linked" : "Not set"}</span></li>
            <li className="flex items-center justify-between"><span className="text-foreground">Google</span><span className={providers.has("google") ? "text-cyan" : "text-muted-foreground"}>{providers.has("google") ? "Linked" : "Not linked"}</span></li>
          </ul>
        </Panel>
      </div>
      <MyMembershipBilling scope="personal" />
      <PasswordSection email={user.email ?? ""} hasPassword={hasPassword} onChanged={loadUser} />
      <div className="grid gap-6 lg:grid-cols-2">
        <SessionsSection />
        {acc.isLoading ? <Panel title="Notifications"><SkeletonRows /></Panel> : acc.isError ? <ErrorNote error={acc.error} /> : <NotificationsSection prefs={acc.data!.prefs as any} />}
      </div>
      <PrivacySection deletion={acc.data?.deletion as any} />
      <Panel title="Recent security activity">
        {!acc.data?.audit.length ? <p className="text-sm text-muted-foreground">No recent account changes.</p> : (
          <ul className="divide-y divide-border text-sm">{acc.data.audit.map((a: any, i: number) => (
            <li key={i} className="flex justify-between py-2"><span className="text-foreground">{ACTION_LABELS[a.action] ?? a.action}</span><span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span></li>
          ))}</ul>
        )}
      </Panel>
    </div>
  );
}

function EmailSection({ user, onChanged }: { user: User; onChanged: () => void }) {
  const log = useServerFn(logAccountEvent);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    const next = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next) || next.length > 254) return setMsg({ ok: false, text: "Enter a valid email address." });
    if (next === user.email) return setMsg({ ok: false, text: "That is already your sign-in email." });
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ email: next }, { emailRedirectTo: `${window.location.origin}/account` });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    await log({ data: { action: "email_change_requested" } }).catch(() => {});
    setMsg({ ok: true, text: `Check ${next} (and your current inbox) to confirm the change.` });
    setEmail(""); setOpen(false); onChanged();
  }
  return (
    <Panel title="Sign-in email">
      <p className="text-sm text-foreground">{user.email}</p>
      {user.new_email && <p className="mt-1 text-xs text-gold">Pending change to {user.new_email} — confirm from your email.</p>}
      {!open ? <button type="button" onClick={() => setOpen(true)} className={`mt-4 ${btnGold}`}>Change email</button> : (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <label className="flex flex-col gap-1"><span className={labelCls}>New email</span><input type="email" required autoComplete="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <div className="flex gap-2"><button disabled={busy} className={btnGold}>{busy ? "Sending…" : "Send confirmation"}</button><button type="button" onClick={() => setOpen(false)} className={`min-h-11 rounded-sm px-3 text-xs text-muted-foreground ${focusRing}`}>Cancel</button></div>
        </form>
      )}
      <div className="mt-3"><Note m={msg} /></div>
    </Panel>
  );
}

export function validateNewPassword(pw: string, confirm: string): string | null {
  if (pw.length < 8) return "New password must be at least 8 characters.";
  if (pw.length > 72) return "New password must be 72 characters or fewer.";
  if (pw !== confirm) return "New passwords do not match.";
  return null;
}

function PasswordSection({ email, hasPassword, onChanged }: { email: string; hasPassword: boolean; onChanged: () => void }) {
  const log = useServerFn(logAccountEvent);
  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [resetMsg, setResetMsg] = useState<Msg>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (hasPassword && !current) return setMsg({ ok: false, text: "Enter your current password." });
    const invalid = validateNewPassword(pw, pw2);
    if (invalid) return setMsg({ ok: false, text: invalid });
    if (hasPassword && pw === current) return setMsg({ ok: false, text: "Choose a password different from your current one." });
    setBusy(true);
    try {
      if (hasPassword) {
        const { error: vErr } = await supabase.auth.signInWithPassword({ email, password: current });
        if (vErr) { setMsg({ ok: false, text: "Current password is incorrect." }); return; }
      }
      const attrs: Record<string, string> = { password: pw };
      if (hasPassword) attrs.current_password = current;
      const { error } = await supabase.auth.updateUser(attrs as any);
      if (error) { setMsg({ ok: false, text: error.message }); return; }
      await log({ data: { action: hasPassword ? "password_changed" : "password_set" } }).catch(() => {});
      setCurrent(""); setPw(""); setPw2("");
      setMsg({ ok: true, text: hasPassword ? "Password updated. You are still signed in." : "Password set. You can now also sign in with your email." });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function forgot() {
    setResetMsg(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    if (error) return setResetMsg({ ok: false, text: error.message });
    await log({ data: { action: "password_reset_requested" } }).catch(() => {});
    setResetMsg({ ok: true, text: `We sent a reset link to ${email}.` });
  }

  return (
    <Panel title={hasPassword ? "Change password" : "Set a password"}>
      {!hasPassword && <p className="mb-4 text-sm text-muted-foreground">You sign in with Google. Set a password to also sign in with {email}.</p>}
      <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-3">
        {hasPassword && (
          <label className="flex flex-col gap-1"><span className={labelCls}>Current password</span>
             <input name="current-password" type="password" required autoComplete="current-password" className={inputCls} value={current} onChange={(e) => setCurrent(e.target.value)} /></label>
        )}
        <label className="flex flex-col gap-1"><span className={labelCls}>New password</span>
          <input name="new-password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" aria-describedby="password-guidance" className={inputCls} value={pw} onChange={(e) => setPw(e.target.value)} />
          <StrengthMeter id="password-guidance" password={pw} /></label>
        <label className="flex flex-col gap-1"><span className={labelCls}>Confirm new password</span>
          <input name="confirm-password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" aria-invalid={!!pw2 && pw !== pw2} aria-describedby={pw2 && pw !== pw2 ? "password-mismatch" : undefined} className={inputCls} value={pw2} onChange={(e) => setPw2(e.target.value)} />
          {pw2 && pw !== pw2 && <span id="password-mismatch" role="alert" className="text-[11px] text-destructive">Passwords do not match.</span>}</label>
        <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-3">
          <div className="min-h-5"><Note m={msg} /></div>
          <button disabled={busy} className={btnGold}>{busy ? "Updating…" : hasPassword ? "Update password" : "Set password"}</button>
        </div>
      </form>
      <div className="mt-4 border-t border-border pt-3 text-xs">
        <button type="button" onClick={forgot} className={`min-h-11 rounded-sm text-gold hover:underline ${focusRing}`}>Forgot your current password?</button>
        <span className="text-muted-foreground"> We'll email you a secure reset link.</span>
        <div className="mt-2"><Note m={resetMsg} /></div>
      </div>
    </Panel>
  );
}

function SessionsSection() {
  const log = useServerFn(logAccountEvent);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  async function run() {
    if (!confirm("Sign out of BRQ+ on all other devices?")) return;
    setBusy(true);
    const { error } = await supabase.auth.signOut({ scope: "others" });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    await log({ data: { action: "signed_out_other_sessions" } }).catch(() => {});
    setMsg({ ok: true, text: "Signed out of all other devices." });
  }
  return (
    <Panel title="Sessions">
      <p className="text-sm text-muted-foreground">If you signed in on a shared or lost device, end those sessions. This device stays signed in.</p>
      <button type="button" onClick={run} disabled={busy} className={`mt-4 ${btnGold}`}>{busy ? "Signing out…" : "Sign out of all other devices"}</button>
      <div className="mt-3"><Note m={msg} /></div>
    </Panel>
  );
}

function NotificationsSection({ prefs }: { prefs: { notify_program_updates: boolean; notify_newsletter: boolean } }) {
  const fn = useServerFn(updateMyPreferences);
  const qc = useQueryClient();
  const [v, setV] = useState(prefs);
  async function change(k: keyof typeof v, val: boolean) {
    const prev = v; setV({ ...v, [k]: val });
    try { await fn({ data: { [k]: val } }); qc.invalidateQueries({ queryKey: ["my-account"] }); } catch { setV(prev); }
  }
  return (
    <Panel title="Notifications">
      <div className="divide-y divide-border">
        <Toggle label="Program & event updates" hint="News about programs and events you may join." checked={v.notify_program_updates} onChange={(x) => change("notify_program_updates", x)} />
        <Toggle label="BRQ+ newsletter" checked={v.notify_newsletter} onChange={(x) => change("notify_newsletter", x)} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Service messages about your membership and documents are always sent.</p>
    </Panel>
  );
}

function PrivacySection({ deletion }: { deletion: { status: string; created_at: string } | null }) {
  const exportFn = useServerFn(exportMyData);
  const delFn = useServerFn(requestAccountDeletion);
  const qc = useQueryClient();
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState<"export" | "delete" | null>(null);
  const [reason, setReason] = useState("");
  const [askDelete, setAskDelete] = useState(false);

  async function download() {
    setBusy("export"); setMsg(null);
    try {
      const data = await exportFn();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `brq-my-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Export failed" }); }
    finally { setBusy(null); }
  }
  async function requestDelete() {
    setBusy("delete"); setMsg(null);
    try {
      const r = await delFn({ data: { reason } });
      setMsg({ ok: true, text: r.already ? "You already have an open deletion request." : "Request received. BRQ+ will contact you before anything is deleted." });
      setAskDelete(false);
      qc.invalidateQueries({ queryKey: ["my-account"] });
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Request failed" }); }
    finally { setBusy(null); }
  }
  const open = deletion && ["pending", "in_progress"].includes(deletion.status);
  return (
    <Panel title="Privacy">
      <p className="mb-4 text-sm text-muted-foreground">Review the legal documents governing your BRQ+ account and membership.</p>
      <LegalDocumentLinks />
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={download} disabled={busy === "export"} className={btnGold}>{busy === "export" ? "Preparing…" : "Download my data"}</button>
        {!open && !askDelete && <button type="button" onClick={() => setAskDelete(true)} className={`min-h-11 rounded-md border border-destructive/50 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-destructive hover:bg-destructive/10 ${focusRing}`}>Request account deletion</button>}
      </div>
      {open && <p className="mt-3 text-sm text-gold">Deletion request {deletion!.status.replace("_", " ")} since {fmtDate(deletion!.created_at)}.</p>}
      {askDelete && (
        <div className="mt-4 space-y-3 rounded-lg border border-destructive/40 p-4">
          <p className="text-sm text-foreground">BRQ+ will review your request. Signed agreements may need to be kept for legal reasons; we'll explain what can be removed.</p>
          <label className="flex flex-col gap-1"><span className={labelCls}>Reason (optional)</span><textarea className={`${inputCls} min-h-20`} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
          <div className="flex gap-2">
            <button type="button" onClick={requestDelete} disabled={busy === "delete"} className={`min-h-11 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-destructive ${focusRing}`}>{busy === "delete" ? "Sending…" : "Send request"}</button>
            <button type="button" onClick={() => setAskDelete(false)} className={`min-h-11 rounded-sm px-3 text-xs text-muted-foreground ${focusRing}`}>Cancel</button>
          </div>
        </div>
      )}
      <div className="mt-3"><Note m={msg} /></div>
    </Panel>
  );
}
