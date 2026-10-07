import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AvailabilityEnum = z.enum(["available", "limited", "unavailable", "not_deployed"]);
const BUCKET = "executive-avatars";

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

export const ExecInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  role: z.string().trim().min(1, "Role is required").max(200),
  company: z.string().trim().max(200).optional().nullable(),
  expertise: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  markets: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  availability: AvailabilityEnum.default("available"),
  email: z.string().trim().email("Invalid email").max(254).optional().nullable(),
  bio: z.string().trim().max(4000).optional().nullable(),
  avatar_path: z.string().max(500).optional().nullable(),
  linkedin_url: z
    .string()
    .trim()
    .url("LinkedIn URL must be a valid http(s) URL")
    .max(500)
    .refine((v) => /^https?:\/\//i.test(v), "LinkedIn URL must be a valid http(s) URL")
    .optional()
    .nullable(),
});
export type ExecInput = z.infer<typeof ExecInput>;


async function withSignedUrls(supabase: any, rows: any[]) {
  return Promise.all(
    rows.map(async (r) => {
      if (!r.avatar_path) return { ...r, avatar_url: null };
      const { data } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(r.avatar_path, 3600);
      return { ...r, avatar_url: data?.signedUrl ?? null };
    }),
  );
}

export type Executive = {
  id: string;
  name: string;
  role: string;
  company: string | null;
  expertise: string[];
  markets: string[];
  availability: "available" | "limited" | "unavailable" | "not_deployed";
  email: string | null;
  bio: string | null;
  avatar_path: string | null;
  avatar_url: string | null;
  linkedin_url: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
  mission_count: number;
};

export type PublicExecutive = {
  id: string;
  name: string;
  role: string;
  company: string | null;
  expertise: string[];
  markets: string[];
  availability: "available" | "limited" | "unavailable" | "not_deployed";
  bio: string | null;
  avatar_path: string | null;
  avatar_url: string | null;
  linkedin_url: string | null;
};

export const listExecutivesPublic = createServerFn({ method: "GET" }).handler(
  async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("fractional_executives")
      .select(
        "id, name, role, company, expertise, markets, availability, bio, avatar_path, linkedin_url, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const withUrls = await withSignedUrls(supabaseAdmin, data ?? []);
    return {
      executives: withUrls.map((e: any) => ({
        id: e.id,
        name: e.name,
        role: e.role,
        company: e.company ?? null,
        expertise: e.expertise ?? [],
        markets: e.markets ?? [],
        availability: e.availability,
        bio: e.bio ?? null,
        avatar_path: e.avatar_path ?? null,
        avatar_url: e.avatar_url ?? null,
        linkedin_url: e.linkedin_url ?? null,
      })) as PublicExecutive[],
    };
  },
);

export const listExecutives = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    // Check if caller is admin to decide whether to project the email column.
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = !!roleRow;

    // Use admin client so non-admin members can still browse the directory,
    // but with a safe column projection that excludes email for non-admins.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const safeCols = "id, name, role, company, expertise, markets, availability, bio, avatar_path, linkedin_url, user_id, created_at, updated_at";
    const adminCols = `${safeCols}, email`;
    const { data, error } = await supabaseAdmin
      .from("fractional_executives")
      .select(isAdmin ? adminCols : safeCols)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const execIds = (data ?? []).map((r: any) => r.id);
    let missionCounts: Record<string, number> = {};
    if (execIds.length > 0) {
      const { data: meData, error: meErr } = await supabaseAdmin
        .from("mission_experts")
        .select("executive_id")
        .in("executive_id", execIds);
      if (meErr) throw new Error(meErr.message);
      for (const row of (meData ?? [])) {
        missionCounts[row.executive_id] = (missionCounts[row.executive_id] ?? 0) + 1;
      }
    }

    // Respect linked members' directory visibility settings.
    const linkedIds = (data ?? []).map((r: any) => r.user_id).filter(Boolean);
    const vis = new Map<string, any>();
    if (linkedIds.length) {
      const { data: pv } = await supabaseAdmin.from("profiles").select("id, show_in_directory, show_linkedin").in("id", linkedIds);
      for (const p of pv ?? []) vis.set((p as any).id, p);
    }
    const visible = (data ?? []).filter((r: any) => isAdmin || !r.user_id || vis.get(r.user_id)?.show_in_directory !== false);
    const executives = await withSignedUrls(supabaseAdmin, visible);
    return {
      executives: executives.map((e: any) => ({
        ...e,
        markets: e.markets ?? [],
        linkedin_url: e.user_id && vis.get(e.user_id)?.show_linkedin === false && !isAdmin ? null : e.linkedin_url,
        email: isAdmin ? (e.email ?? null) : null,
        mission_count: missionCounts[e.id] ?? 0,
      })) as Executive[],
    };
  });

