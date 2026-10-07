// Member portal read models (personal + corporate) and account/privacy actions.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
}

async function signAvatar(sb: any, path: string | null | undefined) {
  if (!path) return null;
  const { data } = await sb.storage.from("executive-avatars").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

async function companyCtx(sb: any, userId: string) {
  const { data } = await sb.from("company_members").select("company_id, role").eq("user_id", userId).maybeSingle();
  return data as { company_id: string; role: "admin" | "member" } | null;
}

/** Missions the user is on (member, expert, or client). */
async function myMissionIds(sb: any, userId: string): Promise<Record<string, string>> {
  const roles: Record<string, string> = {};
  const [{ data: mm }, { data: ex }, { data: cl }] = await Promise.all([
    sb.from("mission_members").select("mission_id, role").eq("user_id", userId),
    sb.from("fractional_executives").select("id").eq("user_id", userId),
    sb.from("missions").select("id").eq("client_id", userId),
  ]);
  for (const r of mm ?? []) roles[r.mission_id] = r.role ?? "Member";
  const execIds = (ex ?? []).map((e: any) => e.id);
  if (execIds.length) {
    const { data: me } = await sb.from("mission_experts").select("mission_id, role_in_mandate").in("executive_id", execIds);
    for (const r of me ?? []) roles[r.mission_id] = r.role_in_mandate || "Expert";
  }
  for (const r of cl ?? []) roles[r.id] = "Client";
  return roles;
}

async function missionRows(sb: any, roleMap: Record<string, string>) {
  const ids = Object.keys(roleMap);
  if (!ids.length) return [];
  const [{ data: ms }, { data: miles }, { data: ndas }] = await Promise.all([
    sb.from("missions").select("id, title, status, mission_type, customer, created_at, est_timeline_start, est_timeline_end, lead_executive:fractional_executives!missions_lead_executive_id_fkey(name)").in("id", ids),
    sb.from("mission_milestones").select("mission_id, title, target_date, status").in("mission_id", ids).is("completed_at", null).order("target_date"),
    sb.from("engagement_ndas").select("mission_id, status").in("mission_id", ids),
  ]);
  return (ms ?? []).map((m: any) => ({
    id: m.id as string,
    title: m.title as string,
    status: (m.status ?? "not_started") as string,
    mission_type: m.mission_type as string | null,
    customer: m.customer as string | null,
    role: roleMap[m.id],
    lead: m.lead_executive?.name ?? null,
    start: m.est_timeline_start ?? m.created_at,
    end: m.est_timeline_end ?? null,
    next_milestone: (miles ?? []).find((x: any) => x.mission_id === m.id) ?? null,
    nda_status: ((ndas ?? []).find((n: any) => n.mission_id === m.id)?.status ?? null) as string | null,
  }));
}

export type PortalContext = {
  user_id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  company: { id: string; name: string; role: "admin" | "member" } | null;
  pending_count: number;
  pending_applications: number;
};

export const getPortalContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PortalContext> => {
    const { supabase, userId, claims } = context as any;
    const sb = await admin();
    const [{ data: p }, { data: isAdmin }, cm, { count }] = await Promise.all([
      supabase.from("profiles").select("full_name, avatar_path").eq("id", userId).maybeSingle(),
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
      companyCtx(sb, userId),
      sb.from("engagement_nda_parties").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "pending"),
    ]);
    let company: PortalContext["company"] = null;
    if (cm) {
      const { data: co } = await sb.from("companies").select("legal_name, trading_name").eq("id", cm.company_id).maybeSingle();
      company = { id: cm.company_id, name: co?.trading_name || co?.legal_name || "Company", role: cm.role };
    }
    let pending_applications = 0;
    if (isAdmin === true) {
      const { count: pa } = await sb.from("membership_applications").select("id", { count: "exact", head: true }).in("status", ["submitted", "under_review"]);
      pending_applications = pa ?? 0;
    }
    return {
      pending_applications,
      user_id: userId,
      email: String(claims?.email ?? ""),
      full_name: p?.full_name ?? null,
      avatar_url: await signAvatar(sb, p?.avatar_path),
      is_admin: isAdmin === true,
      company,
      pending_count: count ?? 0,
    };
  });

export const getMyEngagements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as any;
    const sb = await admin();
    return { engagements: await missionRows(sb, await myMissionIds(sb, userId)) };
  });

