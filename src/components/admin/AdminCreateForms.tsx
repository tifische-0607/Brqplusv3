import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { adminCreateCompany, adminCreateMember, adminListCompanies } from "@/lib/membership.functions";

const input = "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none";
const btn = "inline-flex items-center gap-1.5 rounded-md border border-gold bg-gold/10 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gold hover:bg-gold/20 disabled:opacity-50";

function F({ label, name, type = "text", required, placeholder }: { label: string; name: string; type?: string; required?: boolean; placeholder?: string }) {
  return <label className="text-sm text-foreground">{label}{required && <span className="text-gold"> *</span>}<input name={name} type={type} required={required} placeholder={placeholder} className={input} /></label>;
}

const val = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim() || undefined;

export function CreateCompanyButton() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const fn = useServerFn(adminCreateCompany);
  const m = useMutation({
    mutationFn: (fd: FormData) => fn({ data: {
      legal_name: val(fd, "legal_name") ?? "", trading_name: val(fd, "trading_name"), registration_no: val(fd, "registration_no"),
      country: val(fd, "country"), hq_city: val(fd, "hq_city"), website: val(fd, "website"), sector: val(fd, "sector"),
      description: val(fd, "description"), billing_contact_name: val(fd, "billing_contact_name"), billing_contact_email: val(fd, "billing_contact_email") ?? "",
    } }),
    onSuccess: () => { setOpen(false); qc.invalidateQueries({ queryKey: ["admin-companies"] }); },
  });
  if (!open) return <button type="button" onClick={() => setOpen(true)} className={btn}><Plus className="h-3.5 w-3.5" aria-hidden />New company</button>;
  return (
    <form onSubmit={(e) => { e.preventDefault(); m.mutate(new FormData(e.currentTarget)); }} aria-label="Create company" className="grid w-full gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
      <div className="flex items-center justify-between sm:col-span-2"><h2 className="font-display text-lg font-bold">New company</h2><button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-muted-foreground hover:text-gold"><X className="h-4 w-4" /></button></div>
      <F label="Legal name" name="legal_name" required /><F label="Trading name" name="trading_name" />
      <F label="Registration no." name="registration_no" /><F label="Sector" name="sector" />
      <F label="Country" name="country" /><F label="HQ city" name="hq_city" />
      <F label="Website" name="website" placeholder="https://" /><F label="Billing contact name" name="billing_contact_name" />
      <F label="Billing contact email" name="billing_contact_email" type="email" />
      <label className="text-sm sm:col-span-2">Description<textarea name="description" maxLength={3000} className={`${input} min-h-20`} /></label>
      <div className="flex items-center gap-3 sm:col-span-2"><button type="submit" disabled={m.isPending} className={btn}>{m.isPending ? "Creating…" : "Create company"}</button>
        <p className="text-xs text-muted-foreground">Created as an active company. Add people to it from Members.</p></div>
      {m.isError && <p role="alert" className="text-xs text-destructive sm:col-span-2">{(m.error as Error).message}</p>}
    </form>
  );
}

export function CreateMemberButton({ companyId }: { companyId?: string }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const qc = useQueryClient();
  const fn = useServerFn(adminCreateMember);
  const listCo = useServerFn(adminListCompanies);
  const cos = useQuery({ queryKey: ["admin-companies"], queryFn: () => listCo(), enabled: open && !companyId, retry: false });
  const m = useMutation({
    mutationFn: (fd: FormData) => fn({ data: {
      email: val(fd, "email") ?? "", full_name: val(fd, "full_name") ?? "", job_title: val(fd, "job_title"), phone: val(fd, "phone"),
      country: val(fd, "country"), sector: val(fd, "sector"), linkedin_url: val(fd, "linkedin_url"),
      company_id: companyId ?? val(fd, "company_id"), company_role: (val(fd, "company_role") as "admin" | "member") ?? "member",
      redirect_to: `${window.location.origin}/onboarding`,
    } }),
    onSuccess: (_r, fd) => { setOpen(false); setDone(`Profile created and invitation sent to ${fd.get("email")}.`); qc.invalidateQueries(); },
  });
  if (!open) return <div className="flex flex-col items-end gap-1"><button type="button" onClick={() => { setOpen(true); setDone(null); }} className={btn}><Plus className="h-3.5 w-3.5" aria-hidden />New member</button>{done && <p role="status" className="text-xs text-cyan">{done}</p>}</div>;
  return (
    <form onSubmit={(e) => { e.preventDefault(); m.mutate(new FormData(e.currentTarget)); }} aria-label="Create member profile" className="grid w-full gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
      <div className="flex items-center justify-between sm:col-span-2"><h2 className="font-display text-lg font-bold">New member profile</h2><button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-muted-foreground hover:text-gold"><X className="h-4 w-4" /></button></div>
      <F label="Full name" name="full_name" required /><F label="Email" name="email" type="email" required />
      <F label="Job title" name="job_title" /><F label="Phone" name="phone" />
      <F label="Country" name="country" /><F label="Sector" name="sector" />
      <F label="LinkedIn URL" name="linkedin_url" placeholder="https://linkedin.com/in/…" />
      {!companyId && <label className="text-sm">Company (optional)<select name="company_id" className={input} defaultValue=""><option value="">None — personal member</option>{(cos.data ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.legal_name}</option>)}</select></label>}
      <label className="text-sm">Company role<select name="company_role" className={input} defaultValue="member"><option value="member">Member</option><option value="admin">Company admin</option></select></label>
      <div className="flex items-center gap-3 sm:col-span-2"><button type="submit" disabled={m.isPending} className={btn}>{m.isPending ? "Creating…" : "Create & send invite"}</button>
        <p className="text-xs text-muted-foreground">They'll get an email to set their password and finish onboarding.</p></div>
      {m.isError && <p role="alert" className="text-xs text-destructive sm:col-span-2">{(m.error as Error).message}</p>}
    </form>
  );
}
