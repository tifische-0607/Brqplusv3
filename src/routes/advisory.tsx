import { createFileRoute } from "@tanstack/react-router";
import { AdvisoryHero } from "../components/site/AdvisoryHero";
import { Pillars } from "../components/site/Pillars";
import { ContactForm } from "../components/site/ContactForm";
import { SectionReveal } from "../components/site/SectionReveal";

export const Route = createFileRoute("/advisory")({
  head: () => ({
    meta: [
      { title: "BRQ+ Advisory — Specialist Fintech Advisory in Malaysia" },
      {
        name: "description",
        content:
          "Strategic consulting for transformation, AI-infused fintech innovation, and regulated market entry across Asia and the Middle East.",
      },
      { property: "og:title", content: "BRQ+ Advisory" },
      {
        property: "og:description",
        content: "Specialist fintech advisory grounded in more than 3 decades of practitioner experience.",
      },
      { property: "og:url", content: "/advisory" },
    ],
    links: [{ rel: "canonical", href: "/advisory" }],
  }),
  component: AdvisoryPage,
});

function AdvisoryPage() {
  return (
    <>
      <AdvisoryHero />
      <SectionReveal>
        <Pillars />
      </SectionReveal>
      <SectionReveal delay={0.1}>
        <ContactForm />
      </SectionReveal>
    </>
  );
}

