import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listMyPendingNdas } from "@/lib/nda.functions";
import { getMyOnboardingStatus } from "@/lib/onboarding.functions";
import { linkGold } from "./portal-ui";

export function ActionCards() {
  const ndaFn = useServerFn(listMyPendingNdas);
  const stFn = useServerFn(getMyOnboardingStatus);
  const nda = useQuery({ queryKey: ["my-pending-ndas"], queryFn: () => ndaFn() });
  const st = useQuery({ queryKey: ["onboarding-status"], queryFn: () => stFn() });
  const items = nda.data?.items ?? [];
  const resign = st.data?.status?.needs_resign;
  if (!items.length && !resign) return null;
  return (
    <div className="rounded-2xl border border-gold/40 bg-gold/5 p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gold">Documents to sign</p>
      <ul className="mt-3 space-y-2 text-sm">
        {resign && (
          <li className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-foreground">Updated BRQ+ Membership Agreement</span>
            <Link to="/agreement/resign" className={linkGold}>Review & re-sign →</Link>
          </li>
        )}
        {items.map((i) => (
          <li key={i.party_id} className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-foreground">Engagement NDA · {i.mission_title}{i.as_facilitator ? " (for BRQ+ as facilitator)" : ""}</span>
            <Link to="/nda/$partyId" params={{ partyId: i.party_id }} className={linkGold}>Review & sign →</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

