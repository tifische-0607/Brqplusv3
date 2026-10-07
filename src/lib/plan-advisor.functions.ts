import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const Input = z.object({
  memberType: z.enum(["personal", "corporate", "unsure"]),
  goals: z.string().trim().min(20, "Please describe your goals in a little more detail.").max(1500),
});

export type PlanAdvice = { ok: true; plan_code: string; member_type: "personal" | "corporate"; billing_cycle: "monthly" | "annual"; explanation: string } | { ok: false; error: string };

export const recommendPlan = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<PlanAdvice> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    const url = process.env["SUPABASE_URL"]!;
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    if (!apiKey) return { ok: false, error: "The plan advisor is not configured yet." };
    const sb = createClient(url, key, {
      auth: { persistSession: false },
      global: { fetch: (i, init) => { const h = new Headers(init?.headers); if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization"); h.set("apikey", key); return fetch(i, { ...init, headers: h }); } },
    });
    const { data: plans } = await sb.from("membership_plans").select("code,member_type,name,tagline,monthly_price_myr,annual_price_myr,max_users,benefits").eq("is_active", true).order("sort_order");
    if (!plans?.length) return { ok: false, error: "No plans are available right now." };
    const codes = plans.map((p) => p.code);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        instructions: "You are the BRQ+ membership advisor. BRQ+ is an invitation-only fractional advisory collective (Islamic finance, AI payments, digital inclusion, enterprise transformation). Recommend exactly one plan from the list that best fits the prospect. Only use the plan data given; never invent prices or benefits. Always call the organisation BRQ+. Explanation: 2-3 sentences, plain and professional, addressed to the prospect.",
        input: `Plans (JSON): ${JSON.stringify(plans)}\n\nProspect member type preference: ${data.memberType}\nProspect goals: ${data.goals}`,
        text: { format: { type: "json_schema", name: "advice", strict: true, schema: {
          type: "object", additionalProperties: false, required: ["plan_code", "billing_cycle", "explanation"],
          properties: { plan_code: { type: "string", enum: codes }, billing_cycle: { type: "string", enum: ["monthly", "annual"] }, explanation: { type: "string" } },
        } } },
      }),
    });
    if (!res.ok || !res.body) {
      if (res.status === 429) return { ok: false, error: "The advisor is busy. Please try again in a moment." };
      if (res.status === 402) return { ok: false, error: "The advisor is temporarily unavailable." };
      return { ok: false, error: "The advisor couldn't respond. Please browse the plans below." };
    }
    const reader = res.body.getReader(); const dec = new TextDecoder();
    let buf = "", text = "", refused = false;
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const frame = buf.slice(0, i); buf = buf.slice(i + 2);
        for (const line of frame.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim(); if (!raw || raw === "[DONE]") continue;
          try {
            const ev = JSON.parse(raw);
            if (ev.type === "response.output_text.delta") text += ev.delta;
            if (ev.type === "response.refusal.delta") refused = true;
          } catch { /* partial */ }
        }
      }
    }
    if (refused || !text) return { ok: false, error: "The advisor couldn't make a recommendation. Please browse the plans below." };
    try {
      const out = JSON.parse(text) as { plan_code: string; billing_cycle: "monthly" | "annual"; explanation: string };
      const plan = plans.find((p) => p.code === out.plan_code);
      if (!plan) throw new Error();
      return { ok: true, plan_code: plan.code, member_type: plan.member_type as "personal" | "corporate", billing_cycle: out.billing_cycle, explanation: out.explanation };
    } catch { return { ok: false, error: "The advisor response was unclear. Please try again." }; }
  });
