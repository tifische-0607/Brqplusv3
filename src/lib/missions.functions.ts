import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string | null | undefined) {
  const { assertAdmin: impl } = await import("@/lib/authz.server");
  return impl(supabase, userId);
}



const MissionStatus = z.enum(["not_started", "active", "completed", "cancelled"]);

const MissionInput = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional().nullable(),
  country: z.string().max(120).optional().nullable(),
  customer: z.string().max(255).optional().nullable(),
  lead_id: z.string().uuid().optional().nullable(),
  lead_executive_id: z.string().uuid().optional().nullable(),
  status: MissionStatus.optional().default("not_started"),
  priority: z.enum(["P1", "P2", "P3", "P4", "P5"]).optional().default("P3"),
  expert_ids: z.array(z.string().uuid()).max(50).optional().default([]),
  brief: z.string().max(5000).optional().nullable(),
  estimated_timeline: z.string().max(255).optional().nullable(),
  estimated_fee: z.string().max(255).optional().nullable(),
  expected_outcome: z.string().max(5000).optional().nullable(),
});


export const listMissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;

    // Check if admin; if not, scope to missions the user is assigned to
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });

    let allowedMissionIds: string[] | null = null;
    if (!isAdmin) {
      // Find this user's executive_id
      const { data: exec } = await supabase
        .from("fractional_executives")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      const execId = exec?.id as string | undefined;
      if (execId) {
        const { data: assignments } = await supabase
          .from("mission_experts")
          .select("mission_id")
          .eq("executive_id", execId);
        allowedMissionIds = (assignments ?? []).map((a: any) => a.mission_id);
      }
      // If no exec record or no assignments, non-admins see nothing
      if (!allowedMissionIds || allowedMissionIds.length === 0) {
        return { missions: [] };
      }
    }

    let missionsQuery = supabase
      .from("missions")
      .select("id, title, description, country, customer, lead_id, lead_executive_id, status, priority, brief, estimated_timeline, estimated_fee, expected_outcome, created_at, updated_at, lead_executive:fractional_executives!missions_lead_executive_id_fkey(id, name, role, avatar_path)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (allowedMissionIds) {
      missionsQuery = missionsQuery.in("id", allowedMissionIds);
    }
    const { data: missions, error } = await missionsQuery;
    if (error) throw new Error(error.message);

    const missionIds = (missions ?? []).map((m: any) => m.id);
    const { data: assignments, error: aErr } = await supabase
      .from("mission_experts")
      .select("mission_id, executive_id, fractional_executives(id, name, role, avatar_path)")
      .in("mission_id", missionIds.length ? missionIds : ["00000000-0000-0000-0000-000000000000"]);
    if (aErr) throw new Error(aErr.message);

    const { data: history, error: hErr } = missionIds.length
      ? await supabase
          .from("mission_status_history")
          .select("mission_id, status, created_at")
          .in("mission_id", missionIds)
          .order("created_at", { ascending: false })
      : { data: [], error: null };
    if (hErr) throw new Error(hErr.message);

    const byMission: Record<string, any[]> = {};
    for (const a of assignments ?? []) {
      const m = a.mission_id as string;
      (byMission[m] ||= []).push(a.fractional_executives);
    }
    const historyByMission: Record<string, { status: string; created_at: string }[]> = {};
    for (const h of history ?? []) {
      (historyByMission[h.mission_id as string] ||= []).push({
        status: h.status,
        created_at: h.created_at,
      });
    }
    return {
      missions: (missions ?? []).map((m: any) => ({
        ...m,
        experts: byMission[m.id] ?? [],
        status_history: historyByMission[m.id] ?? [],
      })),
    };
  });

export const listExpertsForPicker = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { data, error } = await supabase
      .from("fractional_executives")
      .select("id, name, role, availability")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return { experts: data ?? [] };
  });