export const getMyProfileFull = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const { data: p, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (error) throw new Error(error.message);
    const sb = await admin();
    const prof: any = p ?? {};
    const checklist = [
      { key: "photo", label: "Add a profile photo", done: !!prof.avatar_path },
      { key: "bio", label: "Write a short bio", done: !!prof.bio },
      { key: "expertise", label: "Choose your areas of expertise", done: (prof.expertise ?? []).length > 0 },
      { key: "markets", label: "Add the markets you cover", done: (prof.markets ?? []).length > 0 },
      { key: "linkedin", label: "Link your LinkedIn profile", done: !!prof.linkedin_url },
      { key: "availability", label: "Set your availability", done: prof.availability_hours != null },
    ];
    const completeness = Math.round((checklist.filter((c) => c.done).length / checklist.length) * 100);
    let company: any = null;
    if (prof.company_id) {
      const { data } = await sb.from("companies").select("id, legal_name, trading_name").eq("id", prof.company_id).maybeSingle();
      company = data ?? null;
    }
    return { profile: prof, avatar_url: await signAvatar(sb, prof.avatar_path), checklist, completeness, company };
  });

const ProfileInput = z.object({
  full_name: z.string().trim().min(1).max(200),
  job_title: z.string().trim().max(200).default(""),
  organisation: z.string().trim().max(200).default(""),
  country: z.string().trim().max(100).default(""),
  city: z.string().trim().max(100).default(""),
  sector: z.string().trim().max(100).default(""),
  phone: z.string().trim().max(40).default(""),
  linkedin_url: z.string().trim().max(300).refine((v) => !v || /^https:\/\/([a-z0-9-]+\.)*linkedin\.com\//i.test(v), "Enter a valid LinkedIn URL").default(""),
  bio: z.string().trim().max(1000).default(""),
  expertise: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  languages: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  markets: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  program_interests: z.array(z.string().trim().min(1).max(60)).max(10).default([]),
  years_experience: z.number().int().min(0).max(70).nullable().default(null),
  availability_hours: z.number().int().min(0).max(200).nullable().default(null),
});

export const updateMyProfileFull = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ProfileInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const n = (v: string) => (v ? v : null);
    const { error } = await supabase.from("profiles").update({
      full_name: data.full_name, job_title: n(data.job_title), organisation: n(data.organisation), country: n(data.country),
      city: n(data.city), sector: n(data.sector), industry: n(data.sector), phone: n(data.phone), linkedin_url: n(data.linkedin_url),
      bio: n(data.bio), expertise: data.expertise, areas_of_expertise: data.expertise, languages: data.languages, markets: data.markets,
      program_interests: data.program_interests, years_experience: data.years_experience, availability_hours: data.availability_hours,
    }).eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const setMyAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ path: z.string().max(300).nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    if (data.path && !data.path.startsWith(`members/${userId}/`)) throw new Error("Invalid photo path");
    const { error } = await supabase.from("profiles").update({ avatar_path: data.path }).eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

const PrefsInput = z.object({
  show_in_directory: z.boolean().optional(),
  show_email: z.boolean().optional(),
  show_phone: z.boolean().optional(),
  show_linkedin: z.boolean().optional(),
  notify_program_updates: z.boolean().optional(),
  notify_newsletter: z.boolean().optional(),
});

export const updateMyPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PrefsInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { error } = await supabase.from("profiles").update(data).eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

async function programsFor(sb: any, emails: string[]) {
  if (!emails.length) return { collective: [], founders: [], tgn: [], rsvps: [] };
  const [c, f, t, r] = await Promise.all([
    sb.from("collective_applications").select("reference, status, created_at, primary_domain").in("email", emails).order("created_at", { ascending: false }),
    sb.from("founder_applications").select("reference, company_name, stage, created_at").in("email", emails).order("created_at", { ascending: false }),
    sb.from("tgn_interests").select("reference, models, hours_available, created_at, email").in("email", emails).order("created_at", { ascending: false }),
    sb.from("tgn_rsvps").select("attending_as, organisation, created_at, email").in("email", emails).order("created_at", { ascending: false }),
  ]);
  return { collective: c.data ?? [], founders: f.data ?? [], tgn: t.data ?? [], rsvps: r.data ?? [] };
}

export const getMyPrograms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context as any;
    const email = String(claims?.email ?? "").toLowerCase();
    const sb = await admin();
    const { data: p } = await supabase.from("profiles").select("collective_status").eq("id", userId).maybeSingle();
    return { collective_status: (p?.collective_status ?? "none") as string, ...(await programsFor(sb, email ? [email] : [])) };
  });

/* ---------------- Corporate ---------------- */

async function requireCompany(context: any) {
  const { userId } = context;
  const sb = await admin();
  const me = await companyCtx(sb, userId);
  if (!me) throw new Error("You are not linked to a company on BRQ+.");
  return { sb, me, userId };
}

async function memberEmails(sb: any, ids: string[]) {
  const out: Record<string, string> = {};
  await Promise.all(ids.map(async (id) => {
    const { data } = await sb.auth.admin.getUserById(id);
    if (data?.user?.email) out[id] = data.user.email.toLowerCase();
  }));
  return out;
}

export const getCompanyHome = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { sb, me } = await requireCompany(context);
    const cid = me.company_id;
    const [{ data: company }, { data: roster }, { data: parties }, { data: activity }] = await Promise.all([
      sb.from("companies").select("*").eq("id", cid).maybeSingle(),
      sb.from("company_members").select("user_id, role, profiles:user_id(full_name, job_title)").eq("company_id", cid),
      sb.from("engagement_nda_parties").select("id, status, nda_id, engagement_ndas(status, mission_id, missions(title))").eq("company_id", cid),
      sb.from("application_review_audit").select("action, created_at, reason").eq("subject_company_id", cid).order("created_at", { ascending: false }).limit(8),
    ]);
    const ids = (roster ?? []).map((r: any) => r.user_id);
    const engagements = await companyMissions(sb, ids);
    const logo_url = company?.logo_path ? (await sb.storage.from("company-logos").createSignedUrl(company.logo_path, 3600)).data?.signedUrl ?? null : null;
    const pending = (parties ?? []).filter((p: any) => p.status === "pending").map((p: any) => ({ party_id: p.id, mission_title: p.engagement_ndas?.missions?.title ?? "Mission" }));
    return {
      company: company as any,
      logo_url,
      my_role: me.role,
      contacts: (roster ?? []).filter((r: any) => r.role === "admin").map((r: any) => ({ name: r.profiles?.full_name, title: r.profiles?.job_title })),
      stats: {
        team: ids.length,
        active_engagements: engagements.filter((e: any) => e.status === "active").length,
        ndas_executed: new Set((parties ?? []).filter((p: any) => p.engagement_ndas?.status === "executed").map((p: any) => p.nda_id)).size,
        programs: (company?.interests ?? []).length,
      },
      pending,
      activity: (activity ?? []) as any[],
    };
  });

async function companyMissions(sb: any, memberIds: string[]) {
  if (!memberIds.length) return [];
  const { data } = await sb.from("missions").select("id").in("client_id", memberIds);
  const roles: Record<string, string> = {};
  for (const m of data ?? []) roles[m.id] = "Customer";
  return missionRows(sb, roles);
}

export const getCompanyEngagements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { sb, me } = await requireCompany(context);
    const { data: roster } = await sb.from("company_members").select("user_id").eq("company_id", me.company_id);
    return { engagements: await companyMissions(sb, (roster ?? []).map((r: any) => r.user_id)) };
  });

export const getCompanyPrograms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { sb, me } = await requireCompany(context);
    const [{ data: company }, { data: roster }] = await Promise.all([
      sb.from("companies").select("interests").eq("id", me.company_id).maybeSingle(),
      sb.from("company_members").select("user_id").eq("company_id", me.company_id),
    ]);
    const emails = Object.values(await memberEmails(sb, (roster ?? []).map((r: any) => r.user_id)));
    const p = await programsFor(sb, emails);
    return { interests: (company?.interests ?? []) as string[], tgn: p.tgn, rsvps: p.rsvps, founders: p.founders };
  });

export const getCompanyTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { sb, me } = await requireCompany(context);
    if (me.role !== "admin") throw new Error("Only the Company Admin can manage the team.");
    const { data: roster } = await sb.from("company_members")
      .select("user_id, role, joined_at, profiles:user_id(full_name, job_title, membership_status, agreement_signed_at)").eq("company_id", me.company_id);
    const ids = (roster ?? []).map((r: any) => r.user_id);
    const emails = await memberEmails(sb, ids);
    const { data: sigs } = ids.length ? await sb.from("agreement_signatures").select("user_id, signed_at").in("user_id", ids) : { data: [] };
    return {
      members: (roster ?? []).map((r: any) => ({
        user_id: r.user_id, role: r.role, joined_at: r.joined_at, email: emails[r.user_id] ?? null,
        full_name: r.profiles?.full_name ?? null, job_title: r.profiles?.job_title ?? null,
        membership_status: r.profiles?.membership_status ?? "pending",
        agreement_signed: (sigs ?? []).some((s: any) => s.user_id === r.user_id),
      })),
    };
  });

