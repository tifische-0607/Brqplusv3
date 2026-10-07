import { createFileRoute } from "@tanstack/react-router";
import { FilterChips, useUrlFilters } from "@/components/admin/UrlFilters";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { listTgnSubmissions } from "@/lib/tgn.functions";
import { listFounderApplications, NEEDS, SECTORS, STAGES } from "@/lib/founders.functions";
import { Button } from "@/components/ui/button";
import { AdminErrorBoundary } from "@/components/admin-error-boundary";
import { AccessDenied } from "@/components/access-denied";
import { isForbiddenError } from "@/lib/authz-error";
import { workstreamLabels } from "@/lib/tgn-workstreams";

export const Route = createFileRoute("/_authenticated/admin/programs")({
  head: () => ({ meta: [
    { title: "Programs — BRQ+ Admin" },
    { name: "description", content: "Admin review of Give Network and Founders @ BRQ+ submissions." },
    { property: "og:title", content: "Programs — BRQ+ Admin" },
    { property: "og:description", content: "Admin review of Give Network and Founders @ BRQ+ submissions." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <AdminErrorBoundary><AdminPrograms /></AdminErrorBoundary>,
});

type Row = Record<string, unknown>;
function csvEscape(value: unknown) {
  const text = Array.isArray(value) ? value.join("; ") : String(value ?? "");
  // Prevent spreadsheet formula execution when opening exported user-supplied values.
  const safe = /^[\s]*[=+@\-]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
function exportCsv(rows: Row[], columns: readonly string[], filename: string) {
  const csv = [columns.join(","), ...rows.map(row => columns.map(col => csvEscape(row[col])).join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const INTEREST_COLS = ["reference", "created_at", "full_name", "email", "linkedin_url", "phone", "models", "expertise", "expertise_other", "hours_available", "geographies", "geography_other", "career_stage", "referral_source", "source", "consent", "updates_opt_in"] as const;
const RSVP_COLS = ["created_at", "full_name", "email", "organisation", "attending_as", "country", "dietary_notes", "consent"] as const;
const FOUNDER_COLS = ["reference", "created_at", "full_name", "email", "linkedin_url", "company_name", "website", "country", "sector", "stage", "needs", "challenge", "consent"] as const;
const filterClass = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground sm:w-auto";
function AdminPrograms() {
  const fetchData = useServerFn(listTgnSubmissions);
  const fetchFounders = useServerFn(listFounderApplications);
  const q = useQuery({ queryKey: ["tgn-program-submissions"], queryFn: () => fetchData(), retry: false });
  const foundersQuery = useQuery({ queryKey: ["founder-applications"], queryFn: () => fetchFounders(), retry: false });
  const [tab, setTab] = useState<"interests" | "rsvps" | "founders">("interests");
  const [model, setModel] = useState(""); const [expertise, setExpertise] = useState("");
  const [geography, setGeography] = useState(""); const [source, setSource] = useState("");
  const [fromInput, setFrom] = useState(""); const [to, setTo] = useState("");
  const [sector, setSector] = useState(""); const [stage, setStage] = useState("");
  const [need, setNeed] = useState(""); const [country, setCountry] = useState("");
  const uf = useUrlFilters();
  const range = uf.get("range");
  const rangeDays = /^\d+d$/.test(range) ? parseInt(range, 10) : 0;
  const from = rangeDays ? new Date(Date.now() - rangeDays * 86400_000).toISOString().slice(0, 10) : fromInput;
  const interests = q.data?.interests ?? []; const rsvps = q.data?.rsvps ?? [];
  const founders = foundersQuery.data ?? [];
  const filtered = useMemo(() => {
    const withinDates = (dateValue: string) => {
      const date = dateValue.slice(0, 10);
      return !(from && date < from || to && date > to);
    };
    if (tab === "rsvps") return rsvps.filter(row => withinDates(row.created_at));
    if (tab === "founders") return founders.filter(row => withinDates(row.created_at) &&
      (!sector || row.sector === sector) && (!stage || row.stage === stage) &&
      (!need || row.needs.includes(need)) && (!country || row.country.toLowerCase().includes(country.trim().toLowerCase())));
    return interests.filter(row => {
      const date = String(row.created_at ?? "").slice(0, 10);
      if (from && date < from || to && date > to) return false;
      return (!model || row.models.includes(model)) && (!expertise || row.expertise.includes(expertise)) &&
        (!geography || row.geographies.includes(geography)) && (!source || row.source === source);
    });
  }, [tab, interests, rsvps, founders, model, expertise, geography, source, from, to, sector, stage, need, country]);
  const models = ["A", "B", "C", "D"];
  if (q.isLoading || foundersQuery.isLoading) return <p className="py-16 text-muted-foreground">Loading programs…</p>;
  if (q.error && isForbiddenError(q.error)) return <AccessDenied />;
  if (foundersQuery.error && isForbiddenError(foundersQuery.error)) return <AccessDenied />;
  if (q.error) return <p role="alert" className="py-16 text-destructive">Could not load Programs: {q.error.message}</p>;
  if (foundersQuery.error) return <p role="alert" className="py-16 text-destructive">Could not load founder applications: {foundersQuery.error.message}</p>;
  return <div className="space-y-8">
    <header><p className="font-mono text-xs uppercase tracking-widest text-gold">Admin / Programs</p><h1 className="font-display mt-2 text-3xl font-bold">Programs</h1><p className="mt-2 text-sm text-muted-foreground">Give Network interests and RSVPs · Founders @ BRQ+ applications.</p></header>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
      <div className="rounded-md border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Total interests</p><strong className="font-display mt-2 block text-2xl text-gold">{interests.length}</strong></div>
       {models.map(m => <div key={m} className="rounded-md border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{workstreamLabels[m]}</p><strong className="font-display mt-2 block text-2xl">{interests.filter(row => row.models.includes(m)).length}</strong></div>)}
      <div className="rounded-md border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Total RSVPs</p><strong className="font-display mt-2 block text-2xl text-gold">{rsvps.length}</strong></div>
      <div className="rounded-md border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Founder applications</p><strong className="font-display mt-2 block text-2xl text-gold">{founders.length}</strong></div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4"><div className="flex flex-wrap gap-2">{(["interests", "rsvps", "founders"] as const).map(t => <Button key={t} variant={tab === t ? "default" : "outline"} onClick={() => setTab(t)}>{t === "interests" ? "Interests" : t === "rsvps" ? "RSVPs" : "Founders"}</Button>)}</div><Button variant="outline" onClick={() => exportCsv(filtered as Row[], tab === "interests" ? INTEREST_COLS : tab === "rsvps" ? RSVP_COLS : FOUNDER_COLS, `${tab === "founders" ? "founders" : "tgn"}-${tab}.csv`)}><Download size={16} /> Export CSV ({filtered.length})</Button></div>
    <FilterChips chips={rangeDays ? [{ key: "range", label: `Last ${rangeDays} days` }] : []} onRemove={(k) => uf.set({ [k]: undefined })} />
    <div className="flex flex-wrap gap-3">
       {tab === "interests" && <><select aria-label="Filter by workstream" className={filterClass} value={model} onChange={e => setModel(e.target.value)}><option value="">All workstreams</option>{models.map(m => <option key={m} value={m}>{workstreamLabels[m]}</option>)}</select><select aria-label="Filter by expertise" className={filterClass} value={expertise} onChange={e => setExpertise(e.target.value)}><option value="">All expertise</option>{["Finance/Fundraising", "Operations/Scaling", "Tech/Product", "Education", "Social Enterprise", "Other"].map(x => <option key={x}>{x}</option>)}</select><select aria-label="Filter by geography" className={filterClass} value={geography} onChange={e => setGeography(e.target.value)}><option value="">All geographies</option>{["Malaysia", "Indonesia", "Cambodia", "Flexible", "Other"].map(x => <option key={x}>{x}</option>)}</select><select aria-label="Filter by source" className={filterClass} value={source} onChange={e => setSource(e.target.value)}><option value="">All sources</option>{["booth", "breakout", "qr"].map(x => <option key={x}>{x}</option>)}</select></>}
      {tab === "founders" && <><select aria-label="Filter by sector" className={filterClass} value={sector} onChange={e => setSector(e.target.value)}><option value="">All sectors</option>{SECTORS.map(x => <option key={x}>{x}</option>)}</select><select aria-label="Filter by stage" className={filterClass} value={stage} onChange={e => setStage(e.target.value)}><option value="">All stages</option>{STAGES.map(x => <option key={x}>{x}</option>)}</select><select aria-label="Filter by need" className={filterClass} value={need} onChange={e => setNeed(e.target.value)}><option value="">All needs</option>{NEEDS.map(x => <option key={x}>{x}</option>)}</select><input aria-label="Filter by country" placeholder="Country" className={filterClass} maxLength={100} value={country} onChange={e => setCountry(e.target.value)} /></>}
      <label className="text-xs text-muted-foreground">From<input aria-label="From date" type="date" className={`${filterClass} block`} value={from} onChange={e => setFrom(e.target.value)} /></label><label className="text-xs text-muted-foreground">To<input aria-label="To date" type="date" className={`${filterClass} block`} value={to} onChange={e => setTo(e.target.value)} /></label>
    </div>
     <div className="overflow-x-auto rounded-md border border-border"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-card text-xs uppercase text-muted-foreground"><tr>{(tab === "interests" ? ["Date", "Reference", "Name", "Email", "Workstreams", "Expertise", "Geography", "Hours", "Source"] : tab === "rsvps" ? ["Date", "Name", "Email", "Organisation", "Attending as", "Country", "Dietary notes"] : ["Date", "Reference", "Name", "Email", "Company", "Country", "Sector", "Stage", "Needs", "Challenge"]).map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead><tbody className="divide-y divide-border">{filtered.map(row => <tr key={row.id} className="hover:bg-card/60"><td className="whitespace-nowrap px-4 py-4 text-muted-foreground">{String(row.created_at).slice(0, 10)}</td>{tab === "founders" && "company_name" in row ? <><td className="px-4 py-4 text-gold">{row.reference}</td><td className="px-4 py-4">{row.full_name}</td><td className="px-4 py-4">{row.email}</td><td className="px-4 py-4">{row.company_name}</td><td className="px-4 py-4">{row.country}</td><td className="px-4 py-4">{row.sector}</td><td className="px-4 py-4">{row.stage}</td><td className="px-4 py-4">{row.needs.join(", ")}</td><td className="min-w-60 px-4 py-4 whitespace-pre-wrap">{row.challenge}</td></> : tab === "interests" && "models" in row ? <><td className="px-4 py-4 text-gold">{row.reference}</td><td className="px-4 py-4">{row.full_name}</td><td className="px-4 py-4">{row.email}</td><td className="px-4 py-4">{row.models.map(m => workstreamLabels[m] ?? m).join(", ")}</td><td className="px-4 py-4">{row.expertise.join(", ")}{row.expertise_other ? ` · ${row.expertise_other}` : ""}</td><td className="px-4 py-4">{row.geographies.join(", ")}{row.geography_other ? ` · ${row.geography_other}` : ""}</td><td className="px-4 py-4">{row.hours_available}</td><td className="px-4 py-4">{row.source ?? "—"}</td></> : "attending_as" in row ? <><td className="px-4 py-4">{row.full_name}</td><td className="px-4 py-4">{row.email}</td><td className="px-4 py-4">{row.organisation ?? "—"}</td><td className="px-4 py-4">{row.attending_as}</td><td className="px-4 py-4">{row.country ?? "—"}</td><td className="px-4 py-4">{row.dietary_notes ?? "—"}</td></> : null}</tr>)}</tbody></table>{filtered.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted-foreground">No submissions match these filters.</p>}</div>
  </div>;
}
