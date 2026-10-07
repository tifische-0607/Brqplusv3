import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MissionMilestone = {
  id: string;
  mission_id: string;
  title: string;
  description: string | null;
  target_date: string;
  completed_at: string | null;
  status: "upcoming" | "in_progress" | "completed" | "overdue";
  sort_order: number;
};

export type MissionProgressEntry = {
  id: string;
  mission_id: string;
  recorded_at: string;
  completion_pct: number;
  note: string | null;
  logged_by: string | null;
  milestone_id: string | null;
};

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden: admin only");
}

export const listMissionProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ mission_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: entries }, { data: milestones }] = await Promise.all([
      supabaseAdmin
        .from("mission_progress_entries")
        .select("id, mission_id, recorded_at, completion_pct, note, logged_by, milestone_id")
        .eq("mission_id", data.mission_id)
        .order("recorded_at", { ascending: true }),
      supabaseAdmin
        .from("mission_milestones")
        .select("id, mission_id, title, description, target_date, completed_at, status, sort_order")
        .eq("mission_id", data.mission_id)
        .order("sort_order", { ascending: true }),
    ]);
    return {
      entries: (entries ?? []) as MissionProgressEntry[],
      milestones: (milestones ?? []) as MissionMilestone[],
    };
  });

export const logProgressEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        mission_id: z.string().uuid(),
        completion_pct: z.number().int().min(0).max(100),
        recorded_at: z.string().datetime().optional(),
        note: z.string().trim().max(500).optional(),
        milestone_id: z.string().uuid().nullable().optional(),
        mark_milestone_complete: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    await assertAdmin(userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const recorded_at = data.recorded_at ?? new Date().toISOString();
    const { data: inserted, error } = await supabaseAdmin
      .from("mission_progress_entries")
      .insert({
        mission_id: data.mission_id,
        recorded_at,
        completion_pct: data.completion_pct,
        note: data.note ?? null,
        logged_by: userId,
        milestone_id: data.milestone_id ?? null,
      })
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);

    if (data.milestone_id && data.mark_milestone_complete) {
      await supabaseAdmin
        .from("mission_milestones")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", data.milestone_id);
    }

    // Post a system message to the mission's channel
    const { data: chan } = await supabaseAdmin
      .from("channels")
      .select("id")
      .eq("mission_id", data.mission_id)
      .maybeSingle();
    if (chan?.id) {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle();
      const name = prof?.full_name ?? "Mission lead";
      const noteSuffix = data.note ? ` Note: ${data.note}` : "";
      await supabaseAdmin.from("messages").insert({
        channel_id: chan.id,
        user_id: userId,
        content: `${name} logged a progress update: ${data.completion_pct}% complete.${noteSuffix}`,
      } as any);
    }

    return { id: inserted?.id ?? null };
  });

export const updateMilestoneStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        milestone_id: z.string().uuid(),
        status: z.enum(["upcoming", "in_progress", "completed", "overdue"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    await assertAdmin(userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: any = { status: data.status };
    if (data.status === "completed") patch.completed_at = new Date().toISOString();
    else patch.completed_at = null;
    const { error } = await supabaseAdmin
      .from("mission_milestones")
      .update(patch)
      .eq("id", data.milestone_id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
