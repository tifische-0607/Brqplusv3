import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(`Authorization check failed: ${error.message}`);
  if (data !== true) throw new Error("Forbidden: admin role required");
}

function validateRedirectTo(url: string): void {
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

const InviteInput = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  redirect_to: z.string().trim().url().max(500),
  full_name: z.string().trim().max(200).optional().nullable(),
  application_id: z.string().uuid().optional(),
});

export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InviteInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);

    const { sendOnboardingInvite } = await import("./invite.server");
    const sent = await sendOnboardingInvite({
      email: data.email,
      full_name: data.full_name ?? null,
      created_by: userId,
      redirect_to: data.redirect_to,
    });
    const result = { user: { id: sent.user_id } };
    const redirectWithToken = sent.onboarding_url;
    const invite = { token: sent.token };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Best-effort: mark the source application as invited and log the decision.
    if (data.application_id) {
      try {
        const { error: updErr } = await supabaseAdmin
          .from("collective_applications")
          .update({
            status: "invited",
            reviewed_at: new Date().toISOString(),
            reviewed_by: userId,
          })
          .eq("id", data.application_id);
        if (updErr) throw updErr;

        let actor_email: string | null = null;
        try {
          const { data: actor } = await supabaseAdmin.auth.admin.getUserById(userId);
          actor_email = actor?.user?.email ?? null;
        } catch {
          // best-effort
        }
        await supabaseAdmin.from("application_review_audit").insert({
          application_id: data.application_id,
          action: "invite",
          actor_user_id: userId,
          actor_email,
        });
      } catch (e) {
        console.error("[inviteMember] application status/audit update failed", e);
      }
    }

    return {
      ok: true as const,
      user_id: result?.user?.id ?? null,
      onboarding_url: redirectWithToken,
      token: invite.token as string,
    };
  });

const TokenInput = z.object({ token: z.string().uuid() });

const ResendInput = z.object({
  redirect_to: z.string().trim().url().max(500),
});

export const resendOnboardingInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ResendInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId, claims } = context as any;
    const userEmail = String(claims?.email ?? "").toLowerCase();
    if (!userEmail) throw new Error("No email found for your account.");

    validateRedirectTo(data.redirect_to);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("is_onboarded")
      .eq("id", userId)
      .maybeSingle();
    if (profile?.is_onboarded) throw new Error("You are already onboarded.");

    const { data: invite, error: invErr } = await supabaseAdmin
      .from("onboarding_invites")
      .insert({ email: userEmail, created_by: userId })
      .select("token")
      .single();
    if (invErr || !invite) throw new Error(invErr?.message ?? "Could not create invite.");

    const url = new URL(data.redirect_to);
    url.searchParams.set("token", invite.token as string);

    return { ok: true as const, onboarding_url: url.toString(), token: invite.token as string };
  });

export const validateOnboardingToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TokenInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context as any;
    const userEmail = String(claims?.email ?? "").toLowerCase();
    const { data: invite, error } = await supabase
      .from("onboarding_invites")
      .select("id, email, expires_at, used_at, used_by")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!invite) throw new Error("Invalid invitation link.");
    if (String(invite.email).toLowerCase() !== userEmail) {
      throw new Error("This invitation does not match your account.");
    }
    if (invite.used_at && invite.used_by !== userId) {
      throw new Error("This invitation has already been used.");
    }
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      throw new Error("This invitation has expired.");
    }
    return { ok: true as const, invite_id: invite.id as string };
  });

