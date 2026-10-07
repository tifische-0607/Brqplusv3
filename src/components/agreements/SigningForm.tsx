import { useRef, useState, type ReactNode } from "react";
import { AgreementMarkdown, DraftBanner } from "./AgreementMarkdown";
import { SignaturePad, type SignaturePadHandle } from "./SignaturePad";

const input = "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none disabled:opacity-50";
const lab = "text-xs font-semibold uppercase tracking-wider text-muted-foreground";

export type SigningSubmit = { signed_name: string; signed_title: string | null; signature_png: string };

/** Shared signing UI: scroll-to-end, consent checkbox, legal name, optional title, drawn signature. */
export function SigningForm({
  heading,
  body,
  isDraft,
  consent,
  needsTitle,
  profileName,
  defaultTitle,
  submitLabel = "Sign agreement",
  onSubmit,
  back,
}: {
  heading: string;
  body: string;
  isDraft: boolean;
  consent: string;
  needsTitle: boolean;
  profileName?: string | null;
  defaultTitle?: string | null;
  submitLabel?: string;
  onSubmit: (v: SigningSubmit) => Promise<void>;
  back?: ReactNode;
}) {
  const pad = useRef<SignaturePadHandle>(null);
  const [scrolled, setScrolled] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [name, setName] = useState("");
  const [title, setTitle] = useState<string | null>(null);
  const [hasInk, setHasInk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const titleValue = title ?? defaultTitle ?? "";
  const nameMismatch = name.trim().length > 1 && !!profileName && name.trim().toLowerCase() !== profileName.trim().toLowerCase();
  const locked = !scrolled || submitting;
  const ready = scrolled && agreed && name.trim().length >= 2 && (!needsTitle || titleValue.trim().length > 1) && hasInk;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const png = pad.current?.toDataUrl();
    if (!png) return setError("Please draw your signature.");
    setSubmitting(true);
    try {
      await onSubmit({ signed_name: name.trim(), signed_title: needsTitle ? titleValue.trim() : null, signature_png: png });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record your signature.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      {isDraft && <DraftBanner className="mb-3" />}
      <div
        className="h-[420px] overflow-y-auto rounded-md border border-border bg-background p-5"
        tabIndex={0}
        aria-label="Document text"
        ref={(el) => {
          if (el && !scrolled && el.scrollHeight <= el.clientHeight + 4) setScrolled(true);
        }}
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) setScrolled(true);
        }}
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gold">{heading}</p>
        <AgreementMarkdown body={body} />
        <p className="mt-6 text-xs text-muted-foreground">— End of document —</p>
      </div>
      {!scrolled && <p className="mt-2 text-xs text-muted-foreground">Scroll to the end of the document to enable signing.</p>}

      <form onSubmit={submit} className="mt-6 space-y-5">
        <label className={`flex items-start gap-3 text-sm text-foreground ${locked ? "opacity-50" : ""}`}>
          <input type="checkbox" disabled={locked} checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 h-4 w-4 accent-gold" />
          <span>{consent.includes("Privacy Notice") ? consent.split("Privacy Notice").flatMap((part, i) => i === 0 ? [part] : [<a key={i} href="/privacy" target="_blank" rel="noopener" className="text-gold underline">Privacy Notice</a>, part]) : <>{consent} See the BRQ+ <a href="/privacy" target="_blank" rel="noopener" className="text-gold underline">Privacy Notice</a>.</>}</span>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={lab} htmlFor="sig-name">Full legal name</label>
            <input id="sig-name" className={input} disabled={locked} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            {nameMismatch && <p className="mt-1 text-xs text-gold">This doesn't match the name on record ({profileName}). Please check it is your full legal name.</p>}
          </div>
          {needsTitle && (
            <div>
              <label className={lab} htmlFor="sig-title">Job title</label>
              <input id="sig-title" className={input} disabled={locked} value={titleValue} onChange={(e) => setTitle(e.target.value)} />
            </div>
          )}
        </div>
        <div>
          <p className={lab}>Signature</p>
          <div className="mt-1"><SignaturePad ref={pad} disabled={locked} onChange={setHasInk} /></div>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex items-center justify-between gap-3">
          {back ?? <span />}
          <button type="submit" disabled={!ready || submitting} className="rounded-md bg-gold px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-110 disabled:opacity-60">
            {submitting ? "Signing…" : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
