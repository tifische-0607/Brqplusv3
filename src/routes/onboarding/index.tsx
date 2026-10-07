import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/onboarding/")({
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/onboarding/setup",
      replace: true,
      search: search as Record<string, unknown>,
    });
  },
});
