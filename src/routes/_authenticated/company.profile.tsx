import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyCompany } from "@/lib/member-portal.functions";
import { CompanyGate } from "@/components/members/CompanyGate";
import { CompanyEditor } from "@/components/members/CompanyEditor";
import { ErrorNote, PageIntro, Panel, SkeletonRows, labelCls } from "@/components/members/portal-ui";

export const Route = createFileRoute("/_authenticated/company/profile")({
  head: () => ({ meta: [{ title: "Company Profile — BRQ+ Members" }] }),
  component: () => <CompanyGate><CompanyProfile /></CompanyGate>,
});

function CompanyProfile() {
  const qc = useQueryClient();
  const fn = useServerFn(getMyCompany);
  const q = useQuery({ queryKey: ["my-company"], queryFn: () => fn() });
  if (q.isLoading) return <SkeletonRows rows={6} />;
  if (q.isError) return <ErrorNote error={q.error} />;
  const { company, my_role, logo_url } = q.data!;
  if (!company) return null;
  const isAdmin = my_role === "admin";
  const refresh = () => { qc.invalidateQueries({ queryKey: ["my-company"] }); qc.invalidateQueries({ queryKey: ["company-home"] }); };
  const rows: [string, any][] = [
    ["Legal name", company.legal_name], ["Trading name", company.trading_name], ["Registration no.", company.registration_no], ["Country", company.country],
    ["HQ city", company.hq_city], ["Website", company.website], ["Sector", company.sector], ["Size", company.size_band], ["Year founded", company.year_founded],
    ["Markets", company.markets?.join(", ")], ["Interests with BRQ+", company.interests?.join(", ")], ["Billing contact", [company.billing_contact_name, company.billing_contact_email].filter(Boolean).join(" · ")],
  ];
  return (
    <div className="space-y-6">
      <PageIntro eyebrow="Company Profile" title={company.trading_name || company.legal_name}>
        {isAdmin ? "You are the Company Admin and can edit these details." : "Read-only. Ask your Company Admin to make changes."}
      </PageIntro>
      <Panel title="Dossier">
        <div className="flex items-start gap-4">
          {logo_url && <img src={logo_url} alt={`${company.legal_name} logo`} className="h-16 w-16 rounded-md border border-border object-contain" />}
          <dl className="grid flex-1 gap-4 text-sm sm:grid-cols-2">
            {rows.map(([k, v]) => <div key={k}><dt className={labelCls}>{k}</dt><dd className="mt-0.5 text-foreground">{v || "—"}</dd></div>)}
            <div className="sm:col-span-2"><dt className={labelCls}>Description</dt><dd className="mt-0.5 whitespace-pre-wrap text-foreground">{company.description || "—"}</dd></div>
          </dl>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Legal name, registration number and membership status are fixed after approval. Contact BRQ+ to change them.</p>
      </Panel>
      {isAdmin && <Panel title="Edit company details"><CompanyEditor company={company} onSaved={refresh} /></Panel>}
    </div>
  );
}