export const createMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => MissionInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { data: m, error } = await supabase
      .from("missions")
      .insert({
        title: data.title,
        description: data.description ?? null,
        country: data.country ?? null,
        customer: data.customer ?? null,
        lead_id: data.lead_id ?? null,
        lead_executive_id: data.lead_executive_id ?? null,
        status: data.status ?? "not_started",
        priority: data.priority ?? "P3",
        brief: data.brief ?? null,
        estimated_timeline: data.estimated_timeline ?? null,
        estimated_fee: data.estimated_fee ?? null,
        expected_outcome: data.expected_outcome ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    if (data.expert_ids && data.expert_ids.length > 0) {

      const rows = data.expert_ids.map((eid) => ({ mission_id: m.id, executive_id: eid }));
      const { error: eErr } = await supabase.from("mission_experts").insert(rows);
      if (eErr) throw new Error(eErr.message);
    }
    await ensureMissionChannelAndSync(m.id as string, data.title, userId);
    return { id: m.id as string };
  });


export const updateMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    MissionInput.extend({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { error } = await supabase
      .from("missions")
      .update({
        title: data.title,
        description: data.description ?? null,
        country: data.country ?? null,
        customer: data.customer ?? null,
        lead_id: data.lead_id ?? null,
        lead_executive_id: data.lead_executive_id ?? null,
        status: data.status ?? "not_started",
        priority: data.priority ?? "P3",
        brief: data.brief ?? null,
        estimated_timeline: data.estimated_timeline ?? null,
        estimated_fee: data.estimated_fee ?? null,
        expected_outcome: data.expected_outcome ?? null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    const { error: dErr } = await supabase
      .from("mission_experts")
      .delete()
      .eq("mission_id", data.id);
    if (dErr) throw new Error(dErr.message);

    if (data.expert_ids && data.expert_ids.length > 0) {
      const rows = data.expert_ids.map((eid) => ({ mission_id: data.id, executive_id: eid }));
      const { error: eErr } = await supabase.from("mission_experts").insert(rows);
      if (eErr) throw new Error(eErr.message);
    }
    await ensureMissionChannelAndSync(data.id, data.title, userId);
    return { ok: true as const };
  });

async function ensureMissionChannelAndSync(
  missionId: string,
  missionTitle: string,
  userId: string,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: existing } = await supabaseAdmin
    .from("channels")
    .select("id")
    .eq("mission_id", missionId)
    .maybeSingle();
  let channelId = existing?.id as string | undefined;
  if (!channelId) {
    const { data: chan, error: cErr } = await supabaseAdmin
      .from("channels")
      .insert({
        name: missionTitle,
        type: "mission",
        created_by: userId,
        mission_id: missionId,
      })
      .select("id")
      .single();
    if (cErr) throw new Error(cErr.message);
    channelId = chan.id as string;
    // Seed creator membership so they can see the channel immediately
    await supabaseAdmin
      .from("channel_members")
      .upsert(
        { channel_id: channelId, user_id: userId },
        { onConflict: "channel_id,user_id" },
      );
  } else {
    // Keep channel name in sync with mission title
    await supabaseAdmin
      .from("channels")
      .update({ name: missionTitle })
      .eq("id", channelId);
  }
  const { error: sErr } = await supabaseAdmin.rpc("sync_mission_channel_members", {
    _mission_id: missionId,
  });
  if (sErr) throw new Error(sErr.message);
}


export const deleteMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { error } = await supabase.from("missions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

const MissionLeadStatus = z.enum(["new", "contacted", "qualified", "won", "lost"]);

const MissionLeadInput = z.object({
  mission_id: z.string().uuid(),
  name: z.string().trim().min(1).max(255),
  email: z.string().trim().email().max(255),
  company: z.string().trim().max(255).optional().nullable(),
  message: z.string().trim().max(5000).optional().nullable(),
  status: MissionLeadStatus.optional().default("new"),
});

export const listMissionLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ mission_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { data: rows, error } = await supabase
      .from("mission_leads")
      .select("id, mission_id, name, email, company, message, status, created_at, updated_at")
      .eq("mission_id", data.mission_id)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return { leads: rows ?? [] };
  });

export const createMissionLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => MissionLeadInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { data: row, error } = await supabase
      .from("mission_leads")
      .insert({
        mission_id: data.mission_id,
        name: data.name,
        email: data.email,
        company: data.company ?? null,
        message: data.message ?? null,
        status: data.status ?? "new",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const updateMissionLeadStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: MissionLeadStatus }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { error } = await supabase
      .from("mission_leads")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteMissionLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { error } = await supabase.from("mission_leads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
