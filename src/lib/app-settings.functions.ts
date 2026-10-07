import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DEFAULT_REQUEST_ACCESS_EMAIL = "admin@brqplus.ai";

export const getRequestAccessEmail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "request_access_email")
      .maybeSingle();
    if (error || !data?.value) return { email: DEFAULT_REQUEST_ACCESS_EMAIL };
    return { email: data.value };
  });

export const setRequestAccessEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string }) =>
    z.object({ email: z.string().email().max(254) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertAdmin } = await import("@/lib/authz.server");
    await assertAdmin(supabase, userId);

    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "request_access_email", value: data.email }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { email: data.email };
  });

