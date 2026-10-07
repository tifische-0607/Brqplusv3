import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(`Authorization check failed: ${error.message}`);
  if (data !== true) throw new Error("Forbidden: admin role required");
}

export type AdminKpis = {
  members_total: number;
  members_onboarded: number;
  missions_total: number;
  missions_active: number;
  missions_in_review: number;
  missions_completed: number;
  applications_total: number;
  applications_new_30d: number;
  insights_published: number;
  insights_drafts: number;
  leads_open: number;
};

export const getAdminKpis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminKpis> => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);

    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const headCount = async (table: string, filter?: (q: any) => any) => {
      let q = supabase.from(table).select("*", { count: "exact", head: true });
      if (filter) q = filter(q);
      const { count, error } = await q;
      if (error) throw new Error(`${table}: ${error.message}`);
      return count ?? 0;
    };

    const [
      members_total,
      members_onboarded,
      missions_total,
      missions_active,
      missions_in_review,
      missions_completed,
      applications_total,
      applications_new_30d,
      insights_published,
      insights_drafts,
      leads_open,
    ] = await Promise.all([
      headCount("profiles"),
      headCount("profiles", (q) => q.eq("is_onboarded", true)),
      headCount("missions"),
      headCount("missions", (q) => q.eq("status", "active")),
      headCount("missions", (q) => q.eq("status", "in_review")),
      headCount("missions", (q) => q.eq("status", "completed")),
      headCount("collective_applications"),
      headCount("collective_applications", (q) => q.gte("created_at", since30)),
      headCount("insights", (q) => q.eq("published", true)),
      headCount("insights", (q) => q.eq("published", false)),
      headCount("leads", (q) => q.not("status", "in", "(closed,archived)")),
    ]);

    return {
      members_total,
      members_onboarded,
      missions_total,
      missions_active,
      missions_in_review,
      missions_completed,
      applications_total,
      applications_new_30d,
      insights_published,
      insights_drafts,
      leads_open,
    };
  });

const APP_STATUSES = ["pending", "invited", "rejected"] as const;

const ListInput = z
  .object({ status: z.enum(APP_STATUSES).optional() })
  .optional();

export const listApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    let query = supabase
      .from("collective_applications")
      .select(
        "id, reference, full_name, email, linkedin_url, role_title, primary_domain, markets, mandate_description, referral_source, created_at, status, reviewed_at, reviewed_by, rejection_reason",
      )
      .order("created_at", { ascending: false });
    if (data?.status) query = query.eq("status", data.status);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    // Resolve reviewer emails (same approach as listRoleAudit).
    const reviewerIds = Array.from(
      new Set((rows ?? []).map((r: any) => r.reviewed_by).filter(Boolean)),
    ) as string[];
    const emails = new Map<string, string>();
    if (reviewerIds.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await Promise.all(
        reviewerIds.map(async (id) => {
          try {
            const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
            if (u?.user?.email) emails.set(id, u.user.email);
          } catch {
            // best-effort
          }
        }),
      );
    }

    const applications = (rows ?? []).map((r: any) => ({
      ...r,
      reviewed_by_email: r.reviewed_by ? emails.get(r.reviewed_by) ?? null : null,
    }));

    return { applications };
  });

async function writeApplicationAudit(
  supabaseAdmin: any,
  row: {
    application_id: string;
    action: "invite" | "reject" | "reopen";
    actor_user_id: string;
    reason?: string | null;
  },
) {
  let actor_email: string | null = null;
  try {
    const { data } = await supabaseAdmin.auth.admin.getUserById(row.actor_user_id);
    actor_email = data?.user?.email ?? null;
  } catch {
    // best-effort
  }
  await supabaseAdmin.from("application_review_audit").insert({
    application_id: row.application_id,
    action: row.action,
    actor_user_id: row.actor_user_id,
    actor_email,
    reason: row.reason ?? null,
  });
}

async function currentStatus(supabase: any, id: string): Promise<string> {
  const { data, error } = await supabase
    .from("collective_applications")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Application not found");
  return data.status as string;
}

export const rejectApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), reason: z.string().trim().max(2000).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);

    const status = await currentStatus(supabase, data.id);
    if (status !== "pending") {
      throw new Error(`Only pending applications can be rejected (current status: ${status}).`);
    }

    const { error } = await supabase
      .from("collective_applications")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        reviewed_by: userId,
        rejection_reason: data.reason?.length ? data.reason : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await writeApplicationAudit(supabaseAdmin, {
      application_id: data.id,
      action: "reject",
      actor_user_id: userId,
      reason: data.reason ?? null,
    });

    return { ok: true as const };
  });

export const reopenApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);

    const status = await currentStatus(supabase, data.id);
    if (status !== "rejected") {
      throw new Error(`Only rejected applications can be reopened (current status: ${status}).`);
    }

    const { error } = await supabase
      .from("collective_applications")
      .update({
        status: "pending",
        reviewed_at: null,
        reviewed_by: null,
        rejection_reason: null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await writeApplicationAudit(supabaseAdmin, {
      application_id: data.id,
      action: "reopen",
      actor_user_id: userId,
    });

    return { ok: true as const };
  });

export const deleteApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);

    const status = await currentStatus(supabase, data.id);
    if (status !== "rejected") {
      throw new Error("Only rejected applications can be permanently deleted.");
    }

    const { error } = await supabase.from("collective_applications").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