export const resendColleagueInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid(), redirect_to: z.string().url().max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { sb, me, userId } = await requireCompany(context);
    if (me.role !== "admin") throw new Error("Only the Company Admin can resend invitations.");
    const { data: target } = await sb.from("company_members").select("user_id").eq("company_id", me.company_id).eq("user_id", data.user_id).maybeSingle();
    if (!target) throw new Error("That person is not in your company.");
    const { data: u } = await sb.auth.admin.getUserById(data.user_id);
    const email = u?.user?.email;
    if (!email) throw new Error("No email on record for this person.");
    const { validateRedirectTo } = await import("./invite.server");
    validateRedirectTo(data.redirect_to);
    const { data: inv, error } = await sb.from("onboarding_invites").insert({ email: email.toLowerCase(), created_by: userId }).select("token").single();
    if (error || !inv) throw new Error(error?.message ?? "Could not create invite");
    const url = new URL(data.redirect_to);
    url.searchParams.set("token", inv.token);
    const { error: mErr } = await sb.auth.admin.inviteUserByEmail(email, { redirectTo: url.toString() });
    // Already-registered users can't be re-invited by email; return the link so the admin can share it.
    await sb.from("application_review_audit").insert({ action: "company_invite_resend", actor_user_id: userId, subject_user_id: data.user_id, subject_company_id: me.company_id, reason: email });
    return { ok: true as const, emailed: !mErr, link: url.toString() };
  });

/* ---------------- Account & privacy ---------------- */

const ACCOUNT_ACTIONS = ["password_changed", "password_set", "email_change_requested", "signed_out_other_sessions", "password_reset_requested"] as const;

export const logAccountEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ action: z.enum(ACCOUNT_ACTIONS), detail: z.string().max(200).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const { getRequest } = await import("@tanstack/react-start/server");
    const req = getRequest();
    const sb = await admin();
    await sb.from("account_audit").insert({
      user_id: userId, action: data.action, detail: data.detail ?? null,
      ip_address: req?.headers.get("cf-connecting-ip") ?? req?.headers.get("x-forwarded-for")?.split(",")[0] ?? null,
      user_agent: req?.headers.get("user-agent")?.slice(0, 400) ?? null,
    });
    return { ok: true as const };
  });

export const getMyAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const [{ data: p }, { data: audit }, { data: del }] = await Promise.all([
      supabase.from("profiles").select("notify_program_updates, notify_newsletter").eq("id", userId).maybeSingle(),
      supabase.from("account_audit").select("action, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
      supabase.from("account_deletion_requests").select("status, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(1),
    ]);
    return { prefs: p ?? { notify_program_updates: false, notify_newsletter: false }, audit: audit ?? [], deletion: del?.[0] ?? null };
  });

export const requestAccountDeletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ reason: z.string().trim().max(1000).default("") }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId, claims } = context as any;
    const sb = await admin();
    const { data: open } = await sb.from("account_deletion_requests").select("id").eq("user_id", userId).in("status", ["pending", "in_progress"]).maybeSingle();
    if (open) return { ok: true as const, already: true };
    await sb.from("account_deletion_requests").insert({ user_id: userId, email: claims?.email ?? null, reason: data.reason || null });
    await sb.from("account_audit").insert({ user_id: userId, action: "deletion_requested" });
    await sb.from("application_review_audit").insert({ action: "account_deletion_requested", actor_user_id: userId, subject_user_id: userId, reason: data.reason || null });
    return { ok: true as const, already: false };
  });

export const exportMyData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context as any;
    const email = String(claims?.email ?? "").toLowerCase();
    const sb = await admin();
    const [{ data: profile }, { data: apps }, { data: sigs }, { data: ndas }, programs] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      sb.from("membership_applications").select("type, status, reference, created_at, payload, source").eq("email", email),
      sb.from("agreement_signatures").select("signer_type, signed_name, signed_title, signed_at, agreement_status_at_signing, agreement_versions(version, title, doc_type)").eq("user_id", userId),
      sb.from("engagement_nda_parties").select("name, status, signed_at, signed_name, engagement_ndas(missions(title))").eq("user_id", userId),
      programsFor(sb, email ? [email] : []),
    ]);
    return {
      exported_at: new Date().toISOString(),
      account: { id: userId, email },
      profile,
      membership_applications: apps ?? [],
      program_submissions: programs,
      documents: { membership_agreements: sigs ?? [], engagement_ndas: ndas ?? [] },
    };
  });
