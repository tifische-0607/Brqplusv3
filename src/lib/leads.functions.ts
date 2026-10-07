import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const StatusEnum = z.enum(["new", "contacted", "qualified", "mission_active", "closed", "archived"]);

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

export const listLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { data: leadsData, error } = await supabase
      .from("leads")
      .select("id, reference, name, email, industry, mission, brief, status, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const leadIds = (leadsData ?? []).map((l: any) => l.id);
    let missionsMap: Record<string, any> = {};
    if (leadIds.length > 0) {
      const { data: missionsData, error: mErr } = await supabase
        .from("missions")
        .select("id, title, customer, country, description, lead_id")
        .in("lead_id", leadIds);
      if (mErr) throw new Error(mErr.message);
      for (const m of (missionsData ?? [])) {
        missionsMap[m.lead_id] = m;
      }
    }

    const leads = (leadsData ?? []).map((l: any) => ({
      ...l,
      linked_mission: missionsMap[l.id] ?? null,
    }));

    return { leads };
  });

export const updateLeadStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: StatusEnum }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { error } = await supabase
      .from("leads")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    const { error: histErr } = await supabase
      .from("lead_status_history")
      .insert({ lead_id: data.id, status: data.status, changed_by: userId });
    if (histErr) throw new Error(histErr.message);

    if (data.status === "mission_active") {
      const { data: existing } = await supabase
        .from("missions")
        .select("id")
        .eq("lead_id", data.id)
        .maybeSingle();
      if (!existing) {
        const { data: lead } = await supabase
          .from("leads")
          .select("mission, brief, name, industry")
          .eq("id", data.id)
          .maybeSingle();
        const { error: missErr } = await supabase.from("missions").insert({
          lead_id: data.id,
          title: lead?.mission || `Mission for ${lead?.name ?? "lead"}`,
          description: lead?.brief ?? null,
          customer: lead?.name ?? null,
          country: null,
        });
        if (missErr) throw new Error(missErr.message);
      }
    }
    return { ok: true as const };
  });

export const getLeadHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ leadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { data: rows, error } = await supabase
      .from("lead_status_history")
      .select("status, created_at, changed_by")
      .eq("lead_id", data.leadId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { history: rows ?? [] };
  });

// claimFirstAdmin removed: admin self-claim endpoint was a privilege-escalation
// risk. Provision admins via the database dashboard going forward.
