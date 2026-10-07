import { createFileRoute } from "@tanstack/react-router";
import { TgnWorkstreamPage } from "@/components/site/TgnWorkstreamPage";

export const Route = createFileRoute("/programs/give-network/missions")({
  head: () => ({ meta: [
    { title: "Trade/Impact Missions & Exploration — The Give Network | BRQ+" },
    { name: "description", content: "Workstream C: 3–5 day regional trade and impact missions to explore ventures and partnerships. Supported by BRQ+." },
    { property: "og:title", content: "Trade/Impact Missions & Exploration — The Give Network | BRQ+" },
    { property: "og:description", content: "Workstream C: 3–5 day regional trade and impact missions to explore ventures and partnerships. Supported by BRQ+." },
    { property: "og:type", content: "website" }, { property: "og:url", content: "https://v3.brqplus.ai/programs/give-network/missions" },
    { name: "twitter:card", content: "summary" },
  ], links: [{ rel: "canonical", href: "https://v3.brqplus.ai/programs/give-network/missions" }] }),
  component: () => <TgnWorkstreamPage index={2} />,
});