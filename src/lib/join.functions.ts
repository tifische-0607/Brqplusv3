import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const DOMAINS = [
  "Islamic Finance",
  "AI & Payments",
  "Digital Banking",
  "Regulatory Affairs",
  "Enterprise Transformation",
  "Social Enterprise",
  "Capital Markets",
  "Other",
] as const;

const MARKETS = [
  "Malaysia",
  "Singapore",
  "Indonesia",
  "UAE",
  "Saudi Arabia",
  "UK",
  "Pakistan",
  "Bangladesh",
  "Nigeria",
  "Other",
] as const;

const REFERRALS = [
  "LinkedIn",
  "Referred by a member",
  "Event/conference",
  "Search",
  "Other",
] as const;

const JoinSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  linkedinUrl: z
    .string()
    .trim()
    .min(1)
    .max(300)
    .regex(/linkedin\.com/i, "Must be a LinkedIn URL"),
  role: z.string().trim().min(1).max(200),
  primaryDomain: z.enum(DOMAINS),
  markets: z.array(z.enum(MARKETS)).min(1, "Select at least one market").max(10),
  mandate: z.string().trim().min(1).max(300),
  referralSource: z.enum(REFERRALS),
});

export const submitJoinApplication = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => JoinSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: recent, error: rateErr } = await supabaseAdmin
      .from("collective_applications")
      .select("id")
      .eq("email", data.email)
      .gte("created_at", fiveMinutesAgo);
    if (rateErr) throw new Error("Rate check failed");
    if (recent && recent.length >= 3) {
      throw new Error("Too many submissions. Please wait a few minutes.");
    }

    const reference = `BRQ-JOIN-${Date.now().toString(36).toUpperCase()}`;

    const { error } = await supabaseAdmin.from("collective_applications").insert({
      reference,
      full_name: data.fullName,
      email: data.email,
      linkedin_url: data.linkedinUrl,
      role_title: data.role,
      primary_domain: data.primaryDomain,
      markets: data.markets,
      mandate_description: data.mandate,
      referral_source: data.referralSource,
    });

    if (error) {
      console.error("[BRQ+ join] insert failed", error);
      throw new Error("Could not save your application. Please try again.");
    }

    return { ok: true as const, reference };
  });
