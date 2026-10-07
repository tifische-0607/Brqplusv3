import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { usePortalContext } from "./MembersLayout";
import { Empty, SkeletonRows, linkGold } from "./portal-ui";

/** Renders children only for users linked to a company; optionally Company Admin only. */
export function CompanyGate({ children, adminOnly = false }: { children: ReactNode; adminOnly?: boolean }) {
  const ctx = usePortalContext();
  if (ctx.isLoading) return <SkeletonRows rows={5} />;
  if (!ctx.data?.company) return <Empty cta={<Link to="/home" className={linkGold}>Go to Home →</Link>}>You are not linked to a company on BRQ+.</Empty>;
  if (adminOnly && ctx.data.company.role !== "admin") return <Empty cta={<Link to="/company" className={linkGold}>Company Home →</Link>}>Only your Company Admin can manage the team.</Empty>;
  return <>{children}</>;
}
