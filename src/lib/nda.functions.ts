import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SignFields = {
  signed_name: z.string().trim().min(2).max(200),
  signed_title: z.string().trim().max(200).optional().nullable(),
  signature_png: z.string().max(800_000),
  agreed: z.literal(true),
};

function missionRef(id: string) {
  return `M-${id.slice(0, 8).toUpperCase()}`;
}

/* ---------------- Mission NDA panel ---------------- */

export const getMissionNda = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ mission_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const s = await import("./nda.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const canManage = await s.canManageMissionNda(data.mission_id, userId);
    const isAdmin = await s.isAdminUser(userId);
    const { data: nda } = await supabaseAdmin.from("engagement_ndas").select("id").eq("mission_id", data.mission_id).maybeSingle();
    const { data: ver } = await supabaseAdmin.from("agreement_versions").select("id, version, status").eq("doc_type", "engagement_nda").eq("is_current", true).maybeSingle();
    if (!nda) return { nda: null, can_manage: canManage, current_version: ver ?? null, my_party_id: null, blocked: false };
    const b = await s.loadNdaBundle(nda.id);
    const mine = b.parties.find((p: any) => p.user_id === userId && p.status === "pending") ?? (isAdmin ? b.parties.find((p: any) => p.party_kind === "facilitator" && p.status === "pending") : null);
    const blocked = await s.ndaBlocksUser(data.mission_id, userId);
    return {
      nda: {
        id: b.nda.id,
        status: b.nda.status,
        executed_at: b.nda.executed_at,
        has_executed_pdf: !!b.nda.executed_pdf_path,
        version: b.version.version,
        version_status: b.version.status,
        schedule: b.nda.schedule as any,
        parties: b.parties.map((p: any) => ({
          id: p.id,
          party_kind: p.party_kind,
          name: p.name,
          company_name: p.company_name,
          country: p.country,
          status: p.status,
          signed_at: p.signed_at,
          has_pdf: !!p.pdf_path,
          is_me: p.user_id === userId,
          // Signing links and emails only for managers.
          email: canManage ? p.email : null,
          sign_token: canManage && p.status === "pending" && p.sign_token && new Date(p.token_expires_at) > new Date() ? p.sign_token : null,
          token_expired: canManage && p.status === "pending" && !!p.sign_token && new Date(p.token_expires_at) <= new Date(),
        })),
      },
      can_manage: canManage,
      current_version: ver ?? null,
      my_party_id: mine?.id ?? null,
      blocked,
    };
  });

export const getNdaPrefill = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ mission_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const s = await import("./nda.server");
    if (!(await s.canManageMissionNda(data.mission_id, userId))) throw new Error("Forbidden: only admins or the mission lead can create the NDA.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: m } = await supabaseAdmin.from("missions").select("id, title, mission_type, brief, project_brief, description, customer, country, client_id").eq("id", data.mission_id).single();
    const { data: me } = await supabaseAdmin
      .from("mission_experts")
      .select("executive:fractional_executives!mission_experts_executive_id_fkey(user_id, name)")
      .eq("mission_id", data.mission_id);
    const userIds = Array.from(new Set([...(me ?? []).map((r: any) => r.executive?.user_id).filter(Boolean), ...(m?.client_id ? [m.client_id] : [])]));
    const { data: profs } = userIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name, country, company_id, companies(legal_name)").in("id", userIds)
      : { data: [] as any[] };
    const pById = new Map((profs ?? []).map((p: any) => [p.id, p]));
    const parties: any[] = [];
    for (const r of (me ?? []) as any[]) {
      const uid = r.executive?.user_id;
      if (!uid || parties.some((p) => p.user_id === uid)) continue;
      const p: any = pById.get(uid);
      parties.push({ party_kind: "member", user_id: uid, name: p?.full_name ?? r.executive?.name ?? "Member", company_name: p?.companies?.legal_name ?? null, country: p?.country ?? null, email: null });
    }
    if (m?.client_id && !parties.some((p) => p.user_id === m.client_id)) {
      const p: any = pById.get(m.client_id);
      parties.push({ party_kind: "customer", user_id: m.client_id, name: p?.full_name ?? "Customer", company_name: p?.companies?.legal_name ?? m.customer ?? null, country: p?.country ?? m.country ?? null, email: null });
    } else if (m?.customer) {
      parties.push({ party_kind: "customer", user_id: null, name: "", company_name: m.customer, country: m.country ?? null, email: "" });
    }
    return {
      schedule: {
        mission_title: m!.title,
        reference: missionRef(m!.id),
        program: m?.mission_type ?? "",
        purpose: (m?.project_brief || m?.brief || m?.description || "").slice(0, 2000),
        confidentiality_period: "3 years after the engagement ends",
        special_terms: "",
      },
      parties,
    };
  });

const PartyInput = z.object({
  party_kind: z.enum(["member", "customer", "external"]),
  user_id: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(255).nullable().optional(),
  company_name: z.string().trim().max(200).nullable().optional(),
  country: z.string().trim().max(100).nullable().optional(),
});

export const createMissionNda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      mission_id: z.string().uuid(),
      schedule: z.object({
        mission_title: z.string().trim().min(1).max(300),
        reference: z.string().trim().max(60).nullable(),
        program: z.string().trim().max(200).nullable(),
        purpose: z.string().trim().max(2000).nullable(),
        confidentiality_period: z.string().trim().min(2).max(200),
        special_terms: z.string().trim().max(2000).nullable(),
      }),
      parties: z.array(PartyInput).min(1).max(30),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const s = await import("./nda.server");
    if (!(await s.canManageMissionNda(data.mission_id, userId))) throw new Error("Forbidden: only admins or the mission lead can create the NDA.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ver } = await supabaseAdmin.from("agreement_versions").select("id").eq("doc_type", "engagement_nda").eq("is_current", true).maybeSingle();
    if (!ver) throw new Error("No current Engagement NDA version is published.");
    for (const p of data.parties) if (!p.user_id && !p.email) throw new Error(`Please add an email for ${p.name}.`);

    const { data: nda, error } = await supabaseAdmin
      .from("engagement_ndas")
      .insert({ mission_id: data.mission_id, agreement_version_id: ver.id, schedule: data.schedule as any, created_by: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message.includes("duplicate") ? "This mission already has an NDA." : error.message);

    const userIds = data.parties.map((p) => p.user_id).filter(Boolean) as string[];
    const { data: profs } = userIds.length ? await supabaseAdmin.from("profiles").select("id, company_id").in("id", userIds) : { data: [] as any[] };
    const compById = new Map((profs ?? []).map((p: any) => [p.id, p.company_id]));
    const expires = new Date(Date.now() + s.TOKEN_DAYS * 86400_000).toISOString();
    const rows = [
      ...data.parties.map((p, i) => ({
        nda_id: nda.id,
        party_kind: p.party_kind,
        user_id: p.user_id ?? null,
        company_id: p.user_id ? compById.get(p.user_id) ?? null : null,
        name: p.name,
        email: p.email ?? null,
        company_name: p.company_name || null,
        country: p.country || null,
        sort_order: i,
        sign_token: p.user_id ? null : crypto.randomUUID(),
        token_expires_at: p.user_id ? null : expires,
      })),
      { nda_id: nda.id, party_kind: "facilitator", user_id: null, company_id: null, name: "BRQ Plus Sdn Bhd", email: null, company_name: "BRQ Plus Sdn Bhd (202601006582 (1668680-A))", country: "Malaysia", sort_order: 999, sign_token: null, token_expires_at: null },
    ];
    const { error: pErr } = await supabaseAdmin.from("engagement_nda_parties").insert(rows);
    if (pErr) {
      await supabaseAdmin.from("engagement_ndas").delete().eq("id", nda.id);
      throw new Error(pErr.message);
    }
    await s.ndaAudit("nda_created", userId, `${data.schedule.mission_title} · ${rows.length} parties · NDA ${nda.id}`);
    // No transactional email sender is configured: external signing links are shown on the mission page to copy and send.
    return { id: nda.id as string };
  });

export const renewNdaLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ party_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const s = await import("./nda.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p } = await supabaseAdmin.from("engagement_nda_parties").select("id, status, user_id, nda_id, engagement_ndas(mission_id)").eq("id", data.party_id).maybeSingle();
    if (!p) throw new Error("Party not found.");
    if (!(await s.canManageMissionNda((p as any).engagement_ndas.mission_id, userId))) throw new Error("Forbidden");
    if (p.status !== "pending" || p.user_id) throw new Error("This party does not use a signing link.");
    const token = crypto.randomUUID();
    await supabaseAdmin.from("engagement_nda_parties").update({ sign_token: token, token_expires_at: new Date(Date.now() + s.TOKEN_DAYS * 86400_000).toISOString() }).eq("id", p.id);
    await s.ndaAudit("nda_link_renewed", userId, `Party ${p.id}`);
    return { token };
  });

/* ---------------- Member signing ---------------- */

export const listMyPendingNdas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as any;
    const s = await import("./nda.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const isAdmin = await s.isAdminUser(userId);
    let q = supabaseAdmin.from("engagement_nda_parties").select("id, party_kind, company_name, engagement_ndas(mission_id, missions(title))").eq("status", "pending");
    q = isAdmin ? q.or(`user_id.eq.${userId},party_kind.eq.facilitator`) : q.eq("user_id", userId);
    const { data } = await q;
    return {
      items: (data ?? []).map((p: any) => ({
        party_id: p.id,
        mission_id: p.engagement_ndas?.mission_id,
        mission_title: p.engagement_ndas?.missions?.title ?? "Mission",
        as_facilitator: p.party_kind === "facilitator",
      })),
    };
  });

async function loadMemberParty(partyId: string, userId: string) {
  const s = await import("./nda.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: p } = await supabaseAdmin.from("engagement_nda_parties").select("*").eq("id", partyId).maybeSingle();
  if (!p) throw new Error("Signing request not found.");
  const ok = p.user_id === userId || (p.party_kind === "facilitator" && (await s.isAdminUser(userId)));
  if (!ok) throw new Error("Forbidden: this signing request is for someone else.");
  return p;
}

export const getMemberNdaSigning = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ party_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const p = await loadMemberParty(data.party_id, userId);
    const s = await import("./nda.server");
    const b = await s.loadNdaBundle(p.nda_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin.from("profiles").select("full_name, job_title").eq("id", userId).maybeSingle();
    const missionTitle = b.mission?.title ?? "this engagement";
    return {
      party_id: p.id,
      mission_id: b.nda.mission_id,
      status: p.status,
      heading: `${b.version.title} · Version ${b.version.version}`,
      body: b.body,
      is_draft: b.version.status === "draft",
      consent: s.ndaConsent(b.version.version, missionTitle, p.company_name ?? "myself"),
      profile_name: p.party_kind === "facilitator" ? null : prof?.full_name ?? p.name,
      job_title: prof?.job_title ?? null,
    };
  });

export const signNdaAsMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ party_id: z.string().uuid(), ...SignFields }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId, claims } = context as any;
    await loadMemberParty(data.party_id, userId);
    if (!data.signed_title?.trim()) throw new Error("Please enter your job title.");
    const s = await import("./nda.server");
    return s.signNdaParty({ partyId: data.party_id, signerUserId: userId, signerEmail: claims?.email ?? null, signed_name: data.signed_name, signed_title: data.signed_title.trim(), signature_png: data.signature_png });
  });

/* ---------------- External (token) signing — public ---------------- */

async function loadTokenParty(token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: p } = await supabaseAdmin.from("engagement_nda_parties").select("*").eq("sign_token", token).maybeSingle();
  if (!p || p.user_id) return { error: "This signing link is not valid." as const };
  if (p.status === "signed" || p.token_used_at) return { error: "This signing link has already been used." as const };
  if (!p.token_expires_at || new Date(p.token_expires_at) <= new Date()) return { error: "This signing link has expired. Please ask BRQ+ for a new one." as const };
  return { party: p };
}

export const getNdaByToken = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const r = await loadTokenParty(data.token);
    if ("error" in r) return { ok: false as const, error: r.error };
    const s = await import("./nda.server");
    const b = await s.loadNdaBundle(r.party.nda_id);
    return {
      ok: true as const,
      heading: `${b.version.title} · Version ${b.version.version}`,
      body: b.body,
      is_draft: b.version.status === "draft",
      consent: s.ndaConsent(b.version.version, b.mission?.title ?? "this engagement", r.party.company_name ?? "myself"),
      signer_name: r.party.name,
      mission_title: b.mission?.title ?? "",
    };
  });

export const signNdaByToken = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().uuid(), ...SignFields }).parse(d))
  .handler(async ({ data }) => {
    const r = await loadTokenParty(data.token);
    if ("error" in r) throw new Error(r.error);
    if (!data.signed_title?.trim()) throw new Error("Please enter your job title.");
    const s = await import("./nda.server");
    await s.signNdaParty({ partyId: r.party.id, signerUserId: null, signerEmail: r.party.email, signed_name: data.signed_name, signed_title: data.signed_title.trim(), signature_png: data.signature_png });
    return { ok: true as const };
  });
