// Server-only helpers for BRQ+ Engagement NDAs (per mission).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildExecutedPdf, buildSignedPdf, decodePngDataUrl, renderNdaBody, sha256Hex, type NdaSchedule, type PdfSignature } from "./agreements.server";

export const BUCKET = "legal-agreements";
export const TOKEN_DAYS = 14;

export async function isAdminUser(userId: string) {
  const { data } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
  return data === true;
}

/** Admins, BRQ+ leads on the mission and the lead executive can manage its NDA. */
export async function canManageMissionNda(missionId: string, userId: string) {
  if (await isAdminUser(userId)) return true;
  const { data: mm } = await supabaseAdmin.from("mission_members").select("role").eq("mission_id", missionId).eq("user_id", userId).maybeSingle();
  if (mm?.role === "brqplus_lead") return true;
  const { data: m } = await supabaseAdmin.from("missions").select("lead_executive_id").eq("id", missionId).maybeSingle();
  if (m?.lead_executive_id) {
    const { data: fe } = await supabaseAdmin.from("fractional_executives").select("user_id").eq("id", m.lead_executive_id).maybeSingle();
    if (fe?.user_id === userId) return true;
  }
  return false;
}

/** True when the mission has an NDA and this (non-admin) user has not signed it. */
export async function ndaBlocksUser(missionId: string, userId: string): Promise<boolean> {
  const { data: nda } = await supabaseAdmin.from("engagement_ndas").select("id").eq("mission_id", missionId).maybeSingle();
  if (!nda) return false;
  if (await isAdminUser(userId)) return false;
  const { data: p } = await supabaseAdmin.from("engagement_nda_parties").select("id").eq("nda_id", nda.id).eq("user_id", userId).eq("status", "signed").limit(1);
  return !p?.length;
}

export async function assertNdaCleared(missionId: string | null | undefined, userId: string) {
  if (missionId && (await ndaBlocksUser(missionId, userId))) {
    throw new Error("Forbidden: please sign the Engagement NDA for this mission first.");
  }
}

export async function loadNdaBundle(ndaId: string) {
  const { data: nda, error } = await supabaseAdmin.from("engagement_ndas").select("*").eq("id", ndaId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!nda) throw new Error("NDA not found.");
  const [{ data: version }, { data: parties }, { data: mission }] = await Promise.all([
    supabaseAdmin.from("agreement_versions").select("id, version, title, body_markdown, status").eq("id", nda.agreement_version_id).single(),
    supabaseAdmin.from("engagement_nda_parties").select("*").eq("nda_id", ndaId).order("sort_order"),
    supabaseAdmin.from("missions").select("id, title").eq("id", nda.mission_id).maybeSingle(),
  ]);
  const ps = parties ?? [];
  const body = renderNdaBody(version!.body_markdown, nda.schedule as unknown as NdaSchedule, ps);
  return { nda, version: version!, parties: ps, mission, body };
}

export function ndaConsent(version: string, missionTitle: string, onBehalf: string) {
  return `I agree to the BRQ+ Engagement NDA (version ${version}) for ${missionTitle}, on behalf of ${onBehalf}.`;
}

async function requestMeta() {
  const { getRequestHeader, getRequestIP } = await import("@tanstack/react-start/server");
  const fwd = getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = getRequestHeader("cf-connecting-ip") ?? fwd ?? getRequestIP() ?? null;
  const ua = (getRequestHeader("user-agent") ?? "").slice(0, 500) || null;
  return { ip, ua };
}

async function audit(action: string, actor: string | null, reason: string, subject_user_id: string | null = null, subject_company_id: string | null = null) {
  const { actorEmail } = await import("./invite.server");
  const actor_email = actor ? await actorEmail(actor) : null;
  const { error } = await supabaseAdmin.from("application_review_audit").insert({ action, actor_user_id: actor, actor_email, reason, subject_user_id, subject_company_id } as any);
  if (error) console.error("[nda] audit insert failed", error);
}
export { audit as ndaAudit };

