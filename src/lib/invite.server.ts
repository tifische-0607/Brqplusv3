// Server-only helpers shared by every invite path (admin invites, membership approvals, company colleague invites).

export function validateRedirectTo(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid redirect URL");
  }
  const host = parsed.hostname;
  const allowed = new Set(
    [process.env.SITE_URL, "https://brqplus.ai", "https://www.brqplus.ai", "https://v3.brqplus.ai", "https://brq-plus-digital-vanguard.lovable.app"]
      .filter(Boolean)
      .map((o) => new URL(o as string).origin),
  );
  const ok =
    allowed.has(parsed.origin) ||
    (parsed.protocol === "https:" && (host.endsWith(".lovable.app") || host.endsWith(".lovableproject.com"))) ||
    host === "localhost";
  if (!ok) throw new Error("Invalid redirect URL");
}

/** Creates an onboarding token and sends the account invitation email. Returns the new auth user id. */
export async function sendOnboardingInvite(opts: {
  email: string;
  full_name?: string | null;
  created_by: string;
  redirect_to: string;
}): Promise<{ user_id: string | null; onboarding_url: string; token: string }> {
  validateRedirectTo(opts.redirect_to);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const email = opts.email.trim().toLowerCase();
  const { data: invite, error: invErr } = await supabaseAdmin
    .from("onboarding_invites")
    .insert({ email, full_name: opts.full_name ?? null, created_by: opts.created_by })
    .select("token")
    .single();
  if (invErr || !invite) throw new Error(invErr?.message ?? "Could not create invite");
  const url = new URL(opts.redirect_to);
  url.searchParams.set("token", invite.token as string);
  const { data: result, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: url.toString(),
    data: opts.full_name ? { full_name: opts.full_name } : undefined,
  });
  if (error) throw new Error(error.message);
  return { user_id: result?.user?.id ?? null, onboarding_url: url.toString(), token: invite.token as string };
}

export async function actorEmail(userId: string): Promise<string | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
    return data?.user?.email ?? null;
  } catch {
    return null;
  }
}
