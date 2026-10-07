import { createFileRoute } from "@tanstack/react-router";
import { DocumentsList } from "@/components/agreements/DocumentsList";
import { CompanyGate } from "@/components/members/CompanyGate";
import { usePortalContext } from "@/components/members/MembersLayout";
import { ActionCards } from "@/components/members/ActionCards";
import { PageIntro, Panel } from "@/components/members/portal-ui";
import { LegalDocumentLinks } from "@/components/members/LegalDocumentLinks";

export const Route = createFileRoute("/_authenticated/company/documents")({
  head: () => ({ meta: [
    { title: "Company Documents — BRQ+ Members" },
    { name: "description", content: "View company documents, member agreements and current BRQ+ legal documents." },
    { property: "og:title", content: "Company Documents — BRQ+ Members" },
    { property: "og:description", content: "View company documents, member agreements and current BRQ+ legal documents." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <CompanyGate><CompanyDocuments /></CompanyGate>,
});

function CompanyDocuments() {
  const ctx = usePortalContext();
  const company = ctx.data!.company!;
  return (
    <div className="space-y-6">
      <PageIntro eyebrow="Documents" title="Company documents">Engagement NDAs signed for your company and each team member's BRQ+ Membership Agreement.</PageIntro>
      <ActionCards />
      <Panel title="Legal documents"><LegalDocumentLinks /></Panel>
      {company.role === "admin" ? (
        <Panel title="All company documents"><DocumentsList scope={{ companyId: company.id }} showSigner /></Panel>
      ) : (
        <p className="text-sm text-muted-foreground">Your Company Admin can see every company document. Your own signed documents are below.</p>
      )}
      <Panel title="My signed documents"><DocumentsList scope={{ mine: true }} /></Panel>
    </div>
  );
}
