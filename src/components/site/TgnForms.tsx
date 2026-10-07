import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "./SectionTitle";
import { ATTENDING_AS, CAREER_STAGES, EXPERTISE, GEOGRAPHIES, HOURS, MODELS, REFERRALS, interestSchema, rsvpSchema, submitTgnInterest, submitTgnRsvp } from "@/lib/tgn.functions";
import { workstreamLabels } from "@/lib/tgn-workstreams";

type InterestValues = { fullName: string; email: string; linkedinUrl: string; phone: string; models: string[]; expertise: string[]; expertiseOther: string; hoursAvailable: string; geographies: string[]; geographyOther: string; careerStage: string; referralSource: string; source: string; consent: boolean; updatesOptIn: boolean };
const initialInterest: InterestValues = { fullName: "", email: "", linkedinUrl: "", phone: "", models: [], expertise: [], expertiseOther: "", hoursAvailable: "", geographies: [], geographyOther: "", careerStage: "", referralSource: "", source: "", consent: false, updatesOptIn: false };
const inputClass = "mt-2 w-full rounded-md border border-border bg-background px-4 py-3 text-foreground outline-none focus:border-gold";
function TextInput({ label, value, onChange, required, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string; placeholder?: string }) {
  return <label className="block text-sm text-foreground">{label}{required && " *"}<input className={inputClass} value={value} onChange={e => onChange(e.target.value)} required={required} type={type} placeholder={placeholder} maxLength={500} /></label>;
}
function SelectInput({ label, value, options, onChange, required }: { label: string; value: string; options: readonly string[]; onChange: (v: string) => void; required?: boolean }) {
  return <label className="block text-sm text-foreground">{label}{required && " *"}<select className={inputClass} value={value} required={required} onChange={e => onChange(e.target.value)}><option value="">Select one</option>{options.map(o => <option key={o}>{o}</option>)}</select></label>;
}
function Choices({ label, options, selected, toggle, display }: { label: string; options: readonly string[]; selected: string[]; toggle: (v: string) => void; display?: Record<string, string> }) {
  return <fieldset><legend className="mb-3 text-sm text-foreground">{label} *</legend><div className="flex flex-wrap gap-2">{options.map(o => <label key={o} className={`cursor-pointer rounded-md border px-3 py-2 text-sm transition-colors ${selected.includes(o) ? "border-gold bg-gold/10 text-gold" : "border-border text-muted-foreground hover:border-gold/60"}`}><input type="checkbox" className="sr-only" checked={selected.includes(o)} onChange={() => toggle(o)} />{display?.[o] ?? o}</label>)}</div></fieldset>;
}
function Consent({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return <label className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground"><input type="checkbox" className="mt-1 accent-gold" checked={checked} onChange={e => onChange(e.target.checked)} />{children}</label>;
}
const NEXT: Record<string, string> = {
  A: "Prepare a short summary of your specialist expertise and the projects you would like to advise on.",
  B: "Outline your product idea or innovation challenge ahead of the next founder cohort.",
  C: "Consider the markets you would like to explore and watch for the next mission announcement.",
  D: "Update your professional profile and consider which regional placement suits you best.",
};
export function InterestForm({ selectedModel }: { selectedModel: string | null }) {
  const submit = useServerFn(submitTgnInterest);
  const [v, setV] = useState<InterestValues>(() => ({ ...initialInterest, models: selectedModel && MODELS.some(m => m === selectedModel) ? [selectedModel] : [] }));
  useEffect(() => {
    if (selectedModel && MODELS.some(m => m === selectedModel)) setV(prev => ({ ...prev, models: [selectedModel] }));
  }, [selectedModel]);
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key: keyof InterestValues, value: string | boolean | string[]) => setV(prev => ({ ...prev, [key]: value }));
  const toggle = (key: "models" | "expertise" | "geographies", item: string) => set(key, v[key].includes(item) ? v[key].filter(x => x !== item) : [...v[key], item]);
  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); setError("");
    const rawSource = new URLSearchParams(window.location.search).get("src") ?? "";
    const source = ["booth", "breakout", "qr"].includes(rawSource) ? rawSource : "";
    const parsed = interestSchema.safeParse({ ...v, source });
    if (!parsed.success) { setError("Please complete all required fields and check your selections."); return; }
    setBusy(true);
    try { const result = await submit({ data: parsed.data }); setReference(result.reference); }
    catch (err) { setError(err instanceof Error ? err.message : "Please try again."); }
    finally { setBusy(false); }
  }
   return <section id="interest" className="scroll-mt-24 border-t border-border bg-charcoal px-5 py-20 lg:px-8"><div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[1fr_1.2fr] lg:gap-20"><SectionTitle eyebrow="Take part" title="Find your workstream" description="Tell us where your expertise and interests meet. We will follow up about relevant opportunities." />
    {reference ? <div role="status" className="mt-10 border-t border-gold pt-8 lg:mt-0"><p className="font-mono text-xs uppercase text-gold">Interest received</p><h3 className="font-display mt-4 text-3xl font-bold">Thank you.</h3><p className="mt-4 text-muted-foreground">Your reference is <strong className="text-foreground">{reference}</strong>.</p><p className="mt-4 text-muted-foreground">Next step: {NEXT[v.models[0] ?? selectedModel ?? "A"]}</p></div> :
    <form onSubmit={handleSubmit} className="mt-10 grid gap-6 lg:mt-0" noValidate>
      <div className="grid gap-5 sm:grid-cols-2"><TextInput label="Full name" required value={v.fullName} onChange={x => set("fullName", x)} /><TextInput label="Email" type="email" required value={v.email} onChange={x => set("email", x)} /><TextInput label="LinkedIn URL" type="url" placeholder="https://linkedin.com/in/..." value={v.linkedinUrl} onChange={x => set("linkedinUrl", x)} /><TextInput label="Phone" type="tel" value={v.phone} onChange={x => set("phone", x)} /></div>
      <Choices label="Which workstream interests you" options={MODELS} display={workstreamLabels} selected={v.models} toggle={x => toggle("models", x)} />
      <Choices label="Area of expertise" options={EXPERTISE} selected={v.expertise} toggle={x => toggle("expertise", x)} />
      {v.expertise.includes("Other") && <TextInput label="Other expertise" required value={v.expertiseOther} onChange={x => set("expertiseOther", x)} />}
      <SelectInput label="Hours per month available" required options={HOURS} value={v.hoursAvailable} onChange={x => set("hoursAvailable", x)} />
      <Choices label="Geographic preference" options={GEOGRAPHIES} selected={v.geographies} toggle={x => toggle("geographies", x)} />
      {v.geographies.includes("Other") && <TextInput label="Other geography" required value={v.geographyOther} onChange={x => set("geographyOther", x)} />}
      <div className="grid gap-5 sm:grid-cols-2"><SelectInput label="Career stage" options={CAREER_STAGES} value={v.careerStage} onChange={x => set("careerStage", x)} /><SelectInput label="Where did you hear about us" options={REFERRALS} value={v.referralSource} onChange={x => set("referralSource", x)} /></div>
      <Consent checked={v.consent} onChange={x => set("consent", x)}>I agree that The Give Network and BRQ+ may store my details and share my profile with matched partner organisations for the purpose of this programme, as set out in the BRQ+ <a href="/privacy" target="_blank" rel="noopener" className="text-gold underline">Privacy Notice</a>. *</Consent>
      <Consent checked={v.updatesOptIn} onChange={x => set("updatesOptIn", x)}>Keep me updated on TGN webinars and events.</Consent>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy} className="w-fit">{busy ? "Submitting…" : "Submit interest"}</Button>
    </form>}
  </div></section>;
}
function downloadCalendar() {
  const text = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//BRQ+//TGN//EN", "BEGIN:VEVENT", "UID:tgn-overseas-partners-20261101@brqplus.ai", `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`, "DTSTART:20261101T020000Z", "DTEND:20261101T050000Z", "SUMMARY:The Give Network - Overseas Partners Session", "LOCATION:AMP Singapore (venue TBC)", "DESCRIPTION:Overseas Partners Session. Venue to be confirmed.", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = "tgn-overseas-partners-session.ics"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function RsvpForm() {
  const submit = useServerFn(submitTgnRsvp);
  const [v, setV] = useState({ fullName: "", email: "", organisation: "", attendingAs: "", country: "", dietaryNotes: "", consent: false });
  const [done, setDone] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const set = (key: keyof typeof v, value: string | boolean) => setV(prev => ({ ...prev, [key]: value }));
  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); setError("");
    const parsed = rsvpSchema.safeParse(v);
    if (!parsed.success) { setError("Please complete all required fields and check your selections."); return; }
    setBusy(true);
    try { await submit({ data: parsed.data }); setDone(true); }
    catch (err) { setError(err instanceof Error ? err.message : "Please try again."); }
    finally { setBusy(false); }
  }
  return <section id="rsvp" className="scroll-mt-24 border-t border-border px-5 py-20 lg:px-8"><div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[1fr_1.2fr] lg:gap-20"><div><SectionTitle eyebrow="1 November 2026" title="Overseas Partners Session" description="Join professionals, partners, and sponsors in Singapore. 10 AM–1 PM · AMP Singapore (venue TBC)." /></div>
    {done ? <div role="status" className="mt-10 border-t border-gold pt-8 lg:mt-0"><h3 className="font-display text-3xl font-bold">You're on the list.</h3><p className="mt-4 text-muted-foreground">Sunday 1 Nov 2026 · 10 AM–1 PM · AMP Singapore (venue TBC).</p><Button className="mt-6" onClick={downloadCalendar}>Add to calendar</Button></div> :
    <form className="mt-10 grid gap-6 lg:mt-0" onSubmit={handleSubmit} noValidate><div className="grid gap-5 sm:grid-cols-2"><TextInput label="Full name" required value={v.fullName} onChange={x => set("fullName", x)} /><TextInput label="Email" type="email" required value={v.email} onChange={x => set("email", x)} /><TextInput label="Organisation" value={v.organisation} onChange={x => set("organisation", x)} /><SelectInput label="Attending as" required options={ATTENDING_AS} value={v.attendingAs} onChange={x => set("attendingAs", x)} /><TextInput label="Country" value={v.country} onChange={x => set("country", x)} /><TextInput label="Dietary notes" value={v.dietaryNotes} onChange={x => set("dietaryNotes", x)} /></div><Consent checked={v.consent} onChange={x => set("consent", x)}>I agree that The Give Network and BRQ+ may store my details for the purpose of this session, as set out in the BRQ+ <a href="/privacy" target="_blank" rel="noopener" className="text-gold underline">Privacy Notice</a>. *</Consent>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button type="submit" disabled={busy} className="w-fit">{busy ? "Submitting…" : "Confirm RSVP"}</Button></form>}
  </div></section>;
}
