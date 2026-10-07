// Admin work-queue counts and lists (documents pending, deletion requests, program sign-ups).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(`Authorization check failed: ${error.message}`);
  if (data !== true) throw new Error("Forbidden: admin role required");
}
async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
}

async function pendingDocs(sb: any) {
  const [{ data: parties }, { data: current }, { data: members }] = await Promise.all([
    sb.from("engagement_nda_parties").select("id, name, email, company_name, created_at, engagement_ndas(mission_id, missions(title))").eq("status", "pending").order("created_at", { ascending: false }),
    sb.from("agreement_versions").select("id, version").eq("doc_type", "membership_agreement").eq("is_current", true).maybeSingle(),
    sb.from("profiles").select("id, full_name, member_type, company_id").eq("membership_status", "active"),
  ]);
  let unsigned: any[] = [];
  if (current) {
    const { data: sigs } = await sb.from("agreement_signatures").select("user_id").eq("agreement_version_id", current.id);
    const signed = new Set((sigs ?? []).map((s: any) => s.user_id));
    unsigned = (members ?? []).filter((m: any) => !signed.has(m.id));
  }
  return {
    ndas: (parties ?? []).map((p: any) => ({ id: p.id as string, name: p.name as string, email: (p.email ?? null) as string | null, company_name: (p.company_name ?? null) as string | null, created_at: p.created_at as string, mission_id: (p.engagement_ndas?.mission_id ?? null) as string | null, mission_title: (p.engagement_ndas?.missions?.title ?? null) as string | null })),
    agreement_version: (current?.version ?? null) as string | null,
    members: unsigned.map((m: any) => ({ id: m.id as string, full_name: (m.full_name ?? null) as string | null, member_type: (m.member_type ?? null) as string | null })),
  };
}

export const getAdminQueueKpis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const sb = await admin();
    const since = new Date(Date.now() - 7 * 86400_000).toISOString();
    const c = async (t: string, f: (q: any) => any) => {
      const { count, error } = await f(sb.from(t).select("id", { count: "exact", head: true }));
      if (error) throw new Error(`${t}: ${error.message}`);
      return count ?? 0;
    };
    const [docs, deletions, i, r, f] = await Promise.all([
      pendingDocs(sb),
      c("account_deletion_requests", (q) => q.in("status", ["pending", "in_progress"])),
      c("tgn_interests", (q) => q.gte("created_at", since)),
      c("tgn_rsvps", (q) => q.gte("created_at", since)),
      c("founder_applications", (q) => q.gte("created_at", since)),
    ]);
    return { docs_pending: docs.ndas.length + docs.members.length, deletion_open: deletions, program_signups_7d: i + r + f };
  });

export const listPendingDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    return pendingDocs(await admin());
  });

export const listDeletionRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { data, error } = await supabase.from("account_deletion_requests").select("id, user_id, email, reason, status, handled_at, created_at").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{ id: string; user_id: string; email: string | null; reason: string | null; status: string; handled_at: string | null; created_at: string }>;
  });

export const markDeletionRequestHandled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const sb = await admin();
    const { error } = await sb.from("account_deletion_requests").update({ status: "completed", handled_by: userId, handled_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
