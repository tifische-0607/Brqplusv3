import { useRef, useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  ExecInput,
  adminResetExecutivePassword,
  type Executive,
} from "@/lib/executives.functions";
import {
  ExecutiveAvatar,
  AVAILABILITY,
  availLabel,
  type Availability,
} from "@/components/ExecutiveCard";

const BUCKET = "executive-avatars";

type Strength = {
  score: number; // 0-4
  label: string;
  color: string;
  barColor: string;
};

export type ExecFormValues = {
  name: string;
  role: string;
  company: string | null;
  expertise: string[];
  markets: string[];
  availability: Availability;
  email: string | null;
  bio: string | null;
  avatar_path: string | null;
  linkedin_url: string | null;
};

type FormState = {
  name: string;
  role: string;
  company: string;
  expertise: string;
  markets: string;
  availability: Availability;
  email: string;
  bio: string;
  linkedin_url: string;
  avatar_path: string | null;
};

const empty: FormState = {
  name: "",
  role: "",
  company: "",
  expertise: "",
  markets: "",
  availability: "available",
  email: "",
  bio: "",
  linkedin_url: "",
  avatar_path: null,
};

function fromExecutive(e: Executive | null | undefined): FormState {
  if (!e) return empty;
  return {
    name: e.name,
    role: e.role,
    company: e.company ?? "",
    expertise: (e.expertise ?? []).join(", "),
    markets: (e.markets ?? []).join(", "),
    availability: e.availability,
    email: e.email ?? "",
    bio: e.bio ?? "",
    linkedin_url: e.linkedin_url ?? "",
    avatar_path: e.avatar_path,
  };
}

export function ExecutiveForm({
  initial,
  submitLabel,
  submitting,
  onCancel,
  onSubmit,
  externalError,
}: {
  initial: Executive | null;
  submitLabel: string;
  submitting?: boolean;
  onCancel?: () => void;
  onSubmit: (values: ExecFormValues) => void;
  externalError?: string | null;
}) {
  const [form, setForm] = useState<FormState>(() => fromExecutive(initial));
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initial?.avatar_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function handleAvatarFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
      setForm((f) => ({ ...f, avatar_path: path }));
      setAvatarUrl(signed?.signedUrl ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const raw = {
      name: form.name,
      role: form.role,
      company: form.company.trim() || null,
      expertise: form.expertise.split(",").map((s) => s.trim()).filter(Boolean),
      markets: form.markets.split(",").map((s) => s.trim()).filter(Boolean),
      availability: form.availability,
      email: form.email.trim() || null,
      bio: form.bio.trim() || null,
      avatar_path: form.avatar_path,
      linkedin_url: form.linkedin_url.trim() || null,
    };
    const parsed = ExecInput.safeParse(raw);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    onSubmit(parsed.data as ExecFormValues);
  }

  const errMsg = error ?? externalError ?? null;

  return (
    <form onSubmit={submit}>
      <div className="mb-4 flex items-center gap-4">
        <ExecutiveAvatar url={avatarUrl} name={form.name || "?"} size={64} />
        <div className="flex flex-col gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleAvatarFile(f);
            }}
            className="text-xs text-muted-foreground"
          />
          {form.avatar_path && (
            <button
              type="button"
              onClick={() => {
                setForm((f) => ({ ...f, avatar_path: null }));
                setAvatarUrl(null);
              }}
              className="self-start text-xs text-muted-foreground hover:text-destructive"
            >
              Remove avatar
            </button>
          )}
          {uploading && <span className="text-xs text-muted-foreground">Uploading…</span>}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name *">
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label="Role *">
          <input
            required
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label="Company">
          <input
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label="Availability">
          <select
            value={form.availability}
            onChange={(e) => setForm({ ...form, availability: e.target.value as Availability })}
            className={inputCls}
          >
            {AVAILABILITY.map((a) => (
              <option key={a} value={a}>
                {availLabel[a]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="LinkedIn URL" className="sm:col-span-2">
          <input
            value={form.linkedin_url}
            onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })}
            placeholder="https://linkedin.com/in/…"
            className={inputCls}
          />
        </Field>
        <Field label="Expertise (comma-separated)" className="sm:col-span-2">
          <input
            value={form.expertise}
            onChange={(e) => setForm({ ...form, expertise: e.target.value })}
            placeholder="Strategy, Operations, Fundraising"
            className={inputCls}
          />
        </Field>
        <Field label="Markets (comma-separated)" className="sm:col-span-2">
          <input
            value={form.markets}
            onChange={(e) => setForm({ ...form, markets: e.target.value })}
            placeholder="MENA, Southeast Asia, UK"
            className={inputCls}
          />
        </Field>
        <Field label="Bio" className="sm:col-span-2">
          <textarea
            rows={4}
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            className={inputCls}
          />
        </Field>
      </div>

      {errMsg && <p className="mt-3 text-sm text-destructive">{errMsg}</p>}

      <div className="mt-5 flex items-center justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={submitting || uploading}
          className="rounded-md border border-gold bg-gold/10 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gold hover:bg-gold/20 disabled:opacity-50"
        >
          {submitLabel}
        </button>
      </div>

      {initial?.user_id && (
        <ResetPasswordSection executiveId={initial.id} executiveName={initial.name} />
      )}
    </form>
  );
}

