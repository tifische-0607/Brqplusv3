import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Explicit server-side admin authorization check.
 * Uses the SECURITY DEFINER `has_role` function via RPC so the check
 * cannot be bypassed by RLS misconfiguration on user_roles.
 * Throws if the caller is not an admin.
 */
export async function assertAdmin(
  supabase: SupabaseClient,
  userId: string | null | undefined,
): Promise<void> {
  if (!userId) throw new Error("Forbidden: authentication required");
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(`Authorization check failed: ${error.message}`);
  if (data !== true) throw new Error("Forbidden: admin role required");
}
