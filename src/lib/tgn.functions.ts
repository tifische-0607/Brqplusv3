import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const MODELS = ["A", "B", "C", "D"] as const;
export const EXPERTISE = ["Finance/Fundraising", "Operations/Scaling", "Tech/Product", "Education", "Social Enterprise", "Other"] as const;
export const HOURS = ["Under 10", "10–20", "20–40", "Full-time", "Other"] as const;
export const GEOGRAPHIES = ["Malaysia", "Indonesia", "Cambodia", "Flexible", "Other"] as const;
export const CAREER_STAGES = ["Student/Graduate", "Early career", "Mid-career", "Senior/Executive", "Founder"] as const;
export const REFERRALS = ["MPS breakout", "MPS booth", "AMP", "Referral", "LinkedIn", "Other"] as const;
export const ATTENDING_AS = ["Professional", "Overseas partner organisation", "Corporate or sponsor", "Other"] as const;

const optionalText = (length: number) => z.string().trim().max(length);
const linkedin = z.string().trim().max(300).refine((value) => {
  if (!value) return true;
  try { const url = new URL(value); return url.protocol === "https:" && (url.hostname === "linkedin.com" || url.hostname.endsWith(".linkedin.com")); }
  catch { return false; }
}, "Enter a valid https://linkedin.com URL");

export const interestSchema = z.object({
  fullName: z.string().trim().min(1).max(120), email: z.string().trim().email().max(255),
  linkedinUrl: linkedin, phone: optionalText(40),
  models: z.array(z.enum(MODELS)).min(1).max(4), expertise: z.array(z.enum(EXPERTISE)).min(1).max(6),
  expertiseOther: optionalText(200), hoursAvailable: z.enum(HOURS),
  geographies: z.array(z.enum(GEOGRAPHIES)).min(1).max(5), geographyOther: optionalText(200),
  careerStage: z.union([z.enum(CAREER_STAGES), z.literal("")]),
  referralSource: z.union([z.enum(REFERRALS), z.literal("")]),
  source: z.union([z.enum(["booth", "breakout", "qr"]), z.literal("")]),
  consent: z.literal(true), updatesOptIn: z.boolean(),
}).refine((data) => !data.expertise.includes("Other") || !!data.expertiseOther, { path: ["expertiseOther"], message: "Please describe your expertise" })
  .refine((data) => !data.geographies.includes("Other") || !!data.geographyOther, { path: ["geographyOther"], message: "Please specify a geography" });

export const rsvpSchema = z.object({
  fullName: z.string().trim().min(1).max(120), email: z.string().trim().email().max(255),
  organisation: optionalText(200), attendingAs: z.enum(ATTENDING_AS), country: optionalText(100),
  dietaryNotes: optionalText(500), consent: z.literal(true),
});

async function checkRateLimit(admin: any, table: "tgn_interests" | "tgn_rsvps", email: string) {
  const since = new Date(Date.now() - 5 * 60_000).toISOString();
  const { count, error } = await admin.from(table).select("id", { count: "exact", head: true }).eq("email", email.toLowerCase()).gte("created_at", since);
  if (error) throw new Error("Could not check submissions. Please try again.");
  if ((count ?? 0) >= 3) throw new Error("Too many submissions. Please wait five minutes.");
}

export const submitTgnInterest = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => interestSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await checkRateLimit(supabaseAdmin, "tgn_interests", data.email);
    const reference = `TGN-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const { error } = await supabaseAdmin.from("tgn_interests").insert({
      reference, full_name: data.fullName, email: data.email.toLowerCase(), linkedin_url: data.linkedinUrl || null,
      phone: data.phone || null, models: data.models, expertise: data.expertise, expertise_other: data.expertiseOther || null,
      hours_available: data.hoursAvailable, geographies: data.geographies, geography_other: data.geographyOther || null,
      career_stage: data.careerStage || null, referral_source: data.referralSource || null, source: data.source || null,
      consent: data.consent, updates_opt_in: data.updatesOptIn,
    });
    if (error) throw new Error("Could not save your interest. Please try again.");
    return { reference };
  });

export const submitTgnRsvp = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => rsvpSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await checkRateLimit(supabaseAdmin, "tgn_rsvps", data.email);
    const { error } = await supabaseAdmin.from("tgn_rsvps").insert({
      full_name: data.fullName, email: data.email.toLowerCase(), organisation: data.organisation || null,
      attending_as: data.attendingAs, country: data.country || null, dietary_notes: data.dietaryNotes || null,
      consent: data.consent,
    });
    if (error) throw new Error("Could not save your RSVP. Please try again.");
    return { ok: true as const };
  });

export const listTgnSubmissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: allowed, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || !allowed) throw new Error("Forbidden: admin role required");
    const [interests, rsvps] = await Promise.all([
      context.supabase.from("tgn_interests").select("*").order("created_at", { ascending: false }).limit(5000),
      context.supabase.from("tgn_rsvps").select("*").order("created_at", { ascending: false }).limit(5000),
    ]);
    if (interests.error || rsvps.error) throw new Error("Could not load program submissions.");
    return { interests: interests.data ?? [], rsvps: rsvps.data ?? [] };
  });
