import { createFileRoute } from "@tanstack/react-router";
import { DocumentsList } from "@/components/agreements/DocumentsList";
import { PageIntro, Panel } from "@/components/members/portal-ui";
import { ActionCards } from "@/components/members/ActionCards";
import { LegalDocumentLinks } from "@/components/members/LegalDocumentLinks";

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({ meta: [
    { title: "Documents — BRQ+ Members" },
    { name: "description", content: "View signed documents and current BRQ+ legal documents." },
    { property: "og:title", content: "Documents — BRQ+ Members" },
    { property: "og:description", content: "View signed documents and current BRQ+ legal documents." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: DocumentsPage,
});

function DocumentsPage() {
  return (
    <div className="space-y-6">
      <PageIntro eyebrow="Documents" title="My documents">Your signed BRQ+ Membership Agreement and Engagement NDAs, plus anything waiting for your signature.</PageIntro>
      <ActionCards />
      <Panel title="Legal documents"><LegalDocumentLinks /></Panel>
      <Panel title="Signed documents"><DocumentsList scope={{ mine: true }} /></Panel>
    </div>
  );
}
