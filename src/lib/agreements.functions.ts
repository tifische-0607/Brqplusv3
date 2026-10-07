import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type SignerType = "personal" | "company_admin" | "company_user";
export type AgreementVersion = Database["public"]["Tables"]["agreement_versions"]["Row"];
export type AgreementSignature = Database["public"]["Tables"]["agreement_signatures"]["Row"];

const BUCKET = "legal-agreements";

async function isAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  return data === true;
}
async function assertAdmin(supabase: any, userId: string) {
  if (!(await isAdmin(supabase, userId))) throw new Error("Forbidden: admin role required");
}

async function audit(row: { action: string; actor_user_id: string | null; subject_user_id?: string | null; subject_company_id?: string | null; reason?: string | null }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { actorEmail } = await import("./invite.server");
  const actor_email = row.actor_user_id ? await actorEmail(row.actor_user_id) : null;
  const { error } = await supabaseAdmin.from("application_review_audit").insert({ ...row, actor_email } as any);
  if (error) console.error("[agreements] audit insert failed", error);
}

/* ---------------- Public ---------------- */

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

async function publicCurrent(docType: "membership_agreement" | "privacy_notice" | "terms_of_service") {
  const { data, error } = await publicClient()
    .from("agreement_versions")
    .select("id, version, title, body_markdown, effective_date, status")
    .eq("doc_type", docType)
    .eq("is_current", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { agreement: data };
}

export const getPublicCurrentAgreement = createServerFn({ method: "GET" }).handler(() => publicCurrent("membership_agreement"));

export const getPublicPrivacyNotice = createServerFn({ method: "GET" }).handler(() => publicCurrent("privacy_notice"));

export const getPublicTermsOfService = createServerFn({ method: "GET" }).handler(() => publicCurrent("terms_of_service"));

/* ---------------- Signer ---------------- */

async function loadSignerContext(supabase: any, userId: string) {
  const [{ data: version }, { data: profile }] = await Promise.all([
    supabase.from("agreement_versions").select("*").eq("doc_type", "membership_agreement").eq("is_current", true).maybeSingle(),
    supabase.from("profiles").select("full_name, job_title, company_id, company_role, is_onboarded").eq("id", userId).maybeSingle(),
  ]);
  let company_name: string | null = null;
  if (profile?.company_id) {
    const { data: c } = await supabase.from("companies").select("legal_name, trading_name").eq("id", profile.company_id).maybeSingle();
    company_name = c?.legal_name ?? c?.trading_name ?? null;
  }
  const signer_type: SignerType = profile?.company_id
    ? profile.company_role === "admin" ? "company_admin" : "company_user"
    : "personal";
  let signed_current = false;
  if (version) {
    const { data: sig } = await supabase
      .from("agreement_signatures")
      .select("id")
      .eq("user_id", userId)
      .eq("agreement_version_id", version.id)
      .limit(1);
    signed_current = !!sig?.length;
  }
  return { version: version as AgreementVersion | null, profile, company_name, signer_type, signed_current };
}

export const getMySigningContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const c = await loadSignerContext(supabase, userId);
    return {
      version: c.version,
      signer_type: c.signer_type,
      company_name: c.company_name,
      profile_name: c.profile?.full_name ?? null,
      job_title: c.profile?.job_title ?? null,
      signed_current: c.signed_current,
    };
  });

const SignInput = z.object({
  version_id: z.string().uuid(),
  signed_name: z.string().trim().min(2).max(200),
  signed_title: z.string().trim().max(200).optional().nullable(),
  signature_png: z.string().max(800_000),
  agreed: z.literal(true),
});

export const signMembershipAgreement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SignInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context as any;
    const c = await loadSignerContext(supabase, userId);
    if (!c.version || c.version.id !== data.version_id) {
      throw new Error("This agreement version is no longer current. Please refresh the page.");
    }
    if (c.signed_current) return { ok: true as const, already: true, email_sent: false };
    if (c.signer_type !== "personal" && !data.signed_title?.trim()) {
      throw new Error("Please enter your job title.");
    }

    const { sha256Hex, decodePngDataUrl, buildSignedPdf } = await import("./agreements.server");
    const png = decodePngDataUrl(data.signature_png);
    const sha = await sha256Hex(c.version.body_markdown);

    const { getRequestHeader, getRequestIP } = await import("@tanstack/react-start/server");
    const fwd = getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim();
    const ip = getRequestHeader("cf-connecting-ip") ?? fwd ?? getRequestIP() ?? null;
    const ua = (getRequestHeader("user-agent") ?? "").slice(0, 500) || null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sigId = crypto.randomUUID();
    const signedAt = new Date().toISOString();
    const imgPath = `signatures/${userId}/${sigId}.png`;
    const up = await supabaseAdmin.storage.from(BUCKET).upload(imgPath, png, { contentType: "image/png", upsert: false });
    if (up.error) throw new Error(`Could not store signature: ${up.error.message}`);

    const { error: insErr } = await supabaseAdmin.from("agreement_signatures").insert({
      id: sigId,
      user_id: userId,
      company_id: c.profile?.company_id ?? null,
      signer_type: c.signer_type,
      agreement_version_id: c.version.id,
      agreement_text_sha256: sha,
      signed_name: data.signed_name,
      signed_title: data.signed_title?.trim() || null,
      signature_image_path: imgPath,
      signed_at: signedAt,
      ip_address: ip,
      user_agent: ua,
      agreement_status_at_signing: c.version.status,
    });
    if (insErr) throw new Error(insErr.message);

    // PDF (best-effort: signature is valid even if PDF generation fails; it can be regenerated).
    try {
      const b64 = data.signature_png.split(",")[1];
      const pdf = await buildSignedPdf({
        title: c.version.title,
        version: c.version.version,
        body_markdown: c.version.body_markdown,
        draft: c.version.status === "draft",
        signer_name: data.signed_name,
        signer_title: data.signed_title?.trim() || null,
        company_name: c.company_name,
        signer_type: c.signer_type,
        signer_email: claims?.email ?? null,
        signed_at: signedAt,
        ip_address: ip,
        user_agent: ua,
        sha256: sha,
        signature_id: sigId,
        signature_png_base64: b64,
      });
      const pdfPath = `signatures/${userId}/${sigId}.pdf`;
      const pu = await supabaseAdmin.storage.from(BUCKET).upload(pdfPath, pdf, { contentType: "application/pdf", upsert: false });
      if (pu.error) throw pu.error;
      await supabaseAdmin.rpc("set_signature_pdf_path" as any, { _signature_id: sigId, _pdf_path: pdfPath });
    } catch (e) {
      console.error("[signMembershipAgreement] PDF generation failed", e);
    }

    // Onboarding completion + membership activation (guarded fields → privileged write).
    await supabaseAdmin
      .from("profiles")
      .update({ is_onboarded: true, agreement_signed_at: signedAt, signed_legal_name: data.signed_name })
      .eq("id", userId);
    await supabaseAdmin
      .from("profiles")
      .update({ membership_status: "active", membership_since: signedAt })
      .eq("id", userId)
      .eq("membership_status", "pending");

    await audit({
      action: "agreement_signed",
      actor_user_id: userId,
      subject_user_id: userId,
      subject_company_id: c.profile?.company_id ?? null,
      reason: `Version ${c.version.version} · ${c.signer_type} · signature ${sigId}`,
    });

    // No transactional email sender is configured for this project; the confirmation email is skipped.
    return { ok: true as const, already: false, email_sent: false };
  });

const SIG_COLS = "id, user_id, company_id, signer_type, signed_name, signed_title, signed_at, pdf_path, agreement_version_id, agreement_status_at_signing, agreement_versions(version, title, status)";

export const listMySignatures = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const { data, error } = await supabase.from("agreement_signatures").select(SIG_COLS).eq("user_id", userId).order("signed_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { signatures: data ?? [] };
  });

export const listCompanySignatures = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ companyId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    // RLS returns rows only to company admins (and platform admins).
    const { data: rows, error } = await supabase.from("agreement_signatures").select(SIG_COLS).eq("company_id", data.companyId).order("signed_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { signatures: rows ?? [] };
  });

export const getSignatureDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { data: row } = await supabase.from("agreement_signatures").select("pdf_path").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("Signature not found.");
    if (!row.pdf_path) throw new Error("The signed PDF is not available yet.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(row.pdf_path, 300, { download: true });
    if (error || !s) throw new Error(error?.message ?? "Could not create download link.");
    return { url: s.signedUrl };
  });

/* ---------------- Admin ---------------- */

export const adminListAgreements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    if (!(await isAdmin(supabase, userId))) return { forbidden: true as const };
    const { data: versions, error } = await supabase.from("agreement_versions").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const current = (versions ?? []).find((v: AgreementVersion) => v.is_current && v.doc_type === "membership_agreement") ?? null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: members }, { data: admins }, { data: sigs }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, member_type, company_id, membership_status, companies(legal_name)").eq("is_onboarded", true),
      supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin"),
      current
        ? supabaseAdmin.from("agreement_signatures").select("user_id, signed_at").eq("agreement_version_id", current.id)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const adminIds = new Set((admins ?? []).map((a: any) => a.user_id));
    const signedIds = new Set((sigs ?? []).map((s: any) => s.user_id));
    const pool = (members ?? []).filter((m: any) => !adminIds.has(m.id));
    const unsigned = pool.filter((m: any) => !signedIds.has(m.id));
    const emails = new Map<string, string>();
    try {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      for (const u of list?.users ?? []) emails.set(u.id, u.email ?? "");
    } catch {
      /* best-effort */
    }
    return {
      forbidden: false as const,
      versions: versions ?? [],
      coverage: {
        current_version: current?.version ?? null,
        signed: pool.length - unsigned.length,
        unsigned_count: unsigned.length,
        unsigned: unsigned.map((m: any) => ({
          id: m.id,
          full_name: m.full_name,
          email: emails.get(m.id) ?? null,
          member_type: m.company_id ? "corporate" : m.member_type ?? "legacy",
          company: m.companies?.legal_name ?? null,
          membership_status: m.membership_status,
        })),
      },
    };
  });

export const adminCreateAgreementVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      version: z.string().trim().min(1).max(40),
      title: z.string().trim().min(3).max(200),
      body_markdown: z.string().min(10).max(200_000),
      effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      requires_resign: z.boolean(),
      doc_type: z.enum(["membership_agreement", "engagement_nda", "privacy_notice", "terms_of_service"]).default("membership_agreement"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { data: row, error } = await supabase
      .from("agreement_versions")
      .insert({ ...data, created_by: userId, is_current: false, status: "draft" })
      .select("id")
      .single();
    if (error) throw new Error(error.message.includes("duplicate") ? "That version number already exists." : error.message);
    await audit({ action: "agreement_version_created", actor_user_id: userId, reason: `Version ${data.version}` });
    return { id: row.id as string };
  });

export const adminSetCurrentAgreement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { data: v } = await supabase.from("agreement_versions").select("version, requires_resign, doc_type").eq("id", data.id).maybeSingle();
    if (!v) throw new Error("Version not found.");
    const off = await supabase.from("agreement_versions").update({ is_current: false }).eq("is_current", true).eq("doc_type", v.doc_type);
    if (off.error) throw new Error(off.error.message);
    const on = await supabase.from("agreement_versions").update({ is_current: true }).eq("id", data.id);
    if (on.error) throw new Error(on.error.message);
    await audit({ action: "agreement_version_set_current", actor_user_id: userId, reason: `Version ${v.version}${v.requires_resign ? " · re-sign required" : ""}` });
    return { ok: true as const };
  });

export const adminSetRequiresResign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), requires_resign: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { data: v, error } = await supabase.from("agreement_versions").update({ requires_resign: data.requires_resign }).eq("id", data.id).select("version").single();
    if (error) throw new Error(error.message);
    await audit({ action: "agreement_resign_toggled", actor_user_id: userId, reason: `Version ${v.version} · requires re-sign: ${data.requires_resign ? "yes" : "no"}` });
    return { ok: true as const };
  });

export const adminListSignaturesFor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid().optional(), companyId: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    let q = supabase.from("agreement_signatures").select(SIG_COLS).order("signed_at", { ascending: false });
    if (data.userId) q = q.eq("user_id", data.userId);
    else if (data.companyId) q = q.eq("company_id", data.companyId);
    else throw new Error("Specify a member or company.");
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { signatures: rows ?? [] };
  });

export const adminMarkAgreementFinal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { data: v, error } = await supabase
      .from("agreement_versions")
      .update({ status: "final", finalized_at: new Date().toISOString(), finalized_by: userId })
      .eq("id", data.id)
      .eq("status", "draft")
      .select("version, doc_type")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!v) throw new Error("This version is already final.");
    const documentName = v.doc_type === "engagement_nda"
      ? "Engagement NDA"
      : v.doc_type === "privacy_notice"
        ? "Privacy Policy"
        : v.doc_type === "terms_of_service"
          ? "Terms of Service"
          : "Membership Agreement";
    await audit({ action: "agreement_version_marked_final", actor_user_id: userId, reason: `${documentName} version ${v.version} marked final` });
    return { ok: true as const };
  });
