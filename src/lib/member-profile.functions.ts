import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function viewer(supabase: any, userId: string) {
  const [{ data: me }, { data: isAdmin }] = await Promise.all([
    supabase.from("profiles").select("membership_status").eq("id", userId).maybeSingle(),
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
  ]);
  return { isAdmin: isAdmin === true, allowed: isAdmin === true || me?.membership_status === "active" };
}

async function sign(sb: any, bucket: string, path: string | null) {
  if (!path) return null;
  const { data } = await sb.storage.from(bucket).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

const Id = z.object({ id: z.string().uuid() });

export const getMemberProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Id.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const v = await viewer(supabase, userId);
    if (!v.allowed) return { available: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, job_title, organisation, bio, expertise, sector, markets, languages, years_experience, country, city, member_type, membership_status, collective_status, company_id, phone, linkedin_url, avatar_path, avatar_url, show_in_directory, show_email, show_phone, show_linkedin, companies:company_id(id, legal_name, trading_name, sector, country, membership_status)")
      .eq("id", data.id)
      .maybeSingle();
    const self = data.id === userId;
    if (!p || (!v.isAdmin && !self && (p.membership_status !== "active" || !p.show_in_directory))) {
      return { available: false as const };
    }
    const all = v.isAdmin || self;
    let email: string | null = null;
    if (all || p.show_email) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(p.id);
      email = u?.user?.email ?? null;
    }
    const { data: exec } = p.collective_status === "approved"
      ? await supabaseAdmin.from("fractional_executives").select("id, name, role, expertise, markets, availability, bio, linkedin_url").eq("user_id", p.id).maybeSingle()
      : { data: null };
    const avatar = (await sign(supabaseAdmin, "executive-avatars", p.avatar_path)) ?? p.avatar_url ?? null;
    const { avatar_path, phone, linkedin_url, show_email, show_phone, show_linkedin, ...rest } = p as any;
    return {
      available: true as const,
      isSelf: self,
      isAdmin: v.isAdmin,
      profile: {
        ...rest,
        avatar_url: avatar,
        email,
        phone: all || show_phone ? phone : null,
        linkedin_url: all || show_linkedin ? linkedin_url : null,
      },
      executive: exec,
    };
  });

export const getExecutiveProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Id.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const v = await viewer(supabase, userId);
    if (!v.allowed) return { available: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: e } = await supabaseAdmin
      .from("fractional_executives")
      .select("id, name, role, expertise, markets, availability, bio, linkedin_url, avatar_path, user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!e) return { available: false as const };
    if (e.user_id) return { available: true as const, redirectTo: e.user_id as string };
    return {
      available: true as const,
      executive: { ...e, avatar_url: await sign(supabaseAdmin, "executive-avatars", e.avatar_path) },
    };
  });

export const getDirectoryCompany = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Id.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const v = await viewer(supabase, userId);
    if (!v.allowed) return { available: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: c } = await supabaseAdmin
      .from("companies")
      .select("id, legal_name, trading_name, sector, country, hq_city, website, description, markets, logo_path, membership_status")
      .eq("id", data.id)
      .maybeSingle();
    if (!c || (!v.isAdmin && c.membership_status !== "active")) return { available: false as const };
    let q = supabaseAdmin.from("profiles").select("id, full_name, job_title").eq("company_id", c.id);
    if (!v.isAdmin) q = q.eq("membership_status", "active").eq("show_in_directory", true);
    const { data: members } = await q.order("full_name");
    const { logo_path, ...rest } = c as any;
    return {
      available: true as const,
      company: { ...rest, logo_url: await sign(supabaseAdmin, "company-logos", logo_path) },
      members: members ?? [],
    };
  });
