import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { normalizeSource } from "@/lib/membership-options";
import { MembershipQr } from "@/components/site/MembershipQr";
import { SectionTitle } from "@/components/site/SectionTitle";
import { CorporateMembershipForm } from "@/components/site/MembershipForms";

const URL = "https://brqplus.ai/membership/corporate";
export const Route = createFileRoute("/membership/corporate")({
  validateSearch: (s: Record<string, unknown>) => z.object({ src: z.string().optional().catch(undefined), plan: z.string().max(40).optional().catch(undefined), cycle: z.enum(["monthly", "annual"]).optional().catch(undefined) }).parse(s),
  head: () => ({
    meta: [
      { title: "Corporate membership application — BRQ+" },
      { name: "description", content: "Apply for corporate membership of BRQ+ on behalf of your company." },
      { property: "og:title", content: "Corporate membership — BRQ+" },
      { property: "og:description", content: "Apply for corporate membership of BRQ+." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: Page,
});

function Page() {
  const { src, plan, cycle } = Route.useSearch();
  return <main className="bg-navy px-5 pb-24 pt-32 lg:px-8">
    <div className="mx-auto max-w-3xl">
      <nav className="mb-8 text-xs text-muted-foreground"><Link to="/membership" className="hover:text-gold">Membership</Link> / Corporate</nav>
      <div className="flex items-start justify-between gap-8">
        <div className="flex-1">
        <SectionTitle eyebrow="Corporate membership" title="Apply on behalf of your company" description="The primary contact becomes the Company Admin and can invite colleagues once approved." />
        </div>
        <MembershipQr kind="corporate" size={96} caption="Continue on your phone" className="hidden md:flex" />
      </div>
      <div className="mt-10"><CorporateMembershipForm source={normalizeSource(src)} planDefault={plan ?? ""} cycleDefault={cycle ?? "monthly"} /></div>
    </div>
  </main>;
}
