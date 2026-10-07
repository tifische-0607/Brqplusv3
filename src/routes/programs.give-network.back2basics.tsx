import { createFileRoute } from "@tanstack/react-router";
import { TgnWorkstreamPage } from "@/components/site/TgnWorkstreamPage";

export const Route = createFileRoute("/programs/give-network/back2basics")({
  head: () => ({ meta: [
    { title: "Back2Basics Accelerator for Founders — The Give Network | BRQ+" },
    { name: "description", content: "Workstream B: a 10-week Back2Basics founder accelerator with mentors, domain experts and corporate sponsors. Supported by BRQ+." },
    { property: "og:title", content: "Back2Basics Accelerator for Founders — The Give Network | BRQ+" },
    { property: "og:description", content: "Workstream B: a 10-week Back2Basics founder accelerator with mentors, domain experts and corporate sponsors. Supported by BRQ+." },
    { property: "og:type", content: "website" }, { property: "og:url", content: "https://v3.brqplus.ai/programs/give-network/back2basics" },
    { name: "twitter:card", content: "summary" },
  ], links: [{ rel: "canonical", href: "https://v3.brqplus.ai/programs/give-network/back2basics" }] }),
  component: () => <TgnWorkstreamPage index={1} />,
});