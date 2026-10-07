import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ROLES = ["admin", "moderator", "collective_member", "user"] as const;
const RoleEnum = z.enum(ROLES);

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(`Authorization check failed: ${error.message}`);
  if (data !== true) throw new Error("Forbidden: admin role required");
}

export const listPortalUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    // Return a soft "forbidden" result instead of throwing, so non-admins
    // see the Access Denied view rather than a crashed screen.
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (isAdmin !== true) {
      return { forbidden: true as const, users: [] as any[], current_user_id: userId as string };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rolesRows, error: rolesErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role, created_at")
      .order("created_at", { ascending: false });
    if (rolesErr) throw new Error(rolesErr.message);

    const uniqueIds = Array.from(new Set((rolesRows ?? []).map((r: any) => r.user_id)));

    const { data: profiles, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .in("id", uniqueIds.length ? uniqueIds : ["00000000-0000-0000-0000-000000000000"]);
    if (profErr) throw new Error(profErr.message);
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    const emails = new Map<string, string>();
    const createdAt = new Map<string, string>();
    const lastSignIn = new Map<string, string | null>();
    await Promise.all(
      uniqueIds.map(async (id) => {
        const { data } = await supabaseAdmin.auth.admin.getUserById(id);
        if (data?.user) {
          emails.set(id, data.user.email ?? "");
          createdAt.set(id, data.user.created_at ?? "");
          lastSignIn.set(id, data.user.last_sign_in_at ?? null);
        }
      }),
    );

    const byUser = new Map<string, any>();
    for (const r of rolesRows ?? []) {
      const existing = byUser.get(r.user_id);
      if (existing) {
        existing.roles.push(r.role);
      } else {
        byUser.set(r.user_id, {
          user_id: r.user_id,
          email: emails.get(r.user_id) ?? "",
          full_name: (profileMap.get(r.user_id) as any)?.full_name ?? null,
          created_at: createdAt.get(r.user_id) ?? r.created_at,
          last_sign_in_at: lastSignIn.get(r.user_id) ?? null,
          roles: [r.role],
        });
      }
    }

    const users = Array.from(byUser.values()).sort((a, b) => {
      const aAdmin = a.roles.includes("admin") ? 0 : 1;
      const bAdmin = b.roles.includes("admin") ? 0 : 1;
      if (aAdmin !== bAdmin) return aAdmin - bAdmin;
      return String(a.email).localeCompare(String(b.email));
    });

    return { users, current_user_id: userId };
  });

const CreateInput = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(12).max(128),
  full_name: z.string().trim().max(200).optional().nullable(),
  role: RoleEnum,
});

export const createPortalUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: data.full_name ? { full_name: data.full_name } : undefined,
    });
    if (createErr || !created?.user) {
      throw new Error(createErr?.message ?? "Could not create user");
    }

    const newUserId = created.user.id;

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUserId, role: data.role });
    if (roleErr) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId).catch(() => null);
      throw new Error(`Created user but role assignment failed: ${roleErr.message}`);
    }

    await writeAudit(supabaseAdmin, {
      action: "grant",
      target_user_id: newUserId,
      target_email: data.email,
      role: data.role,
      actor_user_id: userId,
    });

    return { ok: true as const, user_id: newUserId };
  });

const GrantInput = z.object({
  user_id: z.string().uuid(),
  role: RoleEnum,
});

export const grantPortalRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GrantInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.user_id, role: data.role });
    if (error && !/duplicate key/i.test(error.message)) {
      throw new Error(error.message);
    }
    if (!error) {
      await writeAudit(supabaseAdmin, {
        action: "grant",
        target_user_id: data.user_id,
        role: data.role,
        actor_user_id: userId,
      });
    }
    return { ok: true as const };
  });

export const revokePortalRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GrantInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);

    if (data.role === "admin" && data.user_id === userId) {
      throw new Error("You cannot revoke your own admin role.");
    }

    if (data.role === "admin") {
      const { count, error: cErr } = await supabaseAdmin_count_admins();
      if (cErr) throw new Error(cErr);
      if (count <= 1) throw new Error("Cannot revoke the last remaining admin.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id)
      .eq("role", data.role);
    if (error) throw new Error(error.message);

    await writeAudit(supabaseAdmin, {
      action: "revoke",
      target_user_id: data.user_id,
      role: data.role,
      actor_user_id: userId,
    });

    return { ok: true as const };
  });

export const listRoleAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("admin_role_audit")
      .select("id, action, target_user_id, target_email, role, actor_user_id, actor_email, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const rows = data ?? [];
    const ids = Array.from(
      new Set(
        rows.flatMap((r: any) => [r.actor_user_id, r.target_user_id]).filter(Boolean),
      ),
    );
    const emails = new Map<string, string>();
    await Promise.all(
      ids.map(async (id: string) => {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
        if (u?.user?.email) emails.set(id, u.user.email);
      }),
    );

    const entries = rows.map((r: any) => ({
      ...r,
      actor_email: r.actor_email ?? (r.actor_user_id ? emails.get(r.actor_user_id) ?? null : null),
      target_email: r.target_email ?? emails.get(r.target_user_id) ?? null,
    }));

    return { entries };
  });

async function writeAudit(
  supabaseAdmin: any,
  row: {
    action: "grant" | "revoke";
    target_user_id: string;
    target_email?: string | null;
    role: string;
    actor_user_id: string;
  },
) {
  let actor_email: string | null = null;
  try {
    const { data } = await supabaseAdmin.auth.admin.getUserById(row.actor_user_id);
    actor_email = data?.user?.email ?? null;
  } catch {
    // best-effort
  }
  await supabaseAdmin.from("admin_role_audit").insert({
    action: row.action,
    target_user_id: row.target_user_id,
    target_email: row.target_email ?? null,
    role: row.role,
    actor_user_id: row.actor_user_id,
    actor_email,
  });
}

async function supabaseAdmin_count_admins(): Promise<{ count: number; error: string | null }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id", { count: "exact", head: true })
    .eq("role", "admin");
  if (error) return { count: 0, error: error.message };
  return { count: count ?? 0, error: null };
}
