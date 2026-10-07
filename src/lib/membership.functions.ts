import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { corporateSchema, personalSchema } from "./membership-options";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(`Authorization check failed: ${error.message}`);
  if (data !== true) throw new Error("Forbidden: admin role required");
}

async function rateLimited(email: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - 5 * 60_000).toISOString();
  const { count, error } = await supabaseAdmin.from("membership_applications")
    .select("id", { count: "exact", head: true }).eq("email", email).gte("created_at", since);
  if (error) throw new Error("Could not check submissions. Please try again.");
  if ((count ?? 0) >= 3) throw new Error("Too many submissions. Please wait five minutes.");
  return supabaseAdmin;
}
async function resolvePlan(admin: any, code: string, type: "personal" | "corporate", cycle: "monthly" | "annual") {
  const { data: plan } = await admin.from("membership_plans").select("*").eq("code", code).eq("member_type", type).eq("is_active", true).maybeSingle();
  if (!plan) throw new Error("Please choose a valid membership plan.");
  return { plan_id: plan.id as string, billing_cycle: cycle, quoted_price_myr: Number(cycle === "annual" ? plan.annual_price_myr : plan.monthly_price_myr), plan };
}
const ref = (p: string) => `${p}-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;

// ---------- Public submissions ----------
export const submitPersonalApplication = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => personalSchema.parse(d))
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase();
    const admin = await rateLimited(email);
    const reference = ref("PER");
    const { plan, ...pl } = await resolvePlan(admin, data.planCode, "personal", data.billingCycle);
    const { error } = await admin.from("membership_applications").insert({
      type: "personal", reference, email, source: data.source, payload: { ...data, email } as any, wants_collective: data.wantsCollective, ...pl,
    });
    if (error) throw new Error("Could not save your application. Please try again.");
    return { reference, plan_name: plan.name as string, billing_cycle: pl.billing_cycle, price: pl.quoted_price_myr };
  });

export const submitCorporateApplication = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => corporateSchema.parse(d))
  .handler(async ({ data }) => {
    const email = data.contactEmail.toLowerCase();
    const admin = await rateLimited(email);
    const reference = ref("CORP");
    const { plan, ...pl } = await resolvePlan(admin, data.planCode, "corporate", data.billingCycle);
    const { error } = await admin.from("membership_applications").insert({
      type: "corporate", reference, email, source: data.source, payload: { ...data, contactEmail: email } as any, ...pl,
    });
    if (error) throw new Error("Could not save your application. Please try again.");
    return { reference, plan_name: plan.name as string, billing_cycle: pl.billing_cycle, price: pl.quoted_price_myr };
  });

// ---------- Admin: applications ----------
export const listMembershipApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { data, error } = await supabase.from("membership_applications").select("*").order("created_at", { ascending: false }).limit(5000);
    if (error) throw new Error(error.message);
    return (data ?? []) as any[];
  });

async function audit(row: Record<string, unknown>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { actorEmail } = await import("./invite.server");
  const actor_email = row.actor_user_id ? await actorEmail(row.actor_user_id as string) : null;
  const { error } = await supabaseAdmin.from("application_review_audit").insert({ ...row, actor_email } as any);
  if (error) console.error("[membership audit]", error);
}

export const setMembershipApplicationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(), status: z.enum(["under_review", "rejected", "submitted", "withdrawn"]), note: z.string().trim().max(2000).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { error } = await supabase.from("membership_applications").update({
      status: data.status, reviewed_by: userId, reviewed_at: new Date().toISOString(),
      ...(data.note !== undefined ? { review_notes: data.note || null } : {}),
    }).eq("id", data.id).neq("status", "approved");
    if (error) throw new Error(error.message);
    await audit({ membership_application_id: data.id, action: data.status === "rejected" ? "reject" : data.status, actor_user_id: userId, reason: data.note ?? null });
    return { ok: true as const };
  });

export const approveMembershipApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(), redirect_to: z.string().url().max(500), as_collective: z.boolean().default(false), note: z.string().trim().max(2000).optional(),
    plan_id: z.string().uuid(), billing_cycle: z.enum(["monthly", "annual"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendOnboardingInvite } = await import("./invite.server");
    const { data: app, error } = await supabaseAdmin.from("membership_applications").select("*").eq("id", data.id).maybeSingle();
    if (error || !app) throw new Error("Application not found");
    if (app.status === "approved") throw new Error("Application already approved");
    const p = app.payload as any;
    const { data: chosenPlan } = await supabaseAdmin.from("membership_plans").select("*").eq("id", data.plan_id).maybeSingle();
    if (!chosenPlan || chosenPlan.member_type !== app.type) throw new Error("Choose a plan that matches the application type.");

    let newUserId: string | null = null;
    let companyId: string | null = null;

    if (app.type === "personal") {
      const sent = await sendOnboardingInvite({ email: app.email, full_name: p.fullName, created_by: userId, redirect_to: data.redirect_to });
      newUserId = sent.user_id;
      if (!newUserId) throw new Error("Invite sent but no account id returned");
      const asCollective = data.as_collective && app.wants_collective;
      await supabaseAdmin.from("profiles").upsert({
        id: newUserId, full_name: p.fullName, phone: p.phone || null, linkedin_url: p.linkedinUrl || null,
        country: p.country, city: p.city || null, job_title: p.roleTitle, organisation: p.organisation || null,
        sector: p.sector, industry: p.sector, expertise: p.expertise ?? [], areas_of_expertise: p.expertise ?? [],
        years_experience: p.yearsExperience === "" || p.yearsExperience == null ? null : Number(p.yearsExperience),
        languages: p.languages ?? [], program_interests: p.programInterests ?? [], bio: p.bio || null,
        member_type: "personal", membership_status: "pending",
        collective_status: asCollective ? "approved" : app.wants_collective ? "applied" : "none",
      } as any);
      if (asCollective) {
        const { data: ex } = await supabaseAdmin.from("fractional_executives").select("id").eq("user_id", newUserId).maybeSingle();
        const exec = {
          name: p.fullName, role: p.roleTitle, expertise: p.expertise ?? [], markets: p.markets ?? [],
          bio: p.mandate || p.bio || null, linkedin_url: p.linkedinUrl || null, email: app.email, user_id: newUserId,
        };
        if (ex) await supabaseAdmin.from("fractional_executives").update(exec).eq("id", ex.id);
        else await supabaseAdmin.from("fractional_executives").insert({ ...exec, availability: "not_deployed" } as any);
      }
    } else {
      const { data: co, error: coErr } = await supabaseAdmin.from("companies").insert({
        legal_name: p.legalName, trading_name: p.tradingName || null, registration_no: p.registrationNo, country: p.country,
        hq_city: p.hqCity || null, website: p.website || null, sector: p.sector, size_band: p.sizeBand || null,
        year_founded: p.yearFounded === "" || p.yearFounded == null ? null : Number(p.yearFounded), description: p.description,
        markets: p.markets ?? [], interests: p.interests ?? [], billing_contact_name: p.billingName || null,
        billing_contact_email: p.billingEmail || null, membership_status: "active", membership_since: new Date().toISOString(), application_id: app.id,
      }).select("id").single();
      if (coErr || !co) throw new Error(coErr?.message ?? "Could not create company");
      companyId = co.id;
      const sent = await sendOnboardingInvite({ email: app.email, full_name: p.contactName, created_by: userId, redirect_to: data.redirect_to });
      newUserId = sent.user_id;
      if (!newUserId) throw new Error("Invite sent but no account id returned");
      await supabaseAdmin.from("profiles").upsert({
        id: newUserId, full_name: p.contactName, job_title: p.contactTitle, phone: p.contactPhone || null,
        linkedin_url: p.contactLinkedin || null, organisation: p.tradingName || p.legalName, country: p.country, sector: p.sector,
        industry: p.sector, member_type: "personal", membership_status: "pending", company_id: companyId, company_role: "admin",
      } as any);
      await supabaseAdmin.from("company_members").upsert({ company_id: companyId, user_id: newUserId, role: "admin", invited_by: userId }, { onConflict: "company_id,user_id" });
    }

    await supabaseAdmin.from("membership_applications").update({
      status: "approved", reviewed_by: userId, reviewed_at: new Date().toISOString(), review_notes: data.note ?? app.review_notes,
      approved_user_id: newUserId, approved_company_id: companyId, approved_as_collective: app.type === "personal" && data.as_collective && app.wants_collective,
    }).eq("id", app.id);
    const price = Number(data.billing_cycle === "annual" ? chosenPlan.annual_price_myr : chosenPlan.monthly_price_myr);
    if (chosenPlan.id !== app.plan_id || data.billing_cycle !== app.billing_cycle) {
      await supabaseAdmin.from("membership_applications").update({ plan_id: chosenPlan.id, billing_cycle: data.billing_cycle, quoted_price_myr: price }).eq("id", app.id);
    }
    await audit({ membership_application_id: app.id, action: "approve", actor_user_id: userId, subject_user_id: newUserId, subject_company_id: companyId, reason: [`Plan ${chosenPlan.name} (${data.billing_cycle}, RM ${price})`, data.note].filter(Boolean).join(" · ") });
    const { createMembershipWithInvoice } = await import("./invoice.server");
    const { invoice } = await createMembershipWithInvoice({ user_id: app.type === "personal" ? newUserId : null, company_id: companyId, application_id: app.id, plan_id: chosenPlan.id, cycle: data.billing_cycle, actor: userId });
    return { ok: true as const, user_id: newUserId, company_id: companyId, invoice_number: invoice.number as string };
  });

// ---------- Admin: members & companies ----------
export const adminListMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { data, error } = await supabase.from("profiles")
      .select("id, full_name, job_title, organisation, country, city, sector, phone, linkedin_url, member_type, membership_status, membership_since, collective_status, company_id, company_role, is_onboarded, expertise, languages, program_interests, years_experience, created_at, companies:company_id(legal_name, trading_name)")
      .order("created_at", { ascending: false }).limit(5000);
    if (error) throw new Error(error.message);
    return (data ?? []) as any[];
  });

export const adminGetMemberDossier = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile, error } = await supabaseAdmin.from("profiles").select("*, companies:company_id(id, legal_name, trading_name)").eq("id", data.userId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!profile) return { notFound: true as const };
    const { data: au } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    const email = au?.user?.email?.toLowerCase() ?? null;
    const [apps, legacy, exec, notes, roles] = await Promise.all([
      email ? supabaseAdmin.from("membership_applications").select("*").eq("email", email).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
      email ? supabaseAdmin.from("collective_applications").select("id, reference, status, created_at, role_title").ilike("email", email) : Promise.resolve({ data: [] }),
      supabaseAdmin.from("fractional_executives").select("id, name, role, availability, markets").eq("user_id", data.userId).maybeSingle(),
      supabaseAdmin.from("member_notes").select("*").eq("subject_type", "user").eq("subject_id", data.userId).order("created_at", { ascending: false }),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", data.userId),
    ]);
    const appIds = ((apps as any).data ?? []).map((a: any) => a.id);
    let auditQ = supabaseAdmin.from("application_review_audit").select("*").order("created_at", { ascending: false }).limit(200);
    auditQ = appIds.length
      ? auditQ.or(`subject_user_id.eq.${data.userId},membership_application_id.in.(${appIds.join(",")})`)
      : auditQ.eq("subject_user_id", data.userId);
    const { data: auditRows } = await auditQ;
    return {
      notFound: false as const, profile: profile as any, email, last_sign_in_at: au?.user?.last_sign_in_at ?? null,
      applications: (apps as any).data ?? [], legacy_applications: (legacy as any).data ?? [], executive: (exec as any).data ?? null,
      notes: (notes as any).data ?? [], roles: ((roles as any).data ?? []).map((r: any) => r.role), audit: auditRows ?? [],
    };
  });

export const adminUpdateMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    userId: z.string().uuid(),
    membership_status: z.enum(["pending", "active", "suspended"]).optional(),
    collective_status: z.enum(["none", "applied", "approved"]).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = {};
    if (data.membership_status) {
      patch.membership_status = data.membership_status;
      if (data.membership_status === "active") {
        const { data: cur } = await supabaseAdmin.from("profiles").select("membership_since").eq("id", data.userId).maybeSingle();
        if (!cur?.membership_since) patch.membership_since = new Date().toISOString();
      }
    }
    if (data.collective_status) patch.collective_status = data.collective_status;
    const { data: prof, error } = await supabaseAdmin.from("profiles").update(patch as any).eq("id", data.userId).select("*").single();
    if (error) throw new Error(error.message);
    if (data.collective_status === "approved") {
      const { data: ex } = await supabaseAdmin.from("fractional_executives").select("id").eq("user_id", data.userId).maybeSingle();
      if (!ex) {
        const { data: au } = await supabaseAdmin.auth.admin.getUserById(data.userId);
        await supabaseAdmin.from("fractional_executives").insert({
          name: prof.full_name ?? au?.user?.email ?? "Member", role: prof.job_title ?? "Member", expertise: prof.expertise ?? [],
          bio: prof.bio, linkedin_url: prof.linkedin_url, email: au?.user?.email ?? null, user_id: data.userId, availability: "not_deployed",
        } as any);
      }
    }
    await audit({ action: `member_update:${Object.keys(patch).join(",")}`, actor_user_id: userId, subject_user_id: data.userId, reason: JSON.stringify(patch) });
    return { ok: true as const };
  });

export const adminListCompanies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { data, error } = await supabase.from("companies").select("*, company_members(count)").order("created_at", { ascending: false }).limit(5000);
    if (error) throw new Error(error.message);
    return (data ?? []) as any[];
  });

export const adminGetCompanyDossier = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ companyId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: company } = await supabaseAdmin.from("companies").select("*").eq("id", data.companyId).maybeSingle();
    if (!company) return { notFound: true as const };
    const [members, apps, notes, auditRows] = await Promise.all([
      supabaseAdmin.from("company_members").select("user_id, role, joined_at, profiles:user_id(full_name, job_title, membership_status)").eq("company_id", data.companyId),
      supabaseAdmin.from("membership_applications").select("*").or(`approved_company_id.eq.${data.companyId}${company.application_id ? `,id.eq.${company.application_id}` : ""}`),
      supabaseAdmin.from("member_notes").select("*").eq("subject_type", "company").eq("subject_id", data.companyId).order("created_at", { ascending: false }),
      supabaseAdmin.from("application_review_audit").select("*").eq("subject_company_id", data.companyId).order("created_at", { ascending: false }).limit(200),
    ]);
    let logo_url: string | null = null;
    if (company.logo_path) logo_url = (await supabaseAdmin.storage.from("company-logos").createSignedUrl(company.logo_path, 3600)).data?.signedUrl ?? null;
    return { notFound: false as const, company: company as any, logo_url, members: (members.data ?? []) as any[], applications: apps.data ?? [], notes: notes.data ?? [], audit: auditRows.data ?? [] };
  });

export const adminSetCompanyStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ companyId: z.string().uuid(), status: z.enum(["pending", "active", "suspended"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { error } = await supabase.from("companies").update({ membership_status: data.status }).eq("id", data.companyId);
    if (error) throw new Error(error.message);
    await audit({ action: `company_status:${data.status}`, actor_user_id: userId, subject_company_id: data.companyId });
    return { ok: true as const };
  });

export const addMemberNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ subject_type: z.enum(["user", "company"]), subject_id: z.string().uuid(), note: z.string().trim().min(1).max(4000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { error } = await supabase.from("member_notes").insert({ ...data, author_id: userId });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const getMembershipKpis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const c = async (t: string, f: (q: any) => any) => {
      const { count, error } = await f(supabase.from(t).select("id", { count: "exact", head: true }));
      if (error) throw new Error(error.message);
      return count ?? 0;
    };
    const [pp, pc, ap, ac] = await Promise.all([
      c("membership_applications", q => q.eq("type", "personal").in("status", ["submitted", "under_review"])),
      c("membership_applications", q => q.eq("type", "corporate").in("status", ["submitted", "under_review"])),
      c("profiles", q => q.eq("membership_status", "active")),
      c("companies", q => q.eq("membership_status", "active")),
    ]);
    return { pending_personal: pp, pending_corporate: pc, active_personal: ap, active_companies: ac };
  });

// ---------- Admin: create companies & member profiles directly ----------
export const adminCreateCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    legal_name: z.string().trim().min(2).max(200), trading_name: z.string().trim().max(200).optional(),
    registration_no: z.string().trim().max(100).optional(), country: z.string().trim().max(100).optional(),
    hq_city: z.string().trim().max(100).optional(), website: z.string().trim().max(300).optional(),
    sector: z.string().trim().max(100).optional(), description: z.string().trim().max(3000).optional(),
    billing_contact_name: z.string().trim().max(200).optional(), billing_contact_email: z.string().trim().email().max(255).optional().or(z.literal("")),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const blank = (v?: string) => (v ? v : null);
    const { data: co, error } = await supabaseAdmin.from("companies").insert({
      legal_name: data.legal_name, trading_name: blank(data.trading_name), registration_no: blank(data.registration_no),
      country: blank(data.country), hq_city: blank(data.hq_city), website: blank(data.website), sector: blank(data.sector),
      description: blank(data.description), billing_contact_name: blank(data.billing_contact_name), billing_contact_email: blank(data.billing_contact_email),
      membership_status: "active", membership_since: new Date().toISOString(),
    } as any).select("id").single();
    if (error || !co) throw new Error(error?.message ?? "Could not create company");
    await audit({ action: "admin_created_company", actor_user_id: userId, subject_company_id: co.id, reason: data.legal_name });
    return { id: co.id as string };
  });

export const adminCreateMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    email: z.string().trim().email().max(255), full_name: z.string().trim().min(2).max(200),
    job_title: z.string().trim().max(200).optional(), phone: z.string().trim().max(50).optional(),
    country: z.string().trim().max(100).optional(), sector: z.string().trim().max(100).optional(),
    linkedin_url: z.string().trim().max(300).optional(),
    company_id: z.string().uuid().optional(), company_role: z.enum(["admin", "member"]).default("member"),
    redirect_to: z.string().url().max(500),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendOnboardingInvite } = await import("./invite.server");
    let org: string | null = null;
    if (data.company_id) {
      const { data: co } = await supabaseAdmin.from("companies").select("legal_name, trading_name").eq("id", data.company_id).maybeSingle();
      if (!co) throw new Error("Company not found");
      org = co.trading_name || co.legal_name;
    }
    const sent = await sendOnboardingInvite({ email: data.email, full_name: data.full_name, created_by: userId, redirect_to: data.redirect_to });
    const newId = sent.user_id;
    if (!newId) throw new Error("Invite sent but no account id returned");
    const blank = (v?: string) => (v ? v : null);
    const { error } = await supabaseAdmin.from("profiles").upsert({
      id: newId, full_name: data.full_name, job_title: blank(data.job_title), phone: blank(data.phone), country: blank(data.country),
      sector: blank(data.sector), industry: blank(data.sector), linkedin_url: blank(data.linkedin_url), organisation: org,
      member_type: "personal", membership_status: "active", membership_since: new Date().toISOString(),
      company_id: data.company_id ?? null, company_role: data.company_id ? data.company_role : null,
    } as any);
    if (error) throw new Error(error.message);
    if (data.company_id) {
      await supabaseAdmin.from("company_members").upsert({ company_id: data.company_id, user_id: newId, role: data.company_role, invited_by: userId }, { onConflict: "company_id,user_id" });
    }
    await audit({ action: "admin_created_member", actor_user_id: userId, subject_user_id: newId, subject_company_id: data.company_id ?? null, reason: data.email });
    return { user_id: newId };
  });
