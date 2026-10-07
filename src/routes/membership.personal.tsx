import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { MembershipQr } from "@/components/site/MembershipQr";
import { SectionTitle } from "@/components/site/SectionTitle";
import { normalizeSource } from "@/lib/membership-options";
import { PersonalMembershipForm } from "@/components/site/MembershipForms";

const URL = "https://brqplus.ai/membership/personal";
export const Route = createFileRoute("/membership/personal")({
  validateSearch: (s: Record<string, unknown>) => z.object({ src: z.string().optional().catch(undefined), plan: z.string().max(40).optional().catch(undefined), cycle: z.enum(["monthly", "annual"]).optional().catch(undefined), collective: z.coerce.number().optional().catch(undefined) }).parse(s),
  head: () => ({
    meta: [
      { title: "Personal membership application — BRQ+" },
      { name: "description", content: "Apply for personal membership of BRQ+, with the option to be considered for The Collective." },
      { property: "og:title", content: "Personal membership — BRQ+" },
      { property: "og:description", content: "Apply for personal membership of BRQ+." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: Page,
});

function Page() {
  const { collective, src, plan, cycle } = Route.useSearch();
  return <main className="bg-navy px-5 pb-24 pt-32 lg:px-8">
    <div className="mx-auto max-w-3xl">
      <nav className="mb-8 text-xs text-muted-foreground"><Link to="/membership" className="hover:text-gold">Membership</Link> / Personal</nav>
      <div className="flex items-start justify-between gap-8">
        <div className="flex-1">
        <SectionTitle eyebrow="Personal membership" title="Apply to BRQ+" description="One application for everyone. Tick the Collective option if you would like to be considered as a fractional senior executive." />
        </div>
        <MembershipQr kind="personal" size={96} caption="Continue on your phone" className="hidden md:flex" />
      </div>
      <div className="mt-10"><PersonalMembershipForm collectiveDefault={collective === 1} source={normalizeSource(src)} planDefault={plan ?? ""} cycleDefault={cycle ?? "monthly"} /></div>
    </div>
  </main>;
}
