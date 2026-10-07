import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BUCKET = "legal-agreements";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(`Authorization check failed: ${error.message}`);
  if (data !== true) throw new Error("Forbidden: admin role required");
}

export type LegalAgreement = {
  id: string;
  version_name: string;
  content: string | null;
  file_url: string | null;
  file_signed_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

async function signFileIfNeeded(_supabase: any, row: any): Promise<LegalAgreement> {
  let file_signed_url: string | null = null;
  if (row.file_url && row.file_url.toLowerCase().endsWith(".pdf")) {
    // Use service-role admin client so storage reads do not require a broad
    // authenticated SELECT policy on the legal-agreements bucket.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(row.file_url, 3600);
    file_signed_url = data?.signedUrl ?? null;
  }
  return { ...row, file_signed_url };
}

export const listAgreements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { data, error } = await supabase
      .from("legal_agreements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const out = await Promise.all((data ?? []).map((r: any) => signFileIfNeeded(supabase, r)));
    return { agreements: out };
  });

export const getActiveAgreement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    const { data, error } = await supabase
      .from("legal_agreements")
      .select("*")
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { agreement: null };
    const signed = await signFileIfNeeded(supabase, data);
    return { agreement: signed };
  });

const UpsertInput = z
  .object({
    version_name: z.string().trim().min(1).max(200),
    content: z.string().trim().max(200000).optional().nullable(),
    file_url: z.string().trim().max(500).optional().nullable(),
  })
  .refine((d) => !!(d.content && d.content.length > 0) || !!(d.file_url && d.file_url.length > 0), {
    message: "Provide either agreement text or an uploaded file path",
  });

export const upsertAgreement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpsertInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);

    // Deactivate all currently active versions
    const { error: deErr } = await supabase
      .from("legal_agreements")
      .update({ is_active: false })
      .eq("is_active", true);
    if (deErr) throw new Error(deErr.message);

    const { data: inserted, error } = await supabase
      .from("legal_agreements")
      .insert({
        version_name: data.version_name,
        content: data.content ?? null,
        file_url: data.file_url ?? null,
        is_active: true,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { agreement: inserted };
  });

const ActivateInput = z.object({ id: z.string().uuid() });

export const activateAgreement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ActivateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);

    const { error: deErr } = await supabase
      .from("legal_agreements")
      .update({ is_active: false })
      .eq("is_active", true);
    if (deErr) throw new Error(deErr.message);

    const { data: updated, error } = await supabase
      .from("legal_agreements")
      .update({ is_active: true })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { agreement: updated };
  });

export const previewAgreement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { data: row, error } = await supabase
      .from("legal_agreements")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    const signed = await signFileIfNeeded(supabase, row);
    return { agreement: signed };
  });
