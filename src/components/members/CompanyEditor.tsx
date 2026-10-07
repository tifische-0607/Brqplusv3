import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { updateMyCompany } from "@/lib/member-portal.functions";
import { COMPANY_SIZES, CORPORATE_INTERESTS, MARKETS } from "@/lib/membership-options";
import { btnGold as btn, focusRing, inputCls as input, labelCls as lab } from "./portal-ui";

export function CompanyEditor({ company, onSaved }: { company: any; onSaved: () => void }) {
  const saveFn = useServerFn(updateMyCompany);
  const [v, setV] = useState<any>({});
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => setV({
    trading_name: company.trading_name ?? "", hq_city: company.hq_city ?? "", website: company.website ?? "", sector: company.sector ?? "",
    size_band: company.size_band ?? "", description: company.description ?? "", markets: company.markets ?? [], interests: company.interests ?? [],
    billing_contact_name: company.billing_contact_name ?? "", billing_contact_email: company.billing_contact_email ?? "",
  }), [company]);
  const save = useMutation({ mutationFn: (extra?: { logo_path: string }) => saveFn({ data: { ...v, ...(extra ?? {}) } }), onSuccess: () => { setMsg("Saved."); onSaved(); }, onError: (e: any) => setMsg(e.message) });
  const set = (k: string, val: unknown) => setV((o: any) => ({ ...o, [k]: val }));
  const toggle = (k: string, x: string) => set(k, v[k]?.includes(x) ? v[k].filter((y: string) => y !== x) : [...(v[k] ?? []), x]);
  async function uploadLogo(file: File) {
    setMsg(null);
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type) || file.size > 2 * 1024 * 1024) return setMsg("Logo must be PNG, JPG, WebP or SVG under 2 MB.");
    const path = `${company.id}/logo-${Date.now()}.${file.name.split(".").pop()?.toLowerCase() ?? "png"}`;
    const { error } = await supabase.storage.from("company-logos").upload(path, file, { upsert: true, contentType: file.type });
    if (error) return setMsg(error.message);
    save.mutate({ logo_path: path });
  }
  const text = (k: string, label: string, max = 200) => <label className="flex flex-col gap-1"><span className={lab}>{label}</span><input className={input} maxLength={max} value={v[k] ?? ""} onChange={e => set(k, e.target.value)} /></label>;
  return <form onSubmit={e => { e.preventDefault(); save.mutate(undefined); }} className="grid gap-4 sm:grid-cols-2">
    {text("trading_name", "Trading name")}{text("hq_city", "HQ city", 100)}{text("website", "Website (https://)", 300)}{text("sector", "Sector", 100)}
    <label className="flex flex-col gap-1"><span className={lab}>Company size</span><select className={input} value={v.size_band ?? ""} onChange={e => set("size_band", e.target.value)}><option value="">—</option>{COMPANY_SIZES.map(s => <option key={s}>{s}</option>)}</select></label>
    <label className="flex flex-col gap-1"><span className={lab}>Logo</span><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="text-xs text-muted-foreground" onChange={e => e.target.files?.[0] && uploadLogo(e.target.files[0])} /></label>
    {text("billing_contact_name", "Billing contact", 120)}{text("billing_contact_email", "Billing email", 255)}
    <fieldset className="sm:col-span-2"><legend className={lab}>Markets</legend><div className="mt-2 flex flex-wrap gap-2">{MARKETS.map(x => <button type="button" key={x} aria-pressed={v.markets?.includes(x)} onClick={() => toggle("markets", x)} className={`min-h-11 rounded-md border px-3 py-1.5 text-xs ${focusRing} ${v.markets?.includes(x) ? "border-gold bg-gold/10 text-gold" : "border-border text-muted-foreground"}`}>{x}</button>)}</div></fieldset>
    <fieldset className="sm:col-span-2"><legend className={lab}>Interests with BRQ+</legend><div className="mt-2 flex flex-wrap gap-2">{CORPORATE_INTERESTS.map(x => <button type="button" key={x} aria-pressed={v.interests?.includes(x)} onClick={() => toggle("interests", x)} className={`min-h-11 rounded-md border px-3 py-1.5 text-xs ${focusRing} ${v.interests?.includes(x) ? "border-gold bg-gold/10 text-gold" : "border-border text-muted-foreground"}`}>{x}</button>)}</div></fieldset>
    <label className="flex flex-col gap-1 sm:col-span-2"><span className={lab}>Description</span><textarea className={`${input} min-h-28`} maxLength={1500} value={v.description ?? ""} onChange={e => set("description", e.target.value)} /></label>
    <div className="flex items-center justify-end gap-3 sm:col-span-2">{msg && <span role={save.isError ? "alert" : "status"} className="text-xs text-muted-foreground">{msg}</span>}<button disabled={save.isPending} className={btn}>{save.isPending ? "Saving…" : "Save company"}</button></div>
  </form>;
}

