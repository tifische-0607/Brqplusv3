import { createFileRoute } from "@tanstack/react-router";
import { TgnWorkstreamPage } from "@/components/site/TgnWorkstreamPage";

export const Route = createFileRoute("/programs/give-network/immersion")({
  head: () => ({ meta: [
    { title: "Employment Immersion — The Give Network | BRQ+" },
    { name: "description", content: "Workstream D: 6–12 month employment immersion with an SG-registered organisation expanding into Malaysia or Indonesia. Supported by BRQ+." },
    { property: "og:title", content: "Employment Immersion — The Give Network | BRQ+" },
    { property: "og:description", content: "Workstream D: 6–12 month employment immersion with an SG-registered organisation expanding into Malaysia or Indonesia. Supported by BRQ+." },
    { property: "og:type", content: "website" }, { property: "og:url", content: "https://v3.brqplus.ai/programs/give-network/immersion" },
    { name: "twitter:card", content: "summary" },
  ], links: [{ rel: "canonical", href: "https://v3.brqplus.ai/programs/give-network/immersion" }] }),
  component: () => <TgnWorkstreamPage index={3} />,
});