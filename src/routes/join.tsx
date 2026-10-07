import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy URL: The Collective is now part of Personal membership.
export const Route = createFileRoute("/join")({
  beforeLoad: () => {
    throw redirect({ to: "/membership/personal", search: { collective: 1 }, statusCode: 301 });
  },
});
