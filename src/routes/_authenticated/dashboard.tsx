import { createFileRoute, redirect } from "@tanstack/react-router";
import { getPortalContext } from "@/lib/portal.functions";

// Legacy landing URL: send personal members to /home and corporate users to /company.
export const Route = createFileRoute("/_authenticated/dashboard")({
  beforeLoad: async () => {
    let corporate = false;
    try {
      corporate = !!(await getPortalContext()).company;
    } catch {
      /* default to personal home */
    }
    throw redirect({ to: corporate ? "/company" : "/home", replace: true });
  },
  component: () => null,
});
