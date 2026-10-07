import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getCompanyEngagements } from "@/lib/portal.functions";
import { CompanyGate } from "@/components/members/CompanyGate";
import { EngagementsList, ErrorNote, PageIntro, SkeletonRows } from "@/components/members/portal-ui";

export const Route = createFileRoute("/_authenticated/company/engagements")({
  head: () => ({ meta: [{ title: "Company Engagements — BRQ+ Members" }] }),
  component: () => <CompanyGate><CompanyEngagements /></CompanyGate>,
});

function CompanyEngagements() {
  const fn = useServerFn(getCompanyEngagements);
  const q = useQuery({ queryKey: ["company-engagements"], queryFn: () => fn() });
  return (
    <div>
      <PageIntro eyebrow="Engagements" title="Company engagements">Missions where your company is the customer, with status and NDA status.</PageIntro>
      {q.isLoading ? <SkeletonRows rows={4} /> : q.isError ? <ErrorNote error={q.error} /> : <EngagementsList items={q.data!.engagements} />}
    </div>
  );
}
