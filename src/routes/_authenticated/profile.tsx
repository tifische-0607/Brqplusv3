import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import AvatarCropper from "@/components/AvatarCropper";
import { ExecutiveForm, type ExecFormValues } from "@/components/ExecutiveForm";
import { getMyExecutive, upsertMyExecutive } from "@/lib/executives.functions";
import { getMyProfileFull, setMyAvatar, updateMyPreferences, updateMyProfileFull } from "@/lib/portal.functions";
import { EXPERTISE, MARKETS, PROGRAM_INTERESTS, SECTORS } from "@/lib/membership-options";
import { MemberAvatar } from "@/components/members/MembersLayout";
import { MemberTypeBadge } from "@/components/members/PersonalDossier";
import { ErrorNote, PageIntro, Panel, SkeletonRows, Toggle, btnGold, focusRing, inputCls, labelCls, linkGold } from "@/components/members/portal-ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TABS = ["overview", "edit", "visibility", "collective"] as const;
type Tab = (typeof TABS)[number];

export const Route = createFileRoute("/_authenticated/profile")({
  validateSearch: (s: Record<string, unknown>) => z.object({ tab: z.enum(TABS).optional().catch(undefined) }).parse(s),
  head: () => ({ meta: [{ title: "My Profile — BRQ+ Members" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { tab = "overview" } = Route.useSearch();
  const navigate = useNavigate();
  const fn = useServerFn(getMyProfileFull);
  const q = useQuery({ queryKey: ["my-profile-full"], queryFn: () => fn() });
  const execFn = useServerFn(getMyExecutive);
  const ex = useQuery({ queryKey: ["my-executive"], queryFn: () => execFn() });
  const showCollective = !!ex.data?.executive || (q.data?.profile?.collective_status && q.data.profile.collective_status !== "none");
  const tabs = TABS.filter((t) => t !== "collective" || showCollective);
  const labels: Record<Tab, string> = { overview: "Overview", edit: "Edit Profile", visibility: "Visibility", collective: "Collective" };

  return (
    <div>
      <PageIntro eyebrow="My Profile" title="Your BRQ+ dossier">How you appear to other members, and what you share.</PageIntro>
      <Tabs value={tab} onValueChange={(value) => navigate({ to: "/profile", search: { tab: value as Tab }, replace: true })}>
        <TabsList aria-label="Profile sections" className="mb-6 flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b border-border bg-transparent p-0">
          {tabs.map((t) => (
            <TabsTrigger key={t} value={t} className="min-h-11 rounded-none border-b-2 border-transparent px-4 py-2 text-sm data-[state=active]:border-gold data-[state=active]:bg-transparent data-[state=active]:text-gold data-[state=active]:shadow-none">
              {labels[t]}
            </TabsTrigger>
          ))}
        </TabsList>
        {q.isLoading ? <SkeletonRows rows={6} /> : q.isError ? <ErrorNote error={q.error} /> : q.data ? (
          <>
            <TabsContent value="overview" className="mt-0"><Overview data={q.data} /></TabsContent>
            <TabsContent value="edit" className="mt-0"><EditProfile data={q.data} /></TabsContent>
            <TabsContent value="visibility" className="mt-0"><Visibility profile={q.data.profile} /></TabsContent>
            {showCollective && <TabsContent value="collective" className="mt-0"><CollectiveTab status={q.data.profile.collective_status} /></TabsContent>}
          </>
        ) : null}
      </Tabs>
    </div>
  );
}

function Overview({ data }: { data: any }) {
  const p = data.profile;
  const Row = ({ k, v }: { k: string; v: any }) => <div><dt className={labelCls}>{k}</dt><dd className="mt-0.5 text-sm text-foreground">{v || "—"}</dd></div>;
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Panel className="lg:col-span-2" title="As other members see you in the Directory">
         {!p.show_in_directory && <p role="status" className="mb-4 rounded-md border border-gold/40 bg-gold/5 p-3 text-xs text-gold">You are hidden from the Directory. Change this under Visibility.</p>}
        <div className="flex items-start gap-4">
          <MemberAvatar url={data.avatar_url} name={p.full_name} email="" size={72} />
          <div className="min-w-0">
            <p className="font-display text-xl font-bold text-foreground">{p.full_name || "Your name"}</p>
            <p className="text-sm text-muted-foreground">{[p.job_title, p.organisation].filter(Boolean).join(" · ") || "Add your role and organisation"}</p>
            <div className="mt-2"><MemberTypeBadge company={data.company} /></div>
            <Link to="/members/$memberId" params={{ memberId: p.id }} className="mt-3 inline-block text-xs font-semibold text-cyan hover:underline">View my public profile →</Link>
          </div>
        </div>
        {p.bio && <p className="mt-5 whitespace-pre-wrap text-sm text-foreground">{p.bio}</p>}
        <div className="mt-4 flex flex-wrap gap-2">{(p.expertise ?? []).map((x: string) => <span key={x} className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">{x}</span>)}</div>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <Row k="Location" v={[p.city, p.country].filter(Boolean).join(", ")} />
          <Row k="Sector" v={p.sector} />
          <Row k="Markets" v={(p.markets ?? []).join(", ")} />
          <Row k="Languages" v={(p.languages ?? []).join(", ")} />
          {p.show_linkedin && <Row k="LinkedIn" v={p.linkedin_url} />}
          {p.show_phone && <Row k="Phone" v={p.phone} />}
        </dl>
      </Panel>
      <Panel title="Membership">
        <dl className="space-y-3">
          <Row k="Member type" v={data.company ? "Corporate" : "Personal"} />
          <Row k="Status" v={<span className="capitalize">{p.membership_status}</span>} />
          <Row k="Member since" v={p.membership_since ? new Date(p.membership_since).toLocaleDateString() : null} />
          {data.company && <Row k="Company role" v={p.company_role === "admin" ? "Company Admin" : "Company User"} />}
          <Row k="Profile completeness" v={`${data.completeness}%`} />
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">Membership status, member type and company role are managed by BRQ+.</p>
      </Panel>
    </div>
  );
}

function EditProfile({ data }: { data: any }) {
  const qc = useQueryClient();
  const saveFn = useServerFn(updateMyProfileFull);
  const avatarFn = useServerFn(setMyAvatar);
  const p = data.profile;
  const [v, setV] = useState<any>(() => ({
    full_name: p.full_name ?? "", job_title: p.job_title ?? "", organisation: p.organisation ?? "", country: p.country ?? "",
    city: p.city ?? "", sector: p.sector ?? "", phone: p.phone ?? "", linkedin_url: p.linkedin_url ?? "", bio: p.bio ?? "",
    expertise: p.expertise ?? [], languages: (p.languages ?? []).join(", "), markets: p.markets ?? [], program_interests: p.program_interests ?? [],
    years_experience: p.years_experience ?? "", availability_hours: p.availability_hours ?? "",
  }));
  const [saved, setSaved] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [photoMsg, setPhotoMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["my-profile-full"] }); qc.invalidateQueries({ queryKey: ["portal-context"] }); };

  const save = useMutation({
    mutationFn: () => saveFn({ data: {
      ...v,
      languages: String(v.languages).split(",").map((s: string) => s.trim()).filter(Boolean),
      years_experience: v.years_experience === "" ? null : Number(v.years_experience),
      availability_hours: v.availability_hours === "" ? null : Number(v.availability_hours),
    } }),
    onSuccess: () => { setSaved(true); refresh(); },
  });
  const set = (k: string, val: unknown) => { setSaved(false); setV((o: any) => ({ ...o, [k]: val })); };
  const toggle = (k: string, item: string) => set(k, v[k].includes(item) ? v[k].filter((x: string) => x !== item) : [...v[k], item]);
  const text = (k: string, label: string, max = 200, type = "text") => (
    <label className="flex flex-col gap-1"><span className={labelCls}>{label}</span><input type={type} className={inputCls} maxLength={max} value={v[k]} onChange={(e) => set(k, e.target.value)} /></label>
  );
  const chips = (k: string, legend: string, options: readonly string[]) => (
    <fieldset className="sm:col-span-2"><legend className={labelCls}>{legend}</legend>
      <div className="mt-2 flex flex-wrap gap-2">{[...new Set([...options, ...v[k]])].map((x: string) => (
        <button type="button" key={x} aria-pressed={v[k].includes(x)} onClick={() => toggle(k, x)} className={`min-h-11 rounded-md border px-3 py-1.5 text-xs ${focusRing} ${v[k].includes(x) ? "border-gold bg-gold/10 text-gold" : "border-border text-muted-foreground"}`}>{x}</button>
      ))}</div>
    </fieldset>
  );

  function pick(file: File) {
    setPhotoMsg(null);
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 5 * 1024 * 1024) return setPhotoMsg("Use a PNG, JPG or WebP under 5 MB.");
    setCropSrc(URL.createObjectURL(file));
  }
  async function applyCrop(blob: Blob) {
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Please sign in again.");
      const path = `members/${u.user.id}/avatar-${Date.now()}.png`;
      const { error } = await supabase.storage.from("executive-avatars").upload(path, blob, { contentType: "image/png", upsert: true });
      if (error) throw error;
      await avatarFn({ data: { path } });
      setCropSrc(null);
      setPhotoMsg("Photo updated.");
      refresh();
    } catch (e) {
      setPhotoMsg(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Panel title="Photo">
        <div className="flex flex-wrap items-center gap-4">
          <MemberAvatar url={data.avatar_url} name={p.full_name} email="" size={72} />
          <label className={`${btnGold} cursor-pointer focus-within:ring-2 focus-within:ring-gold focus-within:ring-offset-2 focus-within:ring-offset-background`}>
            Upload photo
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
          </label>
          {p.avatar_path && <button type="button" className={`min-h-11 rounded-sm px-2 text-xs text-muted-foreground hover:text-destructive ${focusRing}`} onClick={async () => { await avatarFn({ data: { path: null } }); refresh(); }}>Remove</button>}
          {photoMsg && <span role="status" className="text-xs text-muted-foreground">{photoMsg}</span>}
        </div>
        {cropSrc && <div className="mt-4"><AvatarCropper src={cropSrc} busy={uploading} onCancel={() => setCropSrc(null)} onApply={applyCrop} /></div>}
      </Panel>
      <Panel title="Details">
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="grid gap-4 sm:grid-cols-2">
          {text("full_name", "Full name")}{text("job_title", "Headline / role")}{text("organisation", "Organisation")}
          <label className="flex flex-col gap-1"><span className={labelCls}>Sector</span><select className={inputCls} value={v.sector} onChange={(e) => set("sector", e.target.value)}><option value="">—</option>{[...new Set([...SECTORS, v.sector].filter(Boolean))].map((s) => <option key={s}>{s}</option>)}</select></label>
          {text("country", "Country", 100)}{text("city", "City", 100)}{text("phone", "Phone", 40, "tel")}{text("linkedin_url", "LinkedIn URL", 300, "url")}
          <label className="flex flex-col gap-1"><span className={labelCls}>Years of experience</span><input type="number" min={0} max={70} className={inputCls} value={v.years_experience} onChange={(e) => set("years_experience", e.target.value)} /></label>
          <label className="flex flex-col gap-1"><span className={labelCls}>Availability (hours / month)</span><input type="number" min={0} max={200} className={inputCls} value={v.availability_hours} onChange={(e) => set("availability_hours", e.target.value)} /></label>
          <div className="sm:col-span-2">{text("languages", "Languages (comma separated)", 300)}</div>
          {chips("expertise", "Areas of expertise", EXPERTISE)}
          {chips("markets", "Markets", MARKETS)}
          {chips("program_interests", "Program interests", PROGRAM_INTERESTS)}
          <label className="flex flex-col gap-1 sm:col-span-2"><span className={labelCls}>Short bio</span><textarea className={`${inputCls} min-h-28`} maxLength={1000} value={v.bio} onChange={(e) => set("bio", e.target.value)} /></label>
           {save.isError && <p role="alert" className="text-sm text-destructive sm:col-span-2">{(save.error as Error).message}</p>}
          <div className="flex items-center justify-end gap-3 sm:col-span-2">
             {saved && <span role="status" className="text-xs text-cyan">Saved.</span>}
            <button disabled={save.isPending} className={btnGold}>{save.isPending ? "Saving…" : "Save profile"}</button>
          </div>
        </form>
        <p className="mt-4 text-xs text-muted-foreground">Membership status, member type and company role are managed by BRQ+ administrators.</p>
      </Panel>
    </div>
  );
}

function Visibility({ profile }: { profile: any }) {
  const qc = useQueryClient();
  const fn = useServerFn(updateMyPreferences);
  const [v, setV] = useState({ show_in_directory: !!profile.show_in_directory, show_email: !!profile.show_email, show_phone: !!profile.show_phone, show_linkedin: !!profile.show_linkedin });
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => setErr(null), [v]);
  async function change(k: keyof typeof v, val: boolean) {
    const prev = v;
    setV({ ...v, [k]: val });
    try { await fn({ data: { [k]: val } }); qc.invalidateQueries({ queryKey: ["my-profile-full"] }); }
    catch (e) { setV(prev); setErr(e instanceof Error ? e.message : "Could not save"); }
  }
  return (
    <Panel title="Who can see what">
      <div className="divide-y divide-border">
        <Toggle label="Show me in the member Directory" hint="Active members can find your name, role, company and expertise." checked={v.show_in_directory} onChange={(x) => change("show_in_directory", x)} />
        <Toggle label="Show my email" checked={v.show_email} onChange={(x) => change("show_email", x)} disabled={!v.show_in_directory} />
        <Toggle label="Show my phone" checked={v.show_phone} onChange={(x) => change("show_phone", x)} disabled={!v.show_in_directory} />
        <Toggle label="Show my LinkedIn" checked={v.show_linkedin} onChange={(x) => change("show_linkedin", x)} disabled={!v.show_in_directory} />
      </div>
      {err && <p role="alert" className="mt-2 text-sm text-destructive">{err}</p>}
      <p className="mt-3 text-xs text-muted-foreground">Changes save automatically. See the <Link to="/privacy" target="_blank" className={linkGold}>Privacy Notice</Link>.</p>
    </Panel>
  );
}

function CollectiveTab({ status }: { status: string }) {
  const qc = useQueryClient();
  const fetchMine = useServerFn(getMyExecutive);
  const upsertMine = useServerFn(upsertMyExecutive);
  const q = useQuery({ queryKey: ["my-executive"], queryFn: () => fetchMine() });
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saveM = useMutation({
    mutationFn: (data: ExecFormValues) => upsertMine({ data }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-executive"] }); setSavedAt(Date.now()); setError(null); },
    onError: (e: any) => setError(e?.message ?? "Failed to save"),
  });
  return (
    <Panel title="The Collective @ BRQ+">
      <p className="mb-4 text-sm text-muted-foreground">Status: <span className="text-foreground">{status === "approved" ? "Member" : status === "applied" ? "Under consideration" : "—"}</span> (managed by BRQ+)</p>
      {q.isLoading ? <SkeletonRows /> : q.isError ? <ErrorNote error={q.error} /> : q.data?.executive ? (
        <>
          <ExecutiveForm key={q.data.executive.id} initial={q.data.executive} submitLabel="Save changes" submitting={saveM.isPending} externalError={error} onSubmit={(values) => { setError(null); saveM.mutate(values); }} />
           {savedAt && !saveM.isPending && <p role="status" className="mt-3 text-right text-xs text-cyan">Saved.</p>}
        </>
      ) : <p className="text-sm text-muted-foreground">Your Collective profile (domain, markets, mandate) becomes editable here once BRQ+ approves you.</p>}
    </Panel>
  );
}