export const createExecutive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ExecInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { data: row, error } = await supabase
      .from("fractional_executives")
      .insert(data)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { executive: row };
  });

export const updateExecutive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), patch: ExecInput.partial() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    // If avatar is being replaced/removed, clean up old file
    if (Object.prototype.hasOwnProperty.call(data.patch, "avatar_path")) {
      const { data: existing } = await supabase
        .from("fractional_executives")
        .select("avatar_path")
        .eq("id", data.id)
        .maybeSingle();
      const oldPath = existing?.avatar_path;
      if (oldPath && oldPath !== data.patch.avatar_path) {
        await supabase.storage.from(BUCKET).remove([oldPath]);
      }
    }
    const { error } = await supabase
      .from("fractional_executives")
      .update(data.patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteExecutive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { data: existing } = await supabase
      .from("fractional_executives")
      .select("avatar_path")
      .eq("id", data.id)
      .maybeSingle();
    if (existing?.avatar_path) {
      await supabase.storage.from(BUCKET).remove([existing.avatar_path]);
    }
    const { error } = await supabase
      .from("fractional_executives")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const getMyExecutive = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const { data, error } = await supabase
      .from("fractional_executives")
      .select("id, name, role, company, expertise, markets, availability, email, bio, avatar_path, linkedin_url, created_at, updated_at, user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { executive: null };
    const [withUrl] = await withSignedUrls(supabase, [data]);
    return { executive: { ...withUrl, markets: (withUrl as any).markets ?? [], mission_count: 0 } as Executive };
  });

export const upsertMyExecutive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ExecInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: existing, error: selErr } = await supabase
      .from("fractional_executives")
      .select("id, avatar_path")
      .eq("user_id", userId)
      .maybeSingle();
    if (selErr) throw new Error(selErr.message);

    if (existing) {
      if (existing.avatar_path && existing.avatar_path !== data.avatar_path) {
        await supabase.storage.from(BUCKET).remove([existing.avatar_path]);
      }
      const { error } = await supabase
        .from("fractional_executives")
        .update(data)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { ok: true as const, id: existing.id };
    }
    // Members cannot self-create an executive profile; an admin must set
    // it up and link the user_id first.
    throw new Error(
      "Your executive profile has not been set up yet. Please contact an admin.",
    );
  });

export const adminResetExecutivePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        executive_id: z.string().uuid(),
        new_password: z.string().min(8, "Password must be at least 8 characters").max(128),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: exec, error: selErr } = await supabaseAdmin
      .from("fractional_executives")
      .select("user_id, name")
      .eq("id", data.executive_id)
      .maybeSingle();
    if (selErr) throw new Error(selErr.message);
    if (!exec) throw new Error("Executive not found");
    if (!exec.user_id) throw new Error("This executive has no linked login account");

    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(exec.user_id, {
      password: data.new_password,
    });
    if (updErr) throw new Error(updErr.message);

    const { error: auditErr } = await supabaseAdmin
      .from("admin_password_reset_audit")
      .insert({
        admin_id: userId,
        executive_id: data.executive_id,
        executive_user_id: exec.user_id,
      });
    if (auditErr) {
      console.error("Failed to write password reset audit log:", auditErr.message);
    }
    return { ok: true as const };
  });
