import { createFileRoute, Link } from "@tanstack/react-router";
import { getPublicTermsOfService } from "@/lib/agreements.functions";
import { AgreementMarkdown, DraftBanner } from "@/components/agreements/AgreementMarkdown";

export const Route = createFileRoute("/terms")({
  loader: () => getPublicTermsOfService(),
  head: () => ({
    meta: [
      { title: "Terms of Service — BRQ+" },
      { name: "description", content: "Read the terms governing access to and use of the BRQ+ website, member portal and related services." },
      { property: "og:title", content: "Terms of Service — BRQ+" },
      { property: "og:description", content: "Terms governing access to and use of the BRQ+ website, member portal and related services." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://brqplus.ai/terms" }],
  }),
  component: TermsPage,
  errorComponent: ({ error }) => <div className="mx-auto max-w-3xl px-6 py-24 text-destructive">{(error as Error).message}</div>,
  notFoundComponent: () => <div className="mx-auto max-w-3xl px-6 py-24 text-muted-foreground">Terms of Service not found.</div>,
});

function TermsPage() {
  const { agreement: terms } = Route.useLoaderData();
  return (
    <main className="mx-auto max-w-3xl px-6 py-20 sm:py-28 print:max-w-none print:p-0 print:text-black">
      {terms?.status === "draft" && <DraftBanner className="mb-6 print:border-black print:text-black" />}
      <Link to="/" className="text-xs text-muted-foreground hover:text-gold print:hidden">← BRQ+ home</Link>
      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-gold print:text-black">Legal</p>
      <h1 className="mt-3 font-display text-4xl font-bold text-foreground print:text-black">{terms?.title ?? "BRQ+ Terms of Service"}</h1>
      {terms ? (
        <>
          <p className="mt-2 text-sm text-muted-foreground print:text-black">Version {terms.version} · Last updated {terms.effective_date}</p>
          <div className="mt-10 rounded-xl border border-border bg-card p-6 sm:p-8 print:border-0 print:bg-transparent print:p-0 print:[&_*]:text-black">
            <AgreementMarkdown body={terms.body_markdown} />
          </div>
          <button type="button" onClick={() => window.print()} className="mt-6 text-xs text-muted-foreground underline hover:text-gold print:hidden">Print these terms</button>
        </>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">The Terms of Service are not yet published.</p>
      )}
    </main>
  );
}