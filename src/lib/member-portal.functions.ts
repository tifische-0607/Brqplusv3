import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DOSSIER_COLS =
  "id, full_name, job_title, organisation, country, city, sector, phone, linkedin_url, bio, expertise, languages, program_interests, years_experience, member_type, membership_status, membership_since, collective_status, company_id, company_role, avatar_url";

export const getMyDossier = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const { data: profile, error } = await supabase.from("profiles").select(DOSSIER_COLS).eq("id", userId).maybeSingle();
    if (error) throw new Error(error.message);
    let company: { id: string; legal_name: string; trading_name: string | null } | null = null;
    if (profile?.company_id) {
      const { data } = await supabase.from("companies").select("id, legal_name, trading_name").eq("id", profile.company_id).maybeSingle();
      company = data ?? null;
    }
    const fields = ["full_name", "job_title", "country", "sector", "phone", "linkedin_url", "bio", "city", "organisation"];
    const p: any = profile ?? {};
    const filled = fields.filter(f => p[f]).length + (p.expertise?.length ? 1 : 0) + (p.languages?.length ? 1 : 0) + (p.program_interests?.length ? 1 : 0);
    const completeness = Math.round((filled / (fields.length + 3)) * 100);
    return { profile: p, company, completeness };
  });

const DossierInput = z.object({
  full_name: z.string().trim().min(1).max(200),
  job_title: z.string().trim().max(200).default(""),
  organisation: z.string().trim().max(200).default(""),
  country: z.string().trim().max(100).default(""),
  city: z.string().trim().max(100).default(""),
  sector: z.string().trim().max(100).default(""),
  phone: z.string().trim().max(40).default(""),
  linkedin_url: z.string().trim().max(300).refine(v => !v || /^https:\/\/([a-z0-9-]+\.)*linkedin\.com\//i.test(v), "Enter a valid LinkedIn URL").default(""),
  bio: z.string().trim().max(1000).default(""),
  expertise: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  languages: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  program_interests: z.array(z.string().trim().min(1).max(60)).max(10).default([]),
  years_experience: z.number().int().min(0).max(70).nullable().default(null),
});

export const updateMyDossier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DossierInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const n = (v: string) => (v ? v : null);
    const { error } = await supabase.from("profiles").update({
      full_name: data.full_name, job_title: n(data.job_title), organisation: n(data.organisation), country: n(data.country),
      city: n(data.city), sector: n(data.sector), industry: n(data.sector), phone: n(data.phone), linkedin_url: n(data.linkedin_url),
      bio: n(data.bio), expertise: data.expertise, areas_of_expertise: data.expertise, languages: data.languages,
      program_interests: data.program_interests, years_experience: data.years_experience,
    }).eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ---------- Company (member side) ----------
async function myCompanyContext(supabase: any, userId: string) {
  const { data: me } = await supabase.from("company_members").select("company_id, role").eq("user_id", userId).maybeSingle();
  return me as { company_id: string; role: "admin" | "member" } | null;
}

export const getMyCompany = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const me = await myCompanyContext(supabase, userId);
    if (!me) return { company: null, members: [], my_role: null, logo_url: null };
    const { data: company } = await supabase.from("companies").select("*").eq("id", me.company_id).maybeSingle();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roster } = await supabaseAdmin.from("company_members")
      .select("user_id, role, joined_at, profiles:user_id(full_name, job_title, membership_status)").eq("company_id", me.company_id);
    let logo_url: string | null = null;
    if (company?.logo_path) logo_url = (await supabase.storage.from("company-logos").createSignedUrl(company.logo_path, 3600)).data?.signedUrl ?? null;
    return { company: company as any, members: (roster ?? []) as any[], my_role: me.role, logo_url };
  });

