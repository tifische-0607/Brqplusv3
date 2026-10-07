import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMyEngagements } from "@/lib/portal.functions";
import { EngagementsList, ErrorNote, PageIntro, SkeletonRows } from "@/components/members/portal-ui";

export const Route = createFileRoute("/_authenticated/engagements")({
  head: () => ({ meta: [{ title: "My Engagements — BRQ+ Members" }] }),
  component: EngagementsPage,
});

function EngagementsPage() {
  const fn = useServerFn(getMyEngagements);
  const q = useQuery({ queryKey: ["my-engagements"], queryFn: () => fn() });
  return (
    <div>
      <PageIntro eyebrow="Engagements" title="My engagements">Missions and engagements you are part of, with your role, the lead, dates and NDA status.</PageIntro>
      {q.isLoading ? <SkeletonRows rows={4} /> : q.isError ? <ErrorNote error={q.error} /> : <EngagementsList items={q.data!.engagements} />}
    </div>
  );
}
