import { useEffect, useState, type FormEvent, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import * as mammoth from "mammoth";
import { jsPDF } from "jspdf";

function docxTextToPdfBlob(text: string, title: string): Blob {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 54;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const usableWidth = pageWidth - margin * 2;

  doc.setFont("times", "bold");
  doc.setFontSize(16);
  doc.text(title, margin, margin);

  doc.setFont("times", "normal");
  doc.setFontSize(11);
  const lineHeight = 15;
  let y = margin + 28;

  const paragraphs = text.replace(/\r\n/g, "\n").split(/\n+/);
  for (const para of paragraphs) {
    const lines = doc.splitTextToSize(para.trim() || " ", usableWidth);
    for (const line of lines) {
      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += lineHeight;
    }
    y += lineHeight * 0.5;
  }
  return doc.output("blob");
}
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  listAgreements,
  upsertAgreement,
  activateAgreement,
  previewAgreement,
  type LegalAgreement,
} from "@/lib/legal-agreements.functions";
import { inviteMember } from "@/lib/onboarding.functions";
import { AccessDenied } from "@/components/access-denied";
import { AdminErrorBoundary } from "@/components/admin-error-boundary";
import { isForbiddenError } from "@/lib/authz-error";

export const Route = createFileRoute("/_authenticated/admin/onboarding")({
  head: () => ({ meta: [{ title: "Admin — Onboarding — BRQ+" }] }),
  component: () => (
    <AdminErrorBoundary>
      <AdminOnboardingPage />
    </AdminErrorBoundary>
  ),
  errorComponent: ({ error }) =>
    isForbiddenError(error) ? (
      <AccessDenied
        fullScreen={false}
        title="Admin role required"
        message="Your account is signed in but has no admin role."
      />
    ) : (
      <div role="alert" className="min-h-screen bg-navy px-5 py-12 text-destructive">
        Failed to load: {(error as Error).message}
      </div>
    ),
  notFoundComponent: () => (
    <div className="min-h-screen bg-navy px-5 py-12 text-muted-foreground">
      Page not found.
    </div>
  ),
});

function AdminOnboardingPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setIsAdmin(false);
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!data);
    })();
  }, []);

  if (isAdmin === null) {
    return <div className="text-sm text-muted-foreground">Checking permissions…</div>;
  }
  if (!isAdmin) return <AccessDenied />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Member onboarding</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Publish the latest membership agreement and invite new executives.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <AgreementManager />
        <MemberInviter />
      </div>
    </div>
  );
}

