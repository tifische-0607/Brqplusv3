import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const SECTORS = ["Fintech/Payments", "Islamic finance", "Digital banking", "AI", "Social enterprise", "Other"] as const;
export const STAGES = ["Idea", "Pre-seed", "Seed", "Series A+", "Revenue-generating/bootstrapped"] as const;
export const NEEDS = ["Fundraising", "Scaling/operations", "Governance/compliance", "Market entry", "Other"] as const;

const optionalUrl = z.string().trim().max(300).refine(value => {
  if (!value) return true;
  try { const url = new URL(value); return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password; }
  catch { return false; }
}, "Enter a valid https URL");
const linkedinUrl = optionalUrl.refine(value => {
  if (!value) return true;
  const hostname = new URL(value).hostname;
  return hostname === "linkedin.com" || hostname.endsWith(".linkedin.com");
}, "Enter a valid LinkedIn URL");

export const founderApplicationSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  linkedinUrl,
  companyName: z.string().trim().min(1).max(200),
  website: optionalUrl,
  country: z.string().trim().min(1).max(100),
  sector: z.enum(SECTORS),
  stage: z.enum(STAGES),
  needs: z.array(z.enum(NEEDS)).min(1).max(NEEDS.length),
  challenge: z.string().trim().min(1).max(1000),
  consent: z.literal(true),
});

export const submitFounderApplication = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => founderApplicationSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase();
    const since = new Date(Date.now() - 5 * 60_000).toISOString();
    const { count, error: countError } = await supabaseAdmin.from("founder_applications")
      .select("id", { count: "exact", head: true }).eq("email", email).gte("created_at", since);
    if (countError) throw new Error("Could not check submissions. Please try again.");
    if ((count ?? 0) >= 3) throw new Error("Too many submissions. Please wait five minutes.");
    const reference = `FDR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const { error } = await supabaseAdmin.from("founder_applications").insert({
      reference, full_name: data.fullName, email, linkedin_url: data.linkedinUrl || null,
      company_name: data.companyName, website: data.website || null, country: data.country,
      sector: data.sector, stage: data.stage, needs: data.needs, challenge: data.challenge,
      consent: data.consent,
    });
    if (error) throw new Error("Could not save your application. Please try again.");
    return { reference };
  });

export const listFounderApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: allowed, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || !allowed) throw new Error("Forbidden: admin role required");
    const { data, error } = await context.supabase.from("founder_applications").select("*").order("created_at", { ascending: false }).limit(5000);
    if (error) throw new Error("Could not load founder applications.");
    return data ?? [];
  });