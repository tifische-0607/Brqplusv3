import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { MembersLayout } from "@/components/members/MembersLayout";
import { OnboardingGuard } from "@/components/OnboardingGuard";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
    return { user: data.user };
  },
  component: () => (
    <OnboardingGuard>
      <MembersLayout>
        <Outlet />
      </MembersLayout>
    </OnboardingGuard>
  ),
});
