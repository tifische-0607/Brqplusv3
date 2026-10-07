import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Building2, User } from "lucide-react";
import { MembershipQr } from "@/components/site/MembershipQr";
import { SectionTitle } from "@/components/site/SectionTitle";
import { useState } from "react";
import { PricingSection } from "@/components/site/PlanPicker";
import type { BillingCycle } from "@/lib/plans";
import { PlanAdvisor } from "@/components/site/PlanAdvisor";

const URL = "https://brqplus.ai/membership";
export const Route = createFileRoute("/membership/")({
  head: () => ({
    meta: [
      { title: "Membership — BRQ+" },
      { name: "description", content: "BRQ+ membership is invitation-only. Apply as an individual or on behalf of your company." },
      { property: "og:title", content: "Membership — BRQ+" },
      { property: "og:description", content: "Personal and Corporate membership of BRQ+. Every application is reviewed personally." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: MembershipPage,
});

const TYPES = [
  {
    icon: User, kind: "personal" as const, label: "Personal", title: "Personal membership", to: "/membership/personal" as const,
    points: ["Your own BRQ+ member profile", "Access to BRQ+ programs, community and events", "Optional: be considered for The Collective as a fractional senior executive"],
  },
  {
    icon: Building2, kind: "corporate" as const, label: "Corporate", title: "Corporate membership", to: "/membership/corporate" as const,
    points: ["A company profile inside BRQ+", "The applicant becomes the Company Admin", "Invite colleagues — each gets a personal profile linked to the company"],
  },
];

function MembershipPage() {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  return <main className="bg-navy px-5 pb-24 pt-32 lg:px-8">
    <div className="mx-auto max-w-7xl">
      <SectionTitle eyebrow="BRQ+ Membership" title="Two ways to join BRQ+" description="Membership is by invitation. Apply, and BRQ+ reviews every application personally. Approved applicants receive an email invitation to set up their account." />
      <div className="mt-14 grid gap-6 md:grid-cols-2">
        {TYPES.map(t => <article key={t.label} className="flex flex-col rounded-2xl border border-border bg-card p-8">
          <t.icon className="h-6 w-6 text-gold" aria-hidden />
          <p className="mt-6 font-mono text-xs uppercase tracking-wider text-gold">{t.label}</p>
          <h2 className="font-display mt-2 text-2xl font-bold">{t.title}</h2>
          <ul className="mt-6 grid gap-3 text-sm text-muted-foreground">{t.points.map(p => <li key={p} className="border-l border-gold/40 pl-3">{p}</li>)}</ul>
          <div className="mt-8 flex flex-wrap items-end justify-between gap-6">
            <Link to={t.to} className="inline-flex w-fit items-center gap-2 rounded-md border border-gold bg-gold/10 px-4 py-2 text-sm font-semibold text-gold hover:bg-gold/20">Apply <ArrowRight className="h-4 w-4" /></Link>
            <MembershipQr kind={t.kind} size={140} caption="Scan to apply on your phone" />
          </div>
        </article>)}
      </div>
      <PricingSection cycle={cycle} onCycle={setCycle} />
      <PlanAdvisor />
    </div>
  </main>;
}
