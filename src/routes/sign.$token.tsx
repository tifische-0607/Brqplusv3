import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getNdaByToken, signNdaByToken } from "@/lib/nda.functions";
import { SigningForm } from "@/components/agreements/SigningForm";

export const Route = createFileRoute("/sign/$token")({
  head: () => ({
    meta: [
      { title: "Sign Engagement NDA — BRQ+" },
      { name: "description", content: "Review and electronically sign a BRQ+ Engagement Non-Disclosure Agreement." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Sign Engagement NDA — BRQ+" },
      { property: "og:description", content: "Secure electronic signing of a BRQ+ Engagement NDA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { token } = Route.useParams();
  const valid = /^[0-9a-f-]{36}$/i.test(token);
  const fn = useServerFn(getNdaByToken);
  const sign = useServerFn(signNdaByToken);
  const q = useQuery({ queryKey: ["nda-token", token], queryFn: () => fn({ data: { token } }), enabled: valid, retry: false });
  const [done, setDone] = useState(false);

  return (
    <main className="mx-auto max-w-3xl px-6 py-20 sm:py-28">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">BRQ+ · Secure signing</p>
      <h1 className="mt-3 font-display text-3xl font-bold text-foreground sm:text-4xl">Engagement Non-Disclosure Agreement</h1>
      {!valid ? (
        <p className="mt-6 text-sm text-destructive">This signing link is not valid.</p>
      ) : q.isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
      ) : q.isError ? (
        <p className="mt-6 text-sm text-destructive">{(q.error as Error).message}</p>
      ) : done ? (
        <div className="mt-8 rounded-xl border border-gold/40 bg-gold/10 p-6 text-sm text-foreground">
          Thank you — your signature has been recorded. BRQ+ keeps the signed copy, and you will receive the fully executed NDA once every party has signed.
        </div>
      ) : !q.data!.ok ? (
        <p className="mt-6 rounded-md border border-border bg-card p-6 text-sm text-foreground">{q.data!.error}</p>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted-foreground">For {q.data!.mission_title}. Signing as {q.data!.signer_name}.</p>
          <div className="mt-8 rounded-xl border border-border bg-card p-6">
            <SigningForm
              heading={q.data!.heading}
              body={q.data!.body}
              isDraft={q.data!.is_draft}
              consent={q.data!.consent}
              needsTitle
              profileName={q.data!.signer_name}
              submitLabel="Sign NDA"
              onSubmit={async (s) => {
                await sign({ data: { token, ...s, agreed: true } });
                setDone(true);
              }}
            />
          </div>
        </>
      )}
    </main>
  );
}