/** Records one party's signature, its individual PDF, and executes the NDA when everyone has signed. */
export async function signNdaParty(opts: {
  partyId: string;
  signerUserId: string | null;
  signerEmail: string | null;
  signed_name: string;
  signed_title: string | null;
  signature_png: string;
}) {
  const { data: party } = await supabaseAdmin.from("engagement_nda_parties").select("*").eq("id", opts.partyId).maybeSingle();
  if (!party) throw new Error("Signing request not found.");
  if (party.status === "signed") return { already: true, executed: false };
  const b = await loadNdaBundle(party.nda_id);
  const png = decodePngDataUrl(opts.signature_png);
  const sha = await sha256Hex(b.body);
  const { ip, ua } = await requestMeta();
  const signedAt = new Date().toISOString();
  const imgPath = `ndas/${b.nda.id}/${party.id}.png`;
  const up = await supabaseAdmin.storage.from(BUCKET).upload(imgPath, png, { contentType: "image/png", upsert: false });
  if (up.error) throw new Error(`Could not store signature: ${up.error.message}`);

  const { data: updated, error } = await supabaseAdmin
    .from("engagement_nda_parties")
    .update({
      status: "signed",
      signed_by_user_id: opts.signerUserId,
      signed_name: opts.signed_name,
      signed_title: opts.signed_title,
      signature_image_path: imgPath,
      signed_at: signedAt,
      ip_address: ip,
      user_agent: ua,
      text_sha256: sha,
      agreement_status_at_signing: b.version.status,
      token_used_at: party.sign_token ? signedAt : null,
      email: party.email ?? opts.signerEmail,
    })
    .eq("id", party.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!updated) return { already: true, executed: false };

  const sig: PdfSignature = {
    signer_name: opts.signed_name,
    signer_title: opts.signed_title,
    company_name: party.company_name,
    signer_type: party.party_kind,
    signer_email: party.email ?? opts.signerEmail,
    signed_at: signedAt,
    ip_address: ip,
    user_agent: ua,
    sha256: sha,
    signature_id: party.id,
    signature_png_base64: opts.signature_png.split(",")[1],
  };
  try {
    const pdf = await buildSignedPdf({ ...sig, title: b.version.title, version: b.version.version, body_markdown: b.body, draft: b.version.status === "draft" });
    const pdfPath = `ndas/${b.nda.id}/${party.id}.pdf`;
    const pu = await supabaseAdmin.storage.from(BUCKET).upload(pdfPath, pdf, { contentType: "application/pdf", upsert: false });
    if (pu.error) throw pu.error;
    await supabaseAdmin.from("engagement_nda_parties").update({ pdf_path: pdfPath }).eq("id", party.id);
  } catch (e) {
    console.error("[nda] individual PDF failed", e);
  }

  await audit("nda_signed", opts.signerUserId, `${b.mission?.title ?? "Mission"} · ${opts.signed_name}${party.company_name ? ` for ${party.company_name}` : ""} · party ${party.id}`, party.user_id, party.company_id);

  const executed = await maybeExecute(b.nda.id);
  return { already: false, executed };
}

export async function maybeExecute(ndaId: string): Promise<boolean> {
  const { data: pending } = await supabaseAdmin.from("engagement_nda_parties").select("id").eq("nda_id", ndaId).eq("status", "pending").limit(1);
  if (pending?.length) return false;
  const executedAt = new Date().toISOString();
  const { data: won } = await supabaseAdmin.from("engagement_ndas").update({ status: "executed", executed_at: executedAt }).eq("id", ndaId).eq("status", "pending").select("id").maybeSingle();
  if (!won) return false;
  const b = await loadNdaBundle(ndaId);
  try {
    const sigs: PdfSignature[] = [];
    for (const p of b.parties) {
      const { data: blob } = await supabaseAdmin.storage.from(BUCKET).download(p.signature_image_path!);
      const buf = blob ? new Uint8Array(await blob.arrayBuffer()) : new Uint8Array();
      let bin = "";
      for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      sigs.push({
        signer_name: p.signed_name!,
        signer_title: p.signed_title,
        company_name: p.company_name,
        signer_type: p.party_kind,
        signer_email: p.email,
        signed_at: p.signed_at!,
        ip_address: p.ip_address,
        user_agent: p.user_agent,
        sha256: p.text_sha256!,
        signature_id: p.id,
        signature_png_base64: btoa(bin),
      });
    }
    const pdf = await buildExecutedPdf({ title: b.version.title, version: b.version.version, body_markdown: b.body, draft: b.version.status === "draft", executed_at: executedAt, signatures: sigs });
    const path = `ndas/${ndaId}/executed.pdf`;
    const up = await supabaseAdmin.storage.from(BUCKET).upload(path, pdf, { contentType: "application/pdf", upsert: false });
    if (up.error) throw up.error;
    await supabaseAdmin.from("engagement_ndas").update({ executed_pdf_path: path }).eq("id", ndaId).is("executed_pdf_path", null);
  } catch (e) {
    console.error("[nda] executed PDF failed", e);
  }
  await audit("nda_executed", null, `${b.mission?.title ?? "Mission"} · all ${b.parties.length} parties signed · NDA ${ndaId}`);
  // No transactional email sender is configured; external signers are not emailed a download link.
  return true;
}

export async function signedUrl(path: string) {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, 300, { download: true });
  if (error || !data) throw new Error(error?.message ?? "Could not create download link.");
  return data.signedUrl;
}