const CompanyInput = z.object({
  trading_name: z.string().trim().max(200).default(""),
  hq_city: z.string().trim().max(100).default(""),
  website: z.string().trim().max(300).refine(v => !v || /^https:\/\//i.test(v), "Website must start with https://").default(""),
  sector: z.string().trim().max(100).default(""),
  size_band: z.string().trim().max(40).default(""),
  description: z.string().trim().max(1500).default(""),
  markets: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  interests: z.array(z.string().trim().min(1).max(80)).max(10).default([]),
  billing_contact_name: z.string().trim().max(120).default(""),
  billing_contact_email: z.union([z.string().trim().email().max(255), z.literal("")]).default(""),
  logo_path: z.string().trim().max(300).optional(),
});

export const updateMyCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CompanyInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const me = await myCompanyContext(supabase, userId);
    if (!me || me.role !== "admin") throw new Error("Only the company admin can edit company details.");
    if (data.logo_path && !data.logo_path.startsWith(`${me.company_id}/`)) throw new Error("Invalid logo path");
    const n = (v: string) => (v ? v : null);
    const { error } = await supabase.from("companies").update({
      trading_name: n(data.trading_name), hq_city: n(data.hq_city), website: n(data.website), sector: n(data.sector),
      size_band: n(data.size_band), description: n(data.description), markets: data.markets, interests: data.interests,
      billing_contact_name: n(data.billing_contact_name), billing_contact_email: n(data.billing_contact_email),
      ...(data.logo_path ? { logo_path: data.logo_path } : {}),
    }).eq("id", me.company_id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const inviteColleague = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    email: z.string().trim().toLowerCase().email().max(254), full_name: z.string().trim().max(200).optional(), redirect_to: z.string().url().max(500),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const me = await myCompanyContext(supabase, userId);
    if (!me || me.role !== "admin") throw new Error("Only the company admin can invite colleagues.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: co } = await supabaseAdmin.from("companies").select("legal_name, trading_name, membership_status").eq("id", me.company_id).single();
    if (co?.membership_status !== "active") throw new Error("Your company membership is not active.");
    const { data: ms } = await supabaseAdmin.from("memberships").select("plan_id, membership_plans:plan_id(name, max_users)").eq("company_id", me.company_id).neq("status", "cancelled").order("created_at", { ascending: false }).limit(1).maybeSingle();
    const max = (ms as any)?.membership_plans?.max_users as number | null | undefined;
    if (max != null) {
      const { count } = await supabaseAdmin.from("company_members").select("id", { count: "exact", head: true }).eq("company_id", me.company_id);
      if ((count ?? 0) >= max) throw new Error(`SEAT_LIMIT: Your ${(ms as any).membership_plans.name} plan includes up to ${max} users. Upgrade your plan to invite more colleagues.`);
    }
    const { sendOnboardingInvite } = await import("./invite.server");
    const sent = await sendOnboardingInvite({ email: data.email, full_name: data.full_name ?? null, created_by: userId, redirect_to: data.redirect_to });
    if (!sent.user_id) throw new Error("Invite sent but no account id returned");
    await supabaseAdmin.from("profiles").upsert({
      id: sent.user_id, full_name: data.full_name || data.email, organisation: co?.trading_name || co?.legal_name,
      member_type: "personal", membership_status: "pending", company_id: me.company_id, company_role: "member",
    } as any);
    await supabaseAdmin.from("company_members").upsert({ company_id: me.company_id, user_id: sent.user_id, role: "member", invited_by: userId }, { onConflict: "company_id,user_id" });
    await supabaseAdmin.from("application_review_audit").insert({ action: "company_invite", actor_user_id: userId, subject_user_id: sent.user_id, subject_company_id: me.company_id, reason: data.email } as any);
    return { ok: true as const };
  });

export const removeColleague = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const me = await myCompanyContext(supabase, userId);
    if (!me || me.role !== "admin") throw new Error("Only the company admin can remove members.");
    if (data.user_id === userId) throw new Error("Transfer the admin role before leaving.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("company_members").delete().eq("company_id", me.company_id).eq("user_id", data.user_id);
    await supabaseAdmin.from("profiles").update({ company_id: null, company_role: null }).eq("id", data.user_id).eq("company_id", me.company_id);
    await supabaseAdmin.from("application_review_audit").insert({ action: "company_remove", actor_user_id: userId, subject_user_id: data.user_id, subject_company_id: me.company_id } as any);
    return { ok: true as const };
  });

export const transferCompanyAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const me = await myCompanyContext(supabase, userId);
    if (!me || me.role !== "admin") throw new Error("Only the company admin can transfer the admin role.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target } = await supabaseAdmin.from("company_members").select("user_id").eq("company_id", me.company_id).eq("user_id", data.user_id).maybeSingle();
    if (!target) throw new Error("That person is not a member of your company.");
    await supabaseAdmin.from("company_members").update({ role: "admin" }).eq("company_id", me.company_id).eq("user_id", data.user_id);
    await supabaseAdmin.from("company_members").update({ role: "member" }).eq("company_id", me.company_id).eq("user_id", userId);
    await supabaseAdmin.from("profiles").update({ company_role: "admin" }).eq("id", data.user_id);
    await supabaseAdmin.from("profiles").update({ company_role: "member" }).eq("id", userId);
    await supabaseAdmin.from("application_review_audit").insert({ action: "company_admin_transfer", actor_user_id: userId, subject_user_id: data.user_id, subject_company_id: me.company_id } as any);
    return { ok: true as const };
  });

// ---------- Directory (active members only, safe fields) ----------
export const listMemberDirectory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const [{ data: me }, { data: isAdmin }] = await Promise.all([
      supabase.from("profiles").select("membership_status").eq("id", userId).maybeSingle(),
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    ]);
    if (me?.membership_status !== "active" && isAdmin !== true) return { members: [], companies: [] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Directory is locked for, and hides, memberships awaiting payment or ended.
    const { data: unpaid } = await supabaseAdmin.from("memberships").select("user_id, company_id").in("status", ["awaiting_payment", "payment_overdue", "cancelled"]);
    const unpaidUsers = new Set((unpaid ?? []).map((u: any) => u.user_id).filter(Boolean));
    const unpaidCos = new Set((unpaid ?? []).map((u: any) => u.company_id).filter(Boolean));
    if (isAdmin !== true) {
      const { data: myCo } = await supabaseAdmin.from("company_members").select("company_id").eq("user_id", userId).maybeSingle();
      if (unpaidUsers.has(userId) || (myCo && unpaidCos.has(myCo.company_id))) return { members: [], companies: [], locked: true as const };
    }
    const [m, c] = await Promise.all([
      supabaseAdmin.from("profiles")
        .select("id, full_name, job_title, organisation, country, sector, expertise, member_type, collective_status, company_id, phone, linkedin_url, show_email, show_phone, show_linkedin, companies:company_id(legal_name, trading_name, membership_status)")
        .eq("membership_status", "active").eq("show_in_directory", true).order("full_name").limit(2000),
      supabaseAdmin.from("companies").select("id, legal_name, trading_name, sector, country, hq_city, website, description, markets")
        .eq("membership_status", "active").order("legal_name").limit(1000),
    ]);
    const rows = ((m.data ?? []) as any[]).filter((r) => !unpaidUsers.has(r.id) && !(r.company_id && unpaidCos.has(r.company_id)));
    const emails: Record<string, string> = {};
    await Promise.all(rows.filter((r) => r.show_email).slice(0, 200).map(async (r) => {
      const { data } = await supabaseAdmin.auth.admin.getUserById(r.id);
      if (data?.user?.email) emails[r.id] = data.user.email;
    }));
    const members = rows.map(({ phone, linkedin_url, show_email, show_phone, show_linkedin, ...r }) => ({
      ...r,
      email: show_email ? emails[r.id] ?? null : null,
      phone: show_phone ? phone : null,
      linkedin_url: show_linkedin ? linkedin_url : null,
    }));
    return { members, companies: ((c.data ?? []) as any[]).filter((co) => !unpaidCos.has(co.id)), locked: false as const };
  });
