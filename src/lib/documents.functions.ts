import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DossierDoc = {
  kind: "agreement" | "nda";
  id: string;
  doc_label: string;
  version: string;
  mission_title: string | null;
  mission_id: string | null;
  signed_on_draft: boolean;
  signed_at: string;
  signer: string;
  signer_title: string | null;
  status: "signed" | "executed";
  has_pdf: boolean;
  has_executed_pdf: boolean;
  external: boolean;
};

const Scope = z.union([
  z.object({ mine: z.literal(true) }),
  z.object({ userId: z.string().uuid() }),
  z.object({ companyId: z.string().uuid() }),
  z.object({ allNdas: z.literal(true) }),
]);

async function authorize(scope: z.infer<typeof Scope>, userId: string) {
  const { isAdminUser } = await import("./nda.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if ("mine" in scope) return { userId };
  const admin = await isAdminUser(userId);
  if ("userId" in scope) {
    if (!admin && scope.userId !== userId) throw new Error("Forbidden");
    return { userId: scope.userId };
  }
  if ("companyId" in scope) {
    if (!admin) {
      const { data } = await supabaseAdmin.rpc("is_company_admin", { _company_id: scope.companyId, _user_id: userId });
      if (!data) throw new Error("Forbidden");
    }
    return { companyId: scope.companyId };
  }
  if (!admin) throw new Error("Forbidden");
  return { allNdas: true as const };
}

export const listDossierDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Scope.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const f = await authorize(data, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const docs: DossierDoc[] = [];

    if (!("allNdas" in f)) {
      let q = supabaseAdmin
        .from("agreement_signatures")
        .select("id, signed_name, signed_title, signed_at, pdf_path, agreement_status_at_signing, agreement_versions(version, title)")
        .order("signed_at", { ascending: false });
      q = "userId" in f ? q.eq("user_id", f.userId!) : q.eq("company_id", f.companyId!);
      const { data: sigs } = await q;
      for (const s of (sigs ?? []) as any[]) {
        docs.push({
          kind: "agreement",
          id: s.id,
          doc_label: "Membership Agreement",
          version: s.agreement_versions?.version ?? "—",
          mission_title: null,
          mission_id: null,
          signed_on_draft: s.agreement_status_at_signing === "draft",
          signed_at: s.signed_at,
          signer: s.signed_name,
          signer_title: s.signed_title,
          status: "signed",
          has_pdf: !!s.pdf_path,
          has_executed_pdf: false,
          external: false,
        });
      }
    }

    let pq = supabaseAdmin
      .from("engagement_nda_parties")
      .select("id, user_id, signed_name, signed_title, signed_at, pdf_path, agreement_status_at_signing, engagement_ndas(status, executed_pdf_path, mission_id, missions(title), agreement_versions(version))")
      .eq("status", "signed")
      .order("signed_at", { ascending: false });
    if ("userId" in f) pq = pq.eq("user_id", f.userId!);
    else if ("companyId" in f) pq = pq.eq("company_id", f.companyId!);
    const { data: parties } = await pq;
    for (const p of (parties ?? []) as any[]) {
      const n = p.engagement_ndas;
      docs.push({
        kind: "nda",
        id: p.id,
        doc_label: "Engagement NDA",
        version: n?.agreement_versions?.version ?? "—",
        mission_title: n?.missions?.title ?? null,
        mission_id: n?.mission_id ?? null,
        signed_on_draft: p.agreement_status_at_signing === "draft",
        signed_at: p.signed_at,
        signer: p.signed_name,
        signer_title: p.signed_title,
        status: n?.status === "executed" ? "executed" : "signed",
        has_pdf: !!p.pdf_path,
        has_executed_pdf: !!n?.executed_pdf_path,
        external: !p.user_id,
      });
    }
    docs.sort((a, b) => b.signed_at.localeCompare(a.signed_at));
    return { documents: docs };
  });

export const getDocumentPdfUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ kind: z.enum(["agreement", "nda"]), id: z.string().uuid(), executed: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const { isAdminUser, signedUrl } = await import("./nda.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = await isAdminUser(userId);
    const companyAdmin = async (cid: string | null) =>
      !!cid && !!(await supabaseAdmin.rpc("is_company_admin", { _company_id: cid, _user_id: userId })).data;

    if (data.kind === "agreement") {
      const { data: s } = await supabaseAdmin.from("agreement_signatures").select("user_id, company_id, pdf_path").eq("id", data.id).maybeSingle();
      if (!s) throw new Error("Document not found.");
      if (!admin && s.user_id !== userId && !(await companyAdmin(s.company_id))) throw new Error("Forbidden");
      if (!s.pdf_path) throw new Error("The signed PDF is not available yet.");
      return { url: await signedUrl(s.pdf_path) };
    }
    const { data: p } = await supabaseAdmin.from("engagement_nda_parties").select("user_id, company_id, pdf_path, nda_id, engagement_ndas(executed_pdf_path, mission_id)").eq("id", data.id).maybeSingle();
    if (!p) throw new Error("Document not found.");
    let ok = admin || p.user_id === userId || (await companyAdmin(p.company_id));
    if (!ok && data.executed) {
      // Mission managers may download the executed NDA from the mission page.
      const { canManageMissionNda } = await import("./nda.server");
      ok = await canManageMissionNda((p as any).engagement_ndas.mission_id, userId);
    }
    if (!ok) throw new Error("Forbidden");
    const path = data.executed ? (p as any).engagement_ndas?.executed_pdf_path : p.pdf_path;
    if (!path) throw new Error("The PDF is not available yet.");
    return { url: await signedUrl(path) };
  });

/** Executed NDA download from the mission page (any party of that NDA, managers, admins). */
export const getExecutedNdaUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ nda_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const { isAdminUser, canManageMissionNda, signedUrl } = await import("./nda.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: n } = await supabaseAdmin.from("engagement_ndas").select("mission_id, executed_pdf_path").eq("id", data.nda_id).maybeSingle();
    if (!n) throw new Error("NDA not found.");
    let ok = (await isAdminUser(userId)) || (await canManageMissionNda(n.mission_id, userId));
    if (!ok) {
      const { data: p } = await supabaseAdmin.from("engagement_nda_parties").select("id").eq("nda_id", data.nda_id).eq("user_id", userId).limit(1);
      ok = !!p?.length;
    }
    if (!ok) throw new Error("Forbidden");
    if (!n.executed_pdf_path) throw new Error("The executed PDF is not available yet.");
    return { url: await signedUrl(n.executed_pdf_path) };
  });
