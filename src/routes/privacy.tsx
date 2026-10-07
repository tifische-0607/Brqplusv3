import { createFileRoute } from "@tanstack/react-router";
import { getPublicPrivacyNotice } from "@/lib/agreements.functions";
import { AgreementMarkdown, DraftBanner } from "@/components/agreements/AgreementMarkdown";

export const Route = createFileRoute("/privacy")({
  loader: () => getPublicPrivacyNotice(),
  head: () => ({
    meta: [
      { title: "Privacy Policy — BRQ+" },
      { name: "description", content: "How BRQ+ collects, uses, shares and protects personal data under Malaysia's PDPA." },
      { property: "og:title", content: "Privacy Policy — BRQ+" },
      { property: "og:description", content: "How BRQ+ collects, uses, shares and protects personal data." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://brqplus.ai/privacy" }],
  }),
  component: Page,
  errorComponent: ({ error }) => <div className="mx-auto max-w-3xl px-6 py-24 text-destructive">{(error as Error).message}</div>,
  notFoundComponent: () => <div className="mx-auto max-w-3xl px-6 py-24 text-muted-foreground">Privacy Policy not found.</div>,
});

function Page() {
  const { agreement: notice } = Route.useLoaderData();
  return (
    <main className="mx-auto max-w-3xl px-6 py-20 sm:py-28 print:max-w-none print:p-0 print:text-black">
      {notice?.status === "draft" && <DraftBanner className="mb-6 print:border-black print:text-black" />}
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold print:text-black">Legal</p>
      <h1 className="mt-3 font-display text-4xl font-bold text-foreground print:text-black">BRQ+ Privacy Policy</h1>
      {notice ? (
        <>
          <p className="mt-2 text-sm text-muted-foreground print:text-black">Version {notice.version} · Last updated {notice.effective_date}</p>
          <div className="mt-10 rounded-xl border border-border bg-card p-6 sm:p-8 print:border-0 print:bg-transparent print:p-0 print:[&_*]:text-black">
            <AgreementMarkdown body={notice.body_markdown} />
          </div>
          <button onClick={() => window.print()} className="mt-6 text-xs text-muted-foreground underline hover:text-gold print:hidden">Print this notice</button>
        </>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">The Privacy Policy is not yet published.</p>
      )}
    </main>
  );
}
