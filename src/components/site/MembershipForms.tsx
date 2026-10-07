import { useState, type FormEvent, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  AVAILABILITY_HOURS, COLLECTIVE_DOMAINS, COMPANY_SIZES, CORPORATE_INTERESTS, EXPERTISE, MARKETS,
  PROGRAM_INTERESTS, REFERRALS, SECTORS, corporateSchema, personalSchema,
} from "@/lib/membership-options";
import { submitCorporateApplication, submitPersonalApplication } from "@/lib/membership.functions";
import { PlanStep } from "@/components/site/PlanPicker";
import { rm, type BillingCycle } from "@/lib/plans";

type Receipt = { reference: string; plan_name: string; billing_cycle: string; price: number };
type PlanProps = { planDefault?: string; cycleDefault?: BillingCycle };

const fieldClass = "mt-2 w-full rounded-md border border-border bg-background px-4 py-3 text-foreground outline-none focus:border-gold";

function Chips({ legend, options, value, onChange, required }: { legend: string; options: readonly string[]; value: string[]; onChange: (v: string[]) => void; required?: boolean }) {
  return <fieldset><legend className="mb-3 text-sm">{legend}{required ? " *" : ""}</legend><div className="flex flex-wrap gap-2">{options.map(item => {
    const on = value.includes(item);
    return <label key={item} className={`cursor-pointer rounded-md border px-3 py-2 text-sm transition-colors ${on ? "border-gold bg-gold/10 text-gold" : "border-border text-muted-foreground hover:border-gold/60"}`}><input className="sr-only" type="checkbox" checked={on} onChange={() => onChange(on ? value.filter(v => v !== item) : [...value, item])} />{item}</label>;
  })}</div></fieldset>;
}
function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return <label className="block text-sm">{label}{required ? " *" : ""}{children}</label>;
}
function Section({ title, children }: { title: string; children: ReactNode }) {
  return <div className="grid gap-5 border-t border-border pt-6"><p className="font-mono text-xs uppercase tracking-wider text-gold">{title}</p>{children}</div>;
}
function Confirmation({ receipt, what }: { receipt: Receipt; what: string }) {
  return <div role="status" className="border-t border-gold pt-8"><p className="font-mono text-xs uppercase text-gold">Application received</p><h3 className="font-display mt-4 text-3xl font-bold">Thank you.</h3><p className="mt-4 text-muted-foreground">Your reference is <strong className="text-foreground">{receipt.reference}</strong>. BRQ+ reviews every {what} application personally. If approved, you will receive an email invitation to set up your account.</p><p className="mt-4 rounded-md border border-gold/40 bg-gold/5 px-4 py-3 text-sm">Plan: <strong>{receipt.plan_name}</strong> · {receipt.billing_cycle === "annual" ? "Annual" : "Monthly"} · <strong>{rm(receipt.price)}</strong>{receipt.billing_cycle === "annual" ? " per year" : " per month"}. Your first invoice is issued once your application is approved.</p></div>;
}
function issuesText(err: { issues: { path: PropertyKey[]; message: string }[] }) {
  const paths = Array.from(new Set(err.issues.map(i => String(i.path[0] ?? ""))));
  return `Please check: ${paths.filter(Boolean).join(", ") || "required fields"}.`;
}

const personalInitial = {
  fullName: "", email: "", phone: "", linkedinUrl: "", country: "", city: "", roleTitle: "", organisation: "", sector: "",
  expertise: [] as string[], yearsExperience: "", languages: "", programInterests: [] as string[], bio: "", referralSource: "",
  wantsCollective: false, primaryDomain: "", markets: [] as string[], mandate: "", availability: "", consent: false,
};

export function PersonalMembershipForm({ collectiveDefault = false, source = "web", planDefault = "", cycleDefault = "monthly" }: { collectiveDefault?: boolean; source?: string } & PlanProps) {
  const submit = useServerFn(submitPersonalApplication);
  const [v, setV] = useState({ ...personalInitial, planCode: planDefault, billingCycle: cycleDefault as BillingCycle, wantsCollective: collectiveDefault, programInterests: collectiveDefault ? ["The Collective"] : [] });
  const [receipt, setReceipt] = useState<Receipt | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV(p => ({ ...p, [k]: val }));
  async function onSubmit(e: FormEvent) {
    e.preventDefault(); setError("");
    const parsed = personalSchema.safeParse({ ...v, source, languages: v.languages.split(",").map(s => s.trim()).filter(Boolean) });
    if (!parsed.success) { setError(issuesText(parsed.error)); return; }
    setBusy(true);
    try { setReceipt(await submit({ data: parsed.data })); window.scrollTo({ top: 0, behavior: "smooth" }); }
    catch (c) { setError(c instanceof Error ? c.message : "Please try again."); } finally { setBusy(false); }
  }
  if (receipt) return <Confirmation receipt={receipt} what="personal membership" />;
  const text = (k: "fullName" | "email" | "phone" | "linkedinUrl" | "country" | "city" | "roleTitle" | "organisation", label: string, req = false, type = "text", max = 200) =>
    <Field label={label} required={req}><input className={fieldClass} type={type} value={v[k]} maxLength={max} required={req} onChange={e => set(k, e.target.value)} /></Field>;
  return <form onSubmit={onSubmit} noValidate className="grid gap-6">
    <PlanStep type="personal" planCode={v.planCode} cycle={v.billingCycle} onPlan={c => set("planCode", c)} onCycle={c => set("billingCycle", c)} recommend={v.wantsCollective ? "executive" : undefined} />
    <Section title="About you"><div className="grid gap-5 sm:grid-cols-2">
      {text("fullName", "Full name", true, "text", 120)}{text("email", "Email", true, "email", 255)}{text("phone", "Phone", false, "tel", 40)}{text("linkedinUrl", "LinkedIn URL", false, "url", 300)}{text("country", "Country", true, "text", 100)}{text("city", "City", false, "text", 100)}
    </div></Section>
    <Section title="Your work"><div className="grid gap-5 sm:grid-cols-2">
      {text("roleTitle", "Current role/title", true)}{text("organisation", "Organisation")}
      <Field label="Sector" required><select className={fieldClass} value={v.sector} onChange={e => set("sector", e.target.value)}><option value="">Select sector</option>{SECTORS.map(s => <option key={s}>{s}</option>)}</select></Field>
      <Field label="Years of experience"><input className={fieldClass} type="number" min={0} max={70} value={v.yearsExperience} onChange={e => set("yearsExperience", e.target.value)} /></Field>
      <Field label="Languages (comma separated)"><input className={fieldClass} value={v.languages} maxLength={300} onChange={e => set("languages", e.target.value)} placeholder="English, Malay" /></Field>
      <Field label="How did you hear about us?"><select className={fieldClass} value={v.referralSource} onChange={e => set("referralSource", e.target.value)}><option value="">Select</option>{REFERRALS.map(s => <option key={s}>{s}</option>)}</select></Field>
    </div>
      <Chips legend="Areas of expertise" required options={EXPERTISE} value={v.expertise} onChange={x => set("expertise", x)} />
      <Chips legend="Interests in BRQ+ programs" options={PROGRAM_INTERESTS} value={v.programInterests} onChange={x => set("programInterests", x)} />
      <Field label="Short bio"><textarea className={`${fieldClass} min-h-28 resize-y`} maxLength={1000} value={v.bio} onChange={e => set("bio", e.target.value)} /><span className="mt-1 block text-right text-xs text-muted-foreground">{v.bio.length}/1000</span></Field>
    </Section>
    <Section title="The Collective">
      <label className="flex items-start gap-3 text-sm leading-relaxed"><input className="mt-1 accent-gold" type="checkbox" checked={v.wantsCollective} onChange={e => set("wantsCollective", e.target.checked)} />I want to be considered for The Collective (fractional senior executive).</label>
      {v.wantsCollective && v.planCode !== "executive" && <p className="text-xs text-cyan">We recommend the Executive plan for The Collective. <button type="button" className="underline hover:text-gold" onClick={() => set("planCode", "executive")}>Switch to Executive</button></p>}
      {v.wantsCollective && <div className="grid gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Primary domain" required><select className={fieldClass} value={v.primaryDomain} onChange={e => set("primaryDomain", e.target.value)}><option value="">Select domain</option>{COLLECTIVE_DOMAINS.map(s => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Availability" required><select className={fieldClass} value={v.availability} onChange={e => set("availability", e.target.value)}><option value="">Select hours/month</option>{AVAILABILITY_HOURS.map(s => <option key={s}>{s}</option>)}</select></Field>
        </div>
        <Chips legend="Markets" required options={MARKETS} value={v.markets} onChange={x => set("markets", x)} />
        <Field label="Mandate description — the kind of mandates you take on" required><textarea className={`${fieldClass} min-h-24 resize-y`} maxLength={1000} value={v.mandate} onChange={e => set("mandate", e.target.value)} /></Field>
      </div>}
    </Section>
    <label className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground"><input className="mt-1 accent-gold" type="checkbox" checked={v.consent} onChange={e => set("consent", e.target.checked)} />I agree that BRQ+ may store my details and create a member profile if my application is approved. Read the <a href="/membership/agreement" target="_blank" rel="noopener" className="text-gold underline">BRQ+ Membership Agreement</a> and the BRQ+ <a href="/privacy" target="_blank" rel="noopener" className="text-gold underline">Privacy Notice</a>. *</label>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button type="submit" disabled={busy} className="w-fit">{busy ? "Submitting…" : "Submit application"}</Button>
  </form>;
}

const corpInitial = {
  legalName: "", tradingName: "", registrationNo: "", country: "", hqCity: "", website: "", sector: "", sizeBand: "", yearFounded: "",
  description: "", markets: [] as string[], interests: [] as string[], contactName: "", contactTitle: "", contactEmail: "", contactPhone: "",
  contactLinkedin: "", billingName: "", billingEmail: "", consent: false,
};

export function CorporateMembershipForm({ source = "web", planDefault = "", cycleDefault = "monthly" }: { source?: string } & PlanProps) {
  const submit = useServerFn(submitCorporateApplication);
  const [v, setV] = useState({ ...corpInitial, planCode: planDefault, billingCycle: cycleDefault as BillingCycle });
  const [receipt, setReceipt] = useState<Receipt | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV(p => ({ ...p, [k]: val }));
  async function onSubmit(e: FormEvent) {
    e.preventDefault(); setError("");
    const parsed = corporateSchema.safeParse({ ...v, source });
    if (!parsed.success) { setError(issuesText(parsed.error)); return; }
    setBusy(true);
    try { setReceipt(await submit({ data: parsed.data })); window.scrollTo({ top: 0, behavior: "smooth" }); }
    catch (c) { setError(c instanceof Error ? c.message : "Please try again."); } finally { setBusy(false); }
  }
  if (receipt) return <Confirmation receipt={receipt} what="corporate membership" />;
  type TK = "legalName" | "tradingName" | "registrationNo" | "country" | "hqCity" | "website" | "yearFounded" | "contactName" | "contactTitle" | "contactEmail" | "contactPhone" | "contactLinkedin" | "billingName" | "billingEmail";
  const text = (k: TK, label: string, req = false, type = "text", max = 200) =>
    <Field label={label} required={req}><input className={fieldClass} type={type} value={v[k]} maxLength={max} required={req} onChange={e => set(k, e.target.value)} /></Field>;
  return <form onSubmit={onSubmit} noValidate className="grid gap-6">
    <PlanStep type="corporate" planCode={v.planCode} cycle={v.billingCycle} onPlan={c => set("planCode", c)} onCycle={c => set("billingCycle", c)} />
    <Section title="Company"><div className="grid gap-5 sm:grid-cols-2">
      {text("legalName", "Legal name", true)}{text("tradingName", "Trading name")}{text("registrationNo", "Registration number", true, "text", 100)}{text("country", "Country of incorporation", true, "text", 100)}{text("hqCity", "HQ city", false, "text", 100)}{text("website", "Website", false, "url", 300)}
      <Field label="Industry/sector" required><select className={fieldClass} value={v.sector} onChange={e => set("sector", e.target.value)}><option value="">Select sector</option>{SECTORS.map(s => <option key={s}>{s}</option>)}</select></Field>
      <Field label="Company size"><select className={fieldClass} value={v.sizeBand} onChange={e => set("sizeBand", e.target.value)}><option value="">Select size</option>{COMPANY_SIZES.map(s => <option key={s} value={s}>{s} employees</option>)}</select></Field>
      {text("yearFounded", "Year founded", false, "number", 4)}
    </div>
      <Field label="Company description" required><textarea className={`${fieldClass} min-h-32 resize-y`} maxLength={1500} value={v.description} onChange={e => set("description", e.target.value)} /><span className="mt-1 block text-right text-xs text-muted-foreground">{v.description.length}/1500</span></Field>
      <Chips legend="Markets of operation" options={MARKETS} value={v.markets} onChange={x => set("markets", x)} />
      <Chips legend="Areas of interest with BRQ+" options={CORPORATE_INTERESTS} value={v.interests} onChange={x => set("interests", x)} />
    </Section>
    <Section title="Primary contact / company admin"><div className="grid gap-5 sm:grid-cols-2">
      {text("contactName", "Full name", true, "text", 120)}{text("contactTitle", "Job title", true)}{text("contactEmail", "Work email", true, "email", 255)}{text("contactPhone", "Phone", true, "tel", 40)}{text("contactLinkedin", "LinkedIn URL", false, "url", 300)}
    </div></Section>
    <Section title="Billing contact (optional)"><div className="grid gap-5 sm:grid-cols-2">{text("billingName", "Name", false, "text", 120)}{text("billingEmail", "Email", false, "email", 255)}</div></Section>
    <label className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground"><input className="mt-1 accent-gold" type="checkbox" checked={v.consent} onChange={e => set("consent", e.target.checked)} />I confirm I am authorised to apply on behalf of this company and agree that BRQ+ may store these details and create a company profile if approved. Read the <a href="/membership/agreement" target="_blank" rel="noopener" className="text-gold underline">BRQ+ Membership Agreement</a> and the BRQ+ <a href="/privacy" target="_blank" rel="noopener" className="text-gold underline">Privacy Notice</a>. *</label>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button type="submit" disabled={busy} className="w-fit">{busy ? "Submitting…" : "Submit application"}</Button>
  </form>;
}
