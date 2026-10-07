import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "./SectionTitle";
import { founderApplicationSchema, NEEDS, SECTORS, STAGES, submitFounderApplication } from "@/lib/founders.functions";

const fieldClass = "mt-2 w-full rounded-md border border-border bg-background px-4 py-3 text-foreground outline-none focus:border-gold";
const initial = { fullName: "", email: "", linkedinUrl: "", companyName: "", website: "", country: "", sector: "", stage: "", needs: [] as string[], challenge: "", consent: false };

export function FounderApplicationForm() {
  const submit = useServerFn(submitFounderApplication);
  const [values, setValues] = useState(initial);
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function set(key: keyof typeof initial, value: string | string[] | boolean) {
    setValues(previous => ({ ...previous, [key]: value }));
  }
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const parsed = founderApplicationSchema.safeParse(values);
    if (!parsed.success) { setError("Please complete all required fields and check your URLs and selections."); return; }
    setBusy(true);
    try { const result = await submit({ data: parsed.data }); setReference(result.reference); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Please try again."); }
    finally { setBusy(false); }
  }
  const textField = (key: "fullName" | "email" | "linkedinUrl" | "companyName" | "website" | "country", label: string, required = false, type = "text") =>
    <label className="block text-sm" key={key}>{label}{required ? " *" : ""}<input className={fieldClass} value={values[key]} onChange={event => set(key, event.target.value)} required={required} type={type} maxLength={key === "email" ? 255 : key === "country" ? 100 : key === "fullName" ? 120 : key === "companyName" ? 200 : 300} /></label>;
  return <section id="apply" className="scroll-mt-24 border-t border-border bg-charcoal px-5 py-20 lg:px-8">
    <div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[1fr_1.2fr] lg:gap-20">
      <SectionTitle eyebrow="Founders @ BRQ+" title="Apply to work with us" description="Tell us about your company and the challenge you are working through." />
      {reference ? <div role="status" className="mt-10 border-t border-gold pt-8 lg:mt-0"><p className="font-mono text-xs uppercase text-gold">Application received</p><h3 className="font-display mt-4 text-3xl font-bold">Thank you.</h3><p className="mt-4 text-muted-foreground">Your reference is <strong className="text-foreground">{reference}</strong>.</p></div> :
      <form onSubmit={onSubmit} noValidate className="mt-10 grid gap-6 lg:mt-0">
        <div className="grid gap-5 sm:grid-cols-2">{textField("fullName", "Full name", true)}{textField("email", "Email", true, "email")}{textField("linkedinUrl", "LinkedIn URL", false, "url")}{textField("companyName", "Company name", true)}{textField("website", "Website", false, "url")}{textField("country", "Country", true)}</div>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="text-sm">Sector *<select className={fieldClass} value={values.sector} onChange={event => set("sector", event.target.value)} required><option value="">Select sector</option>{SECTORS.map(item => <option key={item}>{item}</option>)}</select></label>
          <label className="text-sm">Stage *<select className={fieldClass} value={values.stage} onChange={event => set("stage", event.target.value)} required><option value="">Select stage</option>{STAGES.map(item => <option key={item}>{item}</option>)}</select></label>
        </div>
        <fieldset><legend className="mb-3 text-sm">What do you need help with? *</legend><div className="flex flex-wrap gap-2">{NEEDS.map(item => <label key={item} className={`cursor-pointer rounded-md border px-3 py-2 text-sm transition-colors ${values.needs.includes(item) ? "border-gold bg-gold/10 text-gold" : "border-border text-muted-foreground hover:border-gold/60"}`}><input className="sr-only" type="checkbox" checked={values.needs.includes(item)} onChange={() => set("needs", values.needs.includes(item) ? values.needs.filter(need => need !== item) : [...values.needs, item])} />{item}</label>)}</div></fieldset>
        <label className="text-sm">Short description of the challenge *<textarea className={`${fieldClass} min-h-32 resize-y`} maxLength={1000} value={values.challenge} onChange={event => set("challenge", event.target.value)} required /><span className="mt-1 block text-right text-xs text-muted-foreground">{values.challenge.length}/1000</span></label>
        <label className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground"><input className="mt-1 accent-gold" type="checkbox" checked={values.consent} onChange={event => set("consent", event.target.checked)} />I agree that BRQ+ may store my details and contact me about this application, as set out in the BRQ+ <a href="/privacy" target="_blank" rel="noopener" className="text-gold underline">Privacy Notice</a>. *</label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={busy} className="w-fit">{busy ? "Submitting…" : "Submit application"}</Button>
      </form>}
    </div>
  </section>;
}