import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ContactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Invalid email").max(255),
  phone: z
    .string()
    .trim()
    .max(32)
    .regex(/^[+0-9 ()-]*$/, "Invalid phone number")
    .optional()
    .default(""),
  industry: z.string().trim().max(120).optional().default(""),
  mission: z.enum(["enterprise", "bfr", "ummah"], {
    message: "Select a mission",
  }),
  brief: z.string().trim().max(2000).optional().default(""),
});

export const submitContact = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ContactSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Rate limit: max 3 submissions per email per 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: recent, error: rateErr } = await supabaseAdmin
      .from("leads")
      .select("id")
      .eq("email", data.email)
      .gte("created_at", fiveMinutesAgo);
    if (rateErr) throw new Error("Rate check failed");
    if (recent && recent.length >= 3) {
      throw new Error("Too many submissions. Please wait a few minutes.");
    }

    const reference = `BRQ-${Date.now().toString(36).toUpperCase()}`;

    const { error } = await supabaseAdmin.from("leads").insert({
      reference,
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      industry: data.industry || null,
      mission: data.mission,
      brief: data.brief || null,
    });

    if (error) {
      console.error("[BRQ+ contact] insert failed", error);
      throw new Error("Could not save your brief. Please try again.");
    }

    console.log("[BRQ+ contact] saved", { reference, email: data.email });
    return { ok: true as const, reference };
  });
