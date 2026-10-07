// Give Network mission listings: corporate members submit, admins approve, public sees approved.
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/authz.server";

const PUBLIC_COLS = "id, company_name, workstream, title, summary, location, commitment, contact_email, created_at";

export const listPublicMissions = createServerFn({ method: "GET" }).handler(async () => {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const sb = createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const h = new Headers(init?.headers);
      if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
      h.set("apikey", key);
      return fetch(input, { ...init, headers: h });
    } },
  });
  const { data, error } = await sb.from("tgn_mission_listings").select(PUBLIC_COLS).eq("status", "approved").order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error("Could not load missions");
  return data ?? [];
});

export const missionSchema = z.object({
  workstream: z.enum(["A", "B", "C", "D"]),
  title: z.string().trim().min(3).max(140),
  summary: z.string().trim().min(20).max(2000),
  location: z.string().trim().max(120),
  commitment: z.string().trim().max(160),
  contactEmail: z.string().trim().email().max(255),
});

async function myCompany(sb: any, userId: string) {
  const { data } = await sb.from("company_members").select("company_id, companies:company_id(legal_name, trading_name)").eq("user_id", userId).maybeSingle();
  if (!data) throw new Error("Only corporate members can list missions.");
  return { id: data.company_id as string, name: (data.companies?.trading_name || data.companies?.legal_name || "") as string };
}

export const listMyCompanyMissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const c = await myCompany(context.supabase, context.userId);
    const { data } = await context.supabase.from("tgn_mission_listings").select("*").eq("company_id", c.id).order("created_at", { ascending: false });
    return data ?? [];
  });

export const submitMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => missionSchema.parse(d))
  .handler(async ({ data, context }) => {
    const c = await myCompany(context.supabase, context.userId);
    const { error } = await context.supabase.from("tgn_mission_listings").insert({
      company_id: c.id, company_name: c.name, submitted_by: context.userId, workstream: data.workstream,
      title: data.title, summary: data.summary, location: data.location || null, commitment: data.commitment || null,
      contact_email: data.contactEmail, status: "pending",
    });
    if (error) throw new Error("Could not submit mission.");
    return { ok: true };
  });

export const withdrawMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("tgn_mission_listings").delete().eq("id", data.id).eq("status", "pending");
    if (error) throw new Error("Could not withdraw mission.");
    return { ok: true };
  });

export const adminListMissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data } = await context.supabase.from("tgn_mission_listings").select("*").order("created_at", { ascending: false });
    return data ?? [];
  });

export const adminUpdateMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => missionSchema.partial().extend({
    id: z.string().uuid(),
    status: z.enum(["pending", "approved", "rejected", "closed"]).optional(),
    reviewNote: z.string().trim().max(500).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const patch: Record<string, any> = {};
    if (data.workstream) patch.workstream = data.workstream;
    if (data.title) patch.title = data.title;
    if (data.summary) patch.summary = data.summary;
    if (data.location !== undefined) patch.location = data.location || null;
    if (data.commitment !== undefined) patch.commitment = data.commitment || null;
    if (data.contactEmail) patch.contact_email = data.contactEmail;
    if (data.reviewNote !== undefined) patch.review_note = data.reviewNote || null;
    if (data.status) { patch.status = data.status; patch.reviewed_by = context.userId; patch.reviewed_at = new Date().toISOString(); }
    const { error } = await context.supabase.from("tgn_mission_listings").update(patch as any).eq("id", data.id);
    if (error) throw new Error("Could not update mission.");
    return { ok: true };
  });

export const adminDeleteMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("tgn_mission_listings").delete().eq("id", data.id);
    if (error) throw new Error("Could not delete mission.");
    return { ok: true };
  });
