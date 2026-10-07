import type { ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMySigningContext, signMembershipAgreement } from "@/lib/agreements.functions";
import { SigningForm } from "./SigningForm";

function consentText(type: string, v: string, company: string) {
  if (type === "company_admin")
    return `I confirm I am authorised to act for ${company}, and on its behalf I agree to the BRQ+ Membership Agreement (version ${v}), including the Code of Conduct, confidentiality obligations and Corporate Member terms, and the BRQ+ Privacy Notice.`;
  if (type === "company_user")
    return `I agree to the BRQ+ Membership Agreement (version ${v}), including the Code of Conduct and confidentiality obligations, as a user of ${company}'s corporate membership.`;
  return `I have read and agree to the BRQ+ Membership Agreement (version ${v}), including the Code of Conduct and confidentiality obligations, and the BRQ+ Privacy Notice.`;
}

export function AgreementSigner({ onSigned, back }: { onSigned: () => void; back?: ReactNode }) {
  const ctxFn = useServerFn(getMySigningContext);
  const signFn = useServerFn(signMembershipAgreement);
  const q = useQuery({ queryKey: ["agreement-signing-context"], queryFn: () => ctxFn(), retry: false });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading agreement…</p>;
  if (q.isError) return <p role="alert" className="text-sm text-destructive">{(q.error as Error).message}</p>;
  const c = q.data!;
  if (!c.version)
    return <div className="rounded-md border border-destructive/40 bg-destructive/10 p-6 text-sm text-foreground">No current BRQ+ Membership Agreement is published. Please contact BRQ+.</div>;
  const v = c.version;

  return (
    <SigningForm
      heading={`${v.title} · Version ${v.version} · Effective ${v.effective_date}`}
      body={v.body_markdown}
      isDraft={v.status === "draft"}
      consent={consentText(c.signer_type, v.version, c.company_name ?? "your company")}
      needsTitle={c.signer_type !== "personal"}
      profileName={c.profile_name}
      defaultTitle={c.job_title}
      back={back}
      onSubmit={async (s) => {
        await signFn({ data: { version_id: v.id, ...s, agreed: true } });
        onSigned();
      }}
    />
  );
}