export const consumeOnboardingToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TokenInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId, claims } = context as any;
    const userEmail = String(claims?.email ?? "").toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invite, error: fetchErr } = await supabaseAdmin
      .from("onboarding_invites")
      .select("id, email, used_at, used_by")
      .eq("token", data.token)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!invite) throw new Error("Invalid invitation.");
    if (String(invite.email).toLowerCase() !== userEmail) {
      throw new Error("Invitation/account mismatch.");
    }
    if (invite.used_at) return { ok: true as const };
    const { error } = await supabaseAdmin
      .from("onboarding_invites")
      .update({ used_at: new Date().toISOString(), used_by: userId })
      .eq("id", invite.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

const ExecProfileInput = z.object({
  full_name: z.string().trim().min(1).max(200),
  job_title: z.string().trim().min(1).max(200),
  industry: z.string().trim().min(1).max(200),
  areas_of_expertise: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  phone: z.string().trim().max(40).optional().nullable(),
  linkedin_url: z
    .string()
    .trim()
    .url()
    .max(500)
    .refine((v) => /^https?:\/\//i.test(v), "LinkedIn URL must start with http(s)")
    .optional()
    .nullable()
    .or(z.literal("")),
  bio: z.string().trim().max(4000).optional().nullable(),
});

export const updateExecutiveProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ExecProfileInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const linkedin = data.linkedin_url && data.linkedin_url.length > 0 ? data.linkedin_url : null;
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: data.full_name,
        job_title: data.job_title,
        industry: data.industry,
        areas_of_expertise: data.areas_of_expertise,
        phone: data.phone ?? null,
        linkedin_url: linkedin,
        bio: data.bio ?? null,
      })
      .eq("id", userId);
    if (error) throw new Error(error.message);

    // Mirror the member's profile into the collective directory so they
    // appear immediately after onboarding. Use the admin client because
    // the RLS policy on fractional_executives only allows admin inserts.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // BRQ+ Membership: only legacy members (no member_type) or approved Collective members appear in the Collective directory.
    const { data: mprof } = await supabaseAdmin
      .from("profiles").select("member_type, collective_status").eq("id", userId).maybeSingle();
    if (mprof?.member_type && mprof.collective_status !== "approved") return { ok: true as const };
    const { data: existing, error: selErr } = await supabaseAdmin
      .from("fractional_executives")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (selErr) throw new Error(selErr.message);

    const execPayload = {
      name: data.full_name,
      role: data.job_title,
      expertise: data.areas_of_expertise ?? [],
      bio: data.bio ?? null,
      linkedin_url: linkedin,
    };

    if (existing) {
      const { error: updErr } = await supabaseAdmin
        .from("fractional_executives")
        .update(execPayload)
        .eq("id", existing.id);
      if (updErr) throw new Error(updErr.message);
    } else {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
      const email = authUser?.user?.email ?? null;
      const { error: insErr } = await supabaseAdmin
        .from("fractional_executives")
        .insert({
          ...execPayload,
          email,
          user_id: userId,
          availability: "not_deployed",
        });
      if (insErr) throw new Error(insErr.message);
    }
    return { ok: true as const };
  });

const SignInput = z.object({
  agreement_id: z.string().uuid(),
  legal_name: z.string().trim().min(2).max(200),
  agreed: z.literal(true),
});

export const signAgreement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SignInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    // Confirm the agreement exists and is still active
    const { data: agreement, error: agErr } = await supabase
      .from("legal_agreements")
      .select("id, is_active")
      .eq("id", data.agreement_id)
      .maybeSingle();
    if (agErr) throw new Error(agErr.message);
    if (!agreement || !agreement.is_active) {
      throw new Error("This agreement version is no longer active. Please refresh.");
    }
    const { error } = await supabase
      .from("profiles")
      .update({
        is_onboarded: true,
        agreement_signed_at: new Date().toISOString(),
        agreement_version_id: data.agreement_id,
        signed_legal_name: data.legal_name,
      })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    // Membership becomes active once onboarding completes (guarded field → privileged write).
    {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("profiles")
        .update({ membership_status: "active", membership_since: new Date().toISOString() })
        .eq("id", userId)
        .eq("membership_status", "pending");
    }
    return { ok: true as const };
  });

export type OnboardingStatus = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  is_onboarded: boolean;
  has_profile_details: boolean;
  is_admin: boolean;
  needs_resign: boolean;
};

export const getMyOnboardingStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ status: OnboardingStatus }> => {
    const { supabase, userId, claims } = context as any;
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("full_name, is_onboarded, job_title, industry")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    let needs_resign = false;
    if (profile?.is_onboarded && !roleRow) {
      const { data: cur } = await supabase
        .from("agreement_versions")
        .select("id, requires_resign")
        .eq("doc_type", "membership_agreement")
        .eq("is_current", true)
        .maybeSingle();
      if (cur?.requires_resign) {
        const { data: sig } = await supabase
          .from("agreement_signatures")
          .select("id")
          .eq("user_id", userId)
          .eq("agreement_version_id", cur.id)
          .limit(1);
        needs_resign = !sig?.length;
      }
    }

    return {
      status: {
        needs_resign,
        user_id: userId,
        email: claims?.email ?? null,
        full_name: profile?.full_name ?? null,
        is_onboarded: !!profile?.is_onboarded,
        has_profile_details: !!(profile?.job_title && profile?.industry),
        is_admin: !!roleRow,
      },
    };
  });