function AgreementManager() {
  const [items, setItems] = useState<LegalAgreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [versionName, setVersionName] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const { agreements } = await listAgreements();
      setItems(agreements);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load agreements");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!versionName.trim()) {
      setError("Version name is required.");
      return;
    }
    if (!content.trim() && !file) {
      setError("Provide pasted text OR upload a file.");
      return;
    }
    setSubmitting(true);
    try {
      let filePath: string | null = null;
      if (file) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
        const path = `${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("legal-agreements")
          .upload(path, file, { contentType: file.type || undefined });
        if (upErr) throw upErr;
        filePath = path;
      }
      await upsertAgreement({
        data: {
          version_name: versionName.trim(),
          content: content.trim() ? content : null,
          file_url: filePath,
        },
      });
      setMessage("Agreement published as the active version.");
      setVersionName("");
      setContent("");
      setFile(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish agreement");
    } finally {
      setSubmitting(false);
    }
  }

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setError(null);
    setMessage(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (f.name.toLowerCase().endsWith(".docx")) {
      try {
        const arrayBuffer = await f.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        setContent(result.value);
        const baseName = f.name.replace(/\.docx$/i, "");
        const pdfBlob = docxTextToPdfBlob(result.value, baseName);
        const pdfFile = new File([pdfBlob], `${baseName}.pdf`, { type: "application/pdf" });
        setFile(pdfFile);
        setMessage("DOCX converted to PDF — it will be uploaded as a PDF for preview.");
      } catch {
        setError("Could not read DOCX. Please paste the agreement text manually.");
        setFile(null);
      }
    } else {
      setFile(f);
    }
  }, []);

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="font-display text-lg font-bold text-foreground">Agreement manager</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Publishing a new version automatically deactivates all previous versions.
      </p>

      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Version name
          </label>
          <input
            type="text"
            required
            value={versionName}
            onChange={(e) => setVersionName(e.target.value)}
            placeholder="e.g. v2 — Jan 2026"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Pasted agreement text
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            placeholder="Paste the full agreement text here…"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Or upload a PDF / Word document
          </label>
          <input
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileChange}
            className="mt-1 block w-full text-sm text-muted-foreground"
          />
        </div>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {message ? <p className="text-sm text-gold">{message}</p> : null}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-110 disabled:opacity-60"
        >
          {submitting ? "Publishing…" : "Publish as active version"}
        </button>
      </form>

      <AgreementHistory items={items} loading={loading} onChanged={refresh} />
    </section>
  );
}

function AgreementHistory({
  items,
  loading,
  onChanged,
}: {
  items: LegalAgreement[];
  loading: boolean;
  onChanged: () => Promise<void> | void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<{
    version: string;
    content: string;
  } | null>(null);
  const [confirmItem, setConfirmItem] = useState<LegalAgreement | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setUserEmail(data.user.email);
    });
  }, []);

  async function handleActivate(id: string) {
    setError(null);
    setBusyId(id);
    try {
      await activateAgreement({ data: { id } });
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not activate version");
    } finally {
      setBusyId(null);
      setConfirmItem(null);
    }
  }

  async function handlePreview(a: LegalAgreement) {
    setError(null);
    setBusyId(a.id);
    try {
      const { agreement } = await previewAgreement({ data: { id: a.id } });
      if (agreement?.file_signed_url) {
        window.open(agreement.file_signed_url, "_blank", "noopener,noreferrer");
      } else {
        setPreviewText({
          version: agreement?.version_name ?? a.version_name,
          content: agreement?.content ?? "(No content)",
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not preview version");
    } finally {
      setBusyId(null);
    }
  }

  const activeVersion = items.find((i) => i.is_active);

  return (
    <div className="mt-6 border-t border-border pt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Agreement history
      </h3>
      {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}

      {loading ? (
        <div className="mt-2 text-sm text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="mt-2 text-sm text-muted-foreground">No agreements yet.</div>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="pb-2 pr-3 font-semibold">Version</th>
                <th className="pb-2 pr-3 font-semibold">Published</th>
                <th className="pb-2 pr-3 font-semibold">Type</th>
                <th className="pb-2 pr-3 font-semibold">Status</th>
                <th className="pb-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((a) => (
                <tr key={a.id} className="align-middle">
                  <td className="py-2 pr-3 font-semibold text-foreground">
                    {a.version_name}
                  </td>
                  <td className="py-2 pr-3 text-xs text-muted-foreground">
                    {new Date(a.created_at).toLocaleString()}
                  </td>
                  <td className="py-2 pr-3 text-xs text-muted-foreground">
                    {a.file_url
                      ? a.file_url.toLowerCase().endsWith(".docx")
                        ? "DOCX"
                        : "PDF"
                      : "Text"}
                  </td>
                  <td className="py-2 pr-3">
                    {a.is_active ? (
                      <span className="rounded-full bg-gold/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-gold">
                        Active
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        Archived
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handlePreview(a)}
                        disabled={busyId === a.id}
                        className="rounded-md border border-border px-2 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-background disabled:opacity-60"
                      >
                        Preview
                      </button>
                      {!a.is_active ? (
                        <button
                          type="button"
                          onClick={() => setConfirmItem(a)}
                          disabled={busyId === a.id}
                          className="rounded-md bg-gold px-2 py-1 text-xs font-semibold text-primary-foreground transition-colors hover:brightness-110 disabled:opacity-60"
                        >
                          {busyId === a.id ? "Activating…" : "Activate"}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {previewText ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreviewText(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h4 className="font-display text-lg font-bold text-foreground">
                {previewText.version}
              </h4>
              <button
                type="button"
                onClick={() => setPreviewText(null)}
                className="rounded-md border border-border px-2 py-1 text-xs font-semibold text-foreground"
              >
                Close
              </button>
            </div>
            <pre className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {previewText.content}
            </pre>
          </div>
        </div>
      ) : null}

      <Dialog open={!!confirmItem} onOpenChange={(open) => !open && setConfirmItem(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Activate agreement version</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              You are about to reactivate an archived agreement.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
              <p className="text-sm font-semibold text-red-400">Warning</p>
              <p className="mt-1 text-sm text-foreground">
                Activating <strong>{confirmItem?.version_name}</strong> will immediately
                deactivate the current active version{" "}
                {activeVersion ? (
                  <strong>({activeVersion.version_name})</strong>
                ) : (
                  "(none)"
                )}
                . All new members will be required to agree to this version from now on.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Triggered by
                </p>
                <p className="mt-1 text-foreground">{userEmail || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Effective date
                </p>
                <p className="mt-1 text-foreground">
                  {new Date().toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => setConfirmItem(null)}
              className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-background"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => confirmItem && handleActivate(confirmItem.id)}
              disabled={!!busyId}
              className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-110 disabled:opacity-60"
            >
              {busyId ? "Activating…" : "Confirm activation"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MemberInviter() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setInviteUrl(null);
    setError(null);
    setSubmitting(true);
    try {
      const redirectTo = `${window.location.origin}/onboarding`;
      const res = await inviteMember({
        data: { email: email.trim().toLowerCase(), redirect_to: redirectTo, full_name: fullName.trim() || null },
      });
      setMessage(`Invitation sent to ${email}.`);
      setInviteUrl(res.onboarding_url);
      setEmail("");
      setFullName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send invitation");
    } finally {
      setSubmitting(false);
    }
  }


  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="font-display text-lg font-bold text-foreground">Invite a member</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Sends an official invitation email. The link routes them to set their password.
      </p>

      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Full name (optional)
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Email address
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {message ? <p className="text-sm text-gold">{message}</p> : null}
        {inviteUrl ? (
          <div className="rounded-md border border-border bg-background/60 p-3 text-xs">
            <div className="font-semibold uppercase tracking-wider text-muted-foreground">
              Onboarding link (also emailed)
            </div>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 truncate text-foreground">{inviteUrl}</code>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(inviteUrl)}
                className="rounded border border-border px-2 py-1 text-[11px] font-semibold hover:bg-muted/20"
              >
                Copy
              </button>
            </div>
            <p className="mt-2 text-muted-foreground">
              This link is required to access onboarding. It expires in 14 days and can only be used once.
            </p>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-110 disabled:opacity-60"
        >
          {submitting ? "Sending…" : "Send invitation"}
        </button>
      </form>
    </section>
  );
}
