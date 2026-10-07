import { createFileRoute, Link } from "@tanstack/react-router";
import { getPublicCurrentAgreement } from "@/lib/agreements.functions";
import { AgreementMarkdown, DraftBanner } from "@/components/agreements/AgreementMarkdown";

export const Route = createFileRoute("/membership/agreement")({
  loader: () => getPublicCurrentAgreement(),
  head: () => ({
    meta: [
      { title: "Membership Agreement — BRQ+" },
      { name: "description", content: "Read the current BRQ+ Membership Agreement before applying for Personal or Corporate membership." },
      { property: "og:title", content: "Membership Agreement — BRQ+" },
      { property: "og:description", content: "The current BRQ+ Membership Agreement for Personal and Corporate members." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
  errorComponent: ({ error }) => <div className="mx-auto max-w-3xl px-6 py-24 text-destructive">{(error as Error).message}</div>,
  notFoundComponent: () => <div className="mx-auto max-w-3xl px-6 py-24 text-muted-foreground">Agreement not found.</div>,
});

function Page() {
  const { agreement } = Route.useLoaderData();
  return (
    <main className="mx-auto max-w-3xl px-6 py-20 sm:py-28">
      {agreement?.status === "draft" && <DraftBanner className="mb-6" />}
      <Link to="/membership" className="text-xs text-muted-foreground hover:text-gold">← Membership</Link>
      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-gold">Membership</p>
      <h1 className="mt-3 font-display text-4xl font-bold text-foreground">{agreement?.title ?? "BRQ+ Membership Agreement"}</h1>
      {agreement ? (
        <>
          <p className="mt-2 text-sm text-muted-foreground">Version {agreement.version} · Effective {agreement.effective_date}</p>
          <div className="mt-10 rounded-xl border border-border bg-card p-6 sm:p-8"><AgreementMarkdown body={agreement.body_markdown} /></div>
          <p className="mt-6 text-xs text-muted-foreground">Approved members sign this agreement electronically during onboarding.</p>
        </>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">The agreement is not yet published.</p>
      )}
    </main>
  );
}
