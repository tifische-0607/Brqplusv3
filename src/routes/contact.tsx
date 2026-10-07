import { createFileRoute } from "@tanstack/react-router";
import { ContactForm } from "../components/site/ContactForm";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Consult the BRQ+ Collective" },
      {
        name: "description",
        content:
          "Brief BRQ+ on your mission. Confidential, senior-only engagements across fintech advisory and execution.",
      },
      { property: "og:title", content: "Consult the BRQ+ Collective" },
      { property: "og:description", content: "Confidential briefings within 72 hours." },
      { property: "og:url", content: "/contact" },
    ],
    links: [{ rel: "canonical", href: "/contact" }],
  }),
  component: ContactPage,
});

function ContactPage() {
  return <ContactForm />;
}
