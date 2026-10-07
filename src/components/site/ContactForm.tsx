import { useState, type FormEvent } from "react";
import { motion } from "motion/react";
import { useServerFn } from "@tanstack/react-start";
import { SectionTitle } from "./SectionTitle";
import { Check, AlertCircle } from "lucide-react";
import { submitContact } from "../../lib/contact.functions";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; reference: string }
  | { kind: "error"; message: string };

export function ContactForm() {
  const submit = useServerFn(submitContact);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldErrors({});
    setStatus({ kind: "loading" });

    const form = e.currentTarget;
    const fd = new FormData(form);
    const payload = {
      name: String(fd.get("name") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      industry: String(fd.get("industry") ?? ""),
      mission: String(fd.get("mission") ?? ""),
      brief: String(fd.get("brief") ?? ""),
    };

    // Light client-side guardrails
    const errs: Record<string, string> = {};
    if (!payload.name.trim()) errs.name = "Name is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) errs.email = "Valid email required";
    if (payload.phone && !/^[+0-9 ()-]{6,32}$/.test(payload.phone)) errs.phone = "Valid phone required";
    if (!payload.mission) errs.mission = "Select a mission";
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      setStatus({ kind: "idle" });
      return;
    }

    try {
      const res = await submit({ data: payload });
      setStatus({ kind: "success", reference: res.reference });
      form.reset();
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Something went wrong. Please try again.";
      setStatus({ kind: "error", message });
    }
  }

  return (
    <section id="contact" className="relative scroll-mt-24 bg-background px-5 py-24 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <SectionTitle
            eyebrow="Consult"
            title={<>Consult the <span className="text-gradient-gold">Collective</span></>}
            description="Tell us about your mission. Engagements begin with a confidential briefing — typically within 72 hours."
          />
          <div className="mt-10 space-y-5">
            {[
              { k: "Confidential", v: "All briefings under NDA by default." },
              { k: "Senior-only", v: "You speak with operators, not juniors." },
              { k: "Decision in 72h", v: "Clear scope, fee, and team within three days." },
            ].map((i) => (
              <div key={i.k} className="flex gap-4">
                <div className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full border border-gold/60 bg-gold/10">
                  <Check size={12} className="text-gold" />
                </div>
                <div>
                  <div className="font-display text-sm font-semibold text-foreground">{i.k}</div>
                  <div className="text-sm text-muted-foreground">{i.v}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5 }}
          onSubmit={onSubmit}
          noValidate
          className="rounded-2xl border border-border bg-card p-6 sm:p-8"
        >
          {status.kind === "success" ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
              <div className="flex size-14 items-center justify-center rounded-full border border-gold/60 bg-gold/10">
                <Check className="text-gold" />
              </div>
              <h3 className="font-display mt-5 text-2xl font-bold">Brief received.</h3>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                A partner from BRQ+ will respond within 72 hours.
              </p>
              <p className="mt-4 text-xs uppercase tracking-wider text-muted-foreground">
                Reference: <span className="text-gold">{status.reference}</span>
              </p>
              <button
                type="button"
                onClick={() => setStatus({ kind: "idle" })}
                className="mt-8 text-xs font-semibold uppercase tracking-wider text-cyan hover:underline"
              >
                Submit another brief
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <Field label="Full Name" name="name" required placeholder="Your name" error={fieldErrors.name} />
              <Field label="Email" name="email" type="email" required placeholder="you@company.com" error={fieldErrors.email} />
              <Field label="Mobile Number" name="phone" type="tel" placeholder="+33 6 12 34 56 78" error={fieldErrors.phone} />
              <Field label="Industry" name="industry" placeholder="e.g. Digital Banking" />
              <div>
                <label htmlFor="mission" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Project Mission
                </label>
                <select
                  id="mission"
                  name="mission"
                  required
                  defaultValue=""
                  className="mt-2 w-full rounded-md border border-input bg-charcoal px-3.5 py-3 text-sm text-foreground outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
                >
                  <option value="" disabled>Select a mission</option>
                  <option value="enterprise">Enterprise Advisory</option>
                  <option value="bfr">BFR Transformation</option>
                  <option value="ummah">Ummah Impact / Digital Inclusion</option>
                </select>
                {fieldErrors.mission && (
                  <p className="mt-1.5 text-xs text-destructive">{fieldErrors.mission}</p>
                )}
              </div>
              <div>
                <label htmlFor="brief" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Brief (optional)
                </label>
                <textarea
                  id="brief"
                  name="brief"
                  rows={4}
                  maxLength={2000}
                  placeholder="One paragraph on the mission, market, and timeline."
                  className="mt-2 w-full rounded-md border border-input bg-charcoal px-3.5 py-3 text-sm text-foreground outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
                />
              </div>

              {status.kind === "error" && (
                <div
                  role="alert"
                  className="flex items-start gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive-foreground"
                >
                  <AlertCircle size={16} className="mt-0.5 shrink-0 text-destructive" />
                  <span>{status.message}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={status.kind === "loading"}
                className="mt-2 w-full rounded-md bg-gold px-6 py-3.5 font-display text-sm font-bold uppercase tracking-wider text-primary-foreground transition hover:brightness-110 hover:shadow-[var(--shadow-gold)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status.kind === "loading" ? "Sending…" : "Submit Brief"}
              </button>
            </div>
          )}
        </motion.form>
      </div>
    </section>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  error,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        aria-invalid={!!error}
        className={`mt-2 w-full rounded-md border bg-charcoal px-3.5 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30 ${
          error ? "border-destructive" : "border-input"
        }`}
      />
      {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
    </div>
  );
}
