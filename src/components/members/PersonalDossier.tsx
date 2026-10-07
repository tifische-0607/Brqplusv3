import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyDossier, updateMyDossier } from "@/lib/member-portal.functions";
import { EXPERTISE, PROGRAM_INTERESTS, SECTORS } from "@/lib/membership-options";
import { btnGold, focusRing, inputCls, labelCls, linkGold } from "./portal-ui";

const input = inputCls;
const lab = labelCls;

export function MemberTypeBadge({ company }: { company: { legal_name: string; trading_name: string | null } | null }) {
  return <span className="inline-block rounded-full border border-gold/50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold">
    {company ? `Corporate · ${company.trading_name || company.legal_name}` : "Personal"}
  </span>;
}

export function PersonalDossier() {
  const qc = useQueryClient();
  const fetchFn = useServerFn(getMyDossier);
  const saveFn = useServerFn(updateMyDossier);
  const q = useQuery({ queryKey: ["my-dossier"], queryFn: () => fetchFn() });
  const [v, setV] = useState<any>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!q.data) return;
    const p = q.data.profile;
    setV({
      full_name: p.full_name ?? "", job_title: p.job_title ?? "", organisation: p.organisation ?? "", country: p.country ?? "",
      city: p.city ?? "", sector: p.sector ?? "", phone: p.phone ?? "", linkedin_url: p.linkedin_url ?? "", bio: p.bio ?? "",
      expertise: p.expertise ?? [], languages: (p.languages ?? []).join(", "), program_interests: p.program_interests ?? [],
      years_experience: p.years_experience ?? "",
    });
  }, [q.data]);
  const save = useMutation({
    mutationFn: () => saveFn({ data: {
      ...v, languages: String(v.languages).split(",").map((s: string) => s.trim()).filter(Boolean),
      years_experience: v.years_experience === "" ? null : Number(v.years_experience),
    } }),
    onSuccess: () => { setSaved(true); qc.invalidateQueries({ queryKey: ["my-dossier"] }); },
  });
  if (q.isLoading || !v) return <p role="status" className="text-sm text-muted-foreground">Loading dossier…</p>;
  if (q.isError) return <p role="alert" className="text-sm text-destructive">{(q.error as Error).message}</p>;
  const { profile: p, company, completeness } = q.data!;
  const set = (k: string, val: unknown) => { setSaved(false); setV((o: any) => ({ ...o, [k]: val })); };
  const toggle = (k: string, item: string) => set(k, v[k].includes(item) ? v[k].filter((x: string) => x !== item) : [...v[k], item]);
  const text = (k: string, label: string, max = 200) => <label className="flex flex-col gap-1"><span className={lab}>{label}</span><input className={input} maxLength={max} value={v[k]} onChange={e => set(k, e.target.value)} /></label>;

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <MemberTypeBadge company={company} />
      <span className="text-muted-foreground">Membership: <span className="capitalize text-foreground">{p.membership_status}</span></span>
      <span className="text-muted-foreground">The Collective: <span className="text-foreground">{p.collective_status === "approved" ? "Member" : p.collective_status === "applied" ? "Considered" : "—"}</span></span>
      {company && <Link to="/company" className={linkGold}>Company profile →</Link>}
      <span className="text-muted-foreground">Profile {completeness}% complete</span>
    </div>
    <form onSubmit={e => { e.preventDefault(); save.mutate(); }} className="grid gap-4 sm:grid-cols-2">
      {text("full_name", "Full name")}{text("job_title", "Role/title")}{text("organisation", "Organisation")}
      <label className="flex flex-col gap-1"><span className={lab}>Sector</span><select className={input} value={v.sector} onChange={e => set("sector", e.target.value)}><option value="">—</option>{[...new Set([...SECTORS, v.sector].filter(Boolean))].map(s => <option key={s}>{s}</option>)}</select></label>
      {text("country", "Country", 100)}{text("city", "City", 100)}{text("phone", "Phone", 40)}{text("linkedin_url", "LinkedIn URL", 300)}
      <label className="flex flex-col gap-1"><span className={lab}>Years of experience</span><input type="number" min={0} max={70} className={input} value={v.years_experience} onChange={e => set("years_experience", e.target.value)} /></label>
      {text("languages", "Languages (comma separated)", 300)}
      <fieldset className="sm:col-span-2"><legend className={lab}>Areas of expertise</legend><div className="mt-2 flex flex-wrap gap-2">{[...new Set([...EXPERTISE, ...v.expertise])].map((x: string) => <button type="button" key={x} aria-pressed={v.expertise.includes(x)} onClick={() => toggle("expertise", x)} className={`min-h-11 rounded-md border px-3 py-1.5 text-xs ${focusRing} ${v.expertise.includes(x) ? "border-gold bg-gold/10 text-gold" : "border-border text-muted-foreground"}`}>{x}</button>)}</div></fieldset>
      <fieldset className="sm:col-span-2"><legend className={lab}>Program interests</legend><div className="mt-2 flex flex-wrap gap-2">{PROGRAM_INTERESTS.map(x => <button type="button" key={x} aria-pressed={v.program_interests.includes(x)} onClick={() => toggle("program_interests", x)} className={`min-h-11 rounded-md border px-3 py-1.5 text-xs ${focusRing} ${v.program_interests.includes(x) ? "border-gold bg-gold/10 text-gold" : "border-border text-muted-foreground"}`}>{x}</button>)}</div></fieldset>
      <label className="flex flex-col gap-1 sm:col-span-2"><span className={lab}>Short bio</span><textarea className={`${input} min-h-28`} maxLength={1000} value={v.bio} onChange={e => set("bio", e.target.value)} /></label>
      {save.isError && <p role="alert" className="text-sm text-destructive sm:col-span-2">{(save.error as Error).message}</p>}
      <div className="flex items-center justify-end gap-3 sm:col-span-2">
        {saved && <span role="status" className="text-xs text-cyan">Saved.</span>}
        <button disabled={save.isPending} className={btnGold}>{save.isPending ? "Saving…" : "Save dossier"}</button>
      </div>
    </form>
    <p className="text-xs text-muted-foreground">Membership status, member type and company role are managed by BRQ+ administrators.</p>
  </div>;
}
