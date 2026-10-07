import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MissionOverview = {
  id: string;
  // Mission Sheet (admin form) fields — source of truth
  brief: string | null;
  estimated_timeline: string | null;
  estimated_fee: string | null;
  // Contract overrides (set once a contract is signed)
  contract_fee: number | null;
  contract_currency: string;
  contract_signed_at: string | null;
  created_at: string;
};

export const getMissionOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ mission_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<MissionOverview> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: m, error } = await supabaseAdmin
      .from("missions")
      .select(
        "id, brief, estimated_timeline, estimated_fee, contract_fee, contract_currency, contract_signed_at, created_at",
      )
      .eq("id", data.mission_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!m) throw new Error("Mission not found");
    return m as MissionOverview;
  });