function getPasswordStrength(password: string): Strength {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;

  const levels: Strength[] = [
    { score: 0, label: "Too weak", color: "text-destructive", barColor: "bg-destructive" },
    { score: 1, label: "Weak", color: "text-destructive", barColor: "bg-destructive" },
    { score: 2, label: "Fair", color: "text-gold", barColor: "bg-gold" },
    { score: 3, label: "Good", color: "text-cyan", barColor: "bg-cyan" },
    { score: 4, label: "Strong", color: "text-cyan", barColor: "bg-cyan" },
  ];
  return levels[Math.min(score, 4)];
}

function PasswordStrengthMeter({ strength }: { strength: Strength }) {
  const bars = 4;
  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1">
          {Array.from({ length: bars }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i < strength.score ? strength.barColor : "bg-muted"
              }`}
            />
          ))}
        </div>
        <span className={`text-[10px] font-semibold uppercase tracking-wider ${strength.color}`}>
          {strength.label}
        </span>
      </div>
    </div>
  );
}

function ResetPasswordSection({
  executiveId,
  executiveName,
}: {
  executiveId: string;
  executiveName: string;
}) {
  const resetFn = useServerFn(adminResetExecutivePassword);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const strength = useMemo(() => getPasswordStrength(pw), [pw]);
  const MIN_STRENGTH = 2;

  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  function openConfirm(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    setMsg(null);
    if (pw.length < 8) {
      setMsg({ kind: "err", text: "Password must be at least 8 characters" });
      return;
    }
    if (strength.score < MIN_STRENGTH) {
      setMsg({ kind: "err", text: `Password is ${strength.label.toLowerCase()}. Add uppercase, lowercase, numbers, and symbols to strengthen it.` });
      return;
    }
    if (pw !== confirm) {
      setMsg({ kind: "err", text: "Passwords do not match" });
      return;
    }
    setShowConfirm(true);
  }

  async function doReset() {
    setShowConfirm(false);
    setBusy(true);
    try {
      await resetFn({ data: { executive_id: executiveId, new_password: pw } });
      setMsg({ kind: "ok", text: `Password reset for ${executiveName}` });
      setPw("");
      setConfirm("");
    } catch (err: any) {
      setMsg({ kind: "err", text: err?.message ?? "Failed to reset password" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 rounded-md border border-border bg-background/40 p-4">
      <h3 className="font-display text-sm font-semibold text-foreground">Reset login password</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Set a new password for this executive's login. They can change it later from My Profile.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="New password">
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoComplete="new-password"
              className={`${inputCls} pr-9`}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPw((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
              )}
            </button>
          </div>
          {pw && <PasswordStrengthMeter strength={strength} />}
        </Field>
        <Field label="Confirm password">
          <div className="relative">
            <input
              type={showConfirmPw ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              className={`${inputCls} pr-9`}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowConfirmPw((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showConfirmPw ? "Hide password" : "Show password"}
            >
              {showConfirmPw ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
              )}
            </button>
          </div>
        </Field>
      </div>
      {msg && (
        <p
          className={`mt-2 text-sm ${
            msg.kind === "ok" ? "text-cyan" : "text-destructive"
          }`}
        >
          {msg.text}
        </p>
      )}
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={openConfirm}
          disabled={busy || !pw || !confirm || strength.score < MIN_STRENGTH}
          className="rounded-md border border-cyan bg-cyan/10 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-cyan hover:bg-cyan/20 disabled:opacity-50"
        >
          {busy ? "Resetting…" : "Reset password"}
        </button>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-lg border border-destructive bg-background p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                  <path d="M12 9v4" />
                  <path d="M12 17h.01" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">Confirm password reset</h4>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  You are about to overwrite <span className="font-medium text-foreground">{executiveName}</span>'s login password.
                  This will immediately sign them out of all sessions and they will need the new password to log back in.
                </p>
                <p className="mt-2 text-xs font-medium text-destructive">This action cannot be undone.</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={doReset}
                className="rounded-md bg-destructive px-3 py-2 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90"
              >
                Yes, reset password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none";

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
