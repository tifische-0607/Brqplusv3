import { createFileRoute } from "@tanstack/react-router";
import { TgnWorkstreamPage } from "@/components/site/TgnWorkstreamPage";

export const Route = createFileRoute("/programs/give-network/remote-advisory")({
  head: () => ({ meta: [
    { title: "Remote Advisory & Project Contribution — The Give Network | BRQ+" },
    { name: "description", content: "Workstream A: remote advisory for ventures over 3–6 months, 10–20 hours a month. Explore The Give Network, supported by BRQ+." },
    { property: "og:title", content: "Remote Advisory & Project Contribution — The Give Network | BRQ+" },
    { property: "og:description", content: "Workstream A: remote advisory for ventures over 3–6 months, 10–20 hours a month. Explore The Give Network, supported by BRQ+." },
    { property: "og:type", content: "website" }, { property: "og:url", content: "https://v3.brqplus.ai/programs/give-network/remote-advisory" },
    { name: "twitter:card", content: "summary" },
  ], links: [{ rel: "canonical", href: "https://v3.brqplus.ai/programs/give-network/remote-advisory" }] }),
  component: () => <TgnWorkstreamPage index={0} />,
});