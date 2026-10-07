import { createFileRoute } from "@tanstack/react-router";
import { Hero } from "../components/site/Hero";
import { ExecutiveShowcase } from "../components/site/ExecutiveShowcase";
import { Pillars } from "../components/site/Pillars";
import { UmmahBanner } from "../components/site/UmmahBanner";

import { HowItWorks } from "../components/site/HowItWorks";
import { TestimonialBar } from "../components/site/TestimonialBar";
import { ContactForm } from "../components/site/ContactForm";
import { ProgramsStrip } from "../components/site/ProgramsStrip";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BRQ+ — High Impact Fintech Advisory & Execution Collective" },
      {
        name: "description",
        content:
          "BRQ+ combines more than 35 years of fintech practitioner experience with an invitation-only collective focused on Islamic finance, AI payments, and digital inclusion.",
      },
      { property: "og:title", content: "BRQ+ — High Impact Fintech Advisory" },
      {
        property: "og:description",
        content:
          "Specialist advisory and execution vanguard for ethical fintech across Asia and the Middle East.",
      },
      { property: "og:url", content: "https://v3.brqplus.ai/" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://v3.brqplus.ai/" }],
  }),
  component: Index,
});

function Index() {
  return (
    <>
      <Hero />
      <ExecutiveShowcase />
      <Pillars />
      <UmmahBanner />
      <ProgramsStrip />
      
      <HowItWorks />
      <TestimonialBar />
      <ContactForm />
    </>
  );
}
