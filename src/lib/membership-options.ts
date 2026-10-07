import { z } from "zod";

export const EXPERTISE = [
  "Islamic finance", "AI & payments", "Digital banking", "Digital inclusion", "Regulatory affairs",
  "Enterprise transformation", "Capital markets", "Social enterprise", "Technology & product", "Operations", "Other",
] as const;
export const SECTORS = [
  "Financial services", "Islamic finance", "Fintech/Payments", "Technology", "Government/Public sector",
  "NGO/Social enterprise", "Consulting", "Education", "Other",
] as const;
export const PROGRAM_INTERESTS = ["The Collective", "Founders @ BRQ+", "The Give Network", "Events/community"] as const;
export const MARKETS = [
  "Malaysia", "Singapore", "Indonesia", "Thailand", "Cambodia", "Bangladesh", "UAE", "Saudi Arabia",
  "UK", "Pakistan", "Nigeria", "Other",
] as const;
export const COLLECTIVE_DOMAINS = [
  "Islamic Finance", "AI & Payments", "Digital Banking", "Regulatory Affairs",
  "Enterprise Transformation", "Social Enterprise", "Capital Markets", "Other",
] as const;
export const AVAILABILITY_HOURS = ["Up to 10 hrs/month", "10–20 hrs/month", "20–40 hrs/month", "40+ hrs/month"] as const;
export const REFERRALS = ["LinkedIn", "Referred by a member", "Event/conference", "Search", "Other"] as const;
export const COMPANY_SIZES = ["1–10", "11–50", "51–200", "201–1,000", "1,001–5,000", "5,000+"] as const;
export const CORPORATE_INTERESTS = [
  "Advisory mandates", "Fractional executives", "Programs sponsorship (e.g. Back2Basics)",
  "Founders @ BRQ+", "The Give Network partnership", "Talent/Immersion",
] as const;

const httpsUrl = z.string().trim().max(300).refine(v => {
  if (!v) return true;
  try { const u = new URL(v); return u.protocol === "https:" && !!u.hostname && !u.username && !u.password; } catch { return false; }
}, "Enter a valid https URL");
const linkedin = httpsUrl.refine(v => {
  if (!v) return true;
  const h = new URL(v).hostname; return h === "linkedin.com" || h.endsWith(".linkedin.com");
}, "Enter a valid LinkedIn URL");
const opt = (max: number) => z.string().trim().max(max).default("");

export const MEMBERSHIP_SOURCES = ["event", "qr", "booth", "breakout", "web"] as const;
export type MembershipSource = (typeof MEMBERSHIP_SOURCES)[number];
export const normalizeSource = (v: unknown): MembershipSource => (MEMBERSHIP_SOURCES as readonly string[]).includes(String(v)) ? (v as MembershipSource) : "web";
const sourceField = z.unknown().transform(normalizeSource);
const planFields = { planCode: z.string().trim().min(1, "Choose a plan").max(40), billingCycle: z.enum(["monthly", "annual"]) };

export const personalSchema = z.object({
  source: sourceField,
  ...planFields,
  fullName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  phone: opt(40),
  linkedinUrl: linkedin.default(""),
  country: z.string().trim().min(1).max(100),
  city: opt(100),
  roleTitle: z.string().trim().min(1).max(200),
  organisation: opt(200),
  sector: z.enum(SECTORS),
  expertise: z.array(z.enum(EXPERTISE)).min(1).max(EXPERTISE.length),
  yearsExperience: z.union([z.coerce.number().int().min(0).max(70), z.literal("")]).default(""),
  languages: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  programInterests: z.array(z.enum(PROGRAM_INTERESTS)).max(PROGRAM_INTERESTS.length).default([]),
  bio: opt(1000),
  referralSource: z.union([z.enum(REFERRALS), z.literal("")]).default(""),
  wantsCollective: z.boolean().default(false),
  primaryDomain: z.union([z.enum(COLLECTIVE_DOMAINS), z.literal("")]).default(""),
  markets: z.array(z.enum(MARKETS)).max(MARKETS.length).default([]),
  mandate: opt(1000),
  availability: z.union([z.enum(AVAILABILITY_HOURS), z.literal("")]).default(""),
  consent: z.literal(true),
}).superRefine((v, ctx) => {
  if (!v.wantsCollective) return;
  if (!v.primaryDomain) ctx.addIssue({ code: "custom", path: ["primaryDomain"], message: "Required for The Collective" });
  if (v.markets.length === 0) ctx.addIssue({ code: "custom", path: ["markets"], message: "Select at least one market" });
  if (!v.mandate) ctx.addIssue({ code: "custom", path: ["mandate"], message: "Required for The Collective" });
  if (!v.availability) ctx.addIssue({ code: "custom", path: ["availability"], message: "Required for The Collective" });
});
export type PersonalPayload = z.infer<typeof personalSchema>;

const year = new Date().getFullYear();
export const corporateSchema = z.object({
  source: sourceField,
  ...planFields,
  legalName: z.string().trim().min(1).max(200),
  tradingName: opt(200),
  registrationNo: z.string().trim().min(1).max(100),
  country: z.string().trim().min(1).max(100),
  hqCity: opt(100),
  website: httpsUrl.default(""),
  sector: z.enum(SECTORS),
  sizeBand: z.union([z.enum(COMPANY_SIZES), z.literal("")]).default(""),
  yearFounded: z.union([z.coerce.number().int().min(1800).max(year), z.literal("")]).default(""),
  description: z.string().trim().min(1).max(1500),
  markets: z.array(z.enum(MARKETS)).max(MARKETS.length).default([]),
  interests: z.array(z.enum(CORPORATE_INTERESTS)).max(CORPORATE_INTERESTS.length).default([]),
  contactName: z.string().trim().min(1).max(120),
  contactTitle: z.string().trim().min(1).max(200),
  contactEmail: z.string().trim().email().max(255),
  contactPhone: z.string().trim().min(3).max(40),
  contactLinkedin: linkedin.default(""),
  billingName: opt(120),
  billingEmail: z.union([z.string().trim().email().max(255), z.literal("")]).default(""),
  consent: z.literal(true),
});
export type CorporatePayload = z.infer<typeof corporateSchema>;

export const PERSONAL_FIELD_LABELS: Record<string, string> = {
  fullName: "Full name", email: "Email", phone: "Phone", linkedinUrl: "LinkedIn", country: "Country", city: "City",
  roleTitle: "Current role/title", organisation: "Organisation", sector: "Sector", expertise: "Areas of expertise",
  yearsExperience: "Years of experience", languages: "Languages", programInterests: "Program interests", bio: "Short bio",
  referralSource: "How they heard about us", wantsCollective: "Considered for The Collective", primaryDomain: "Primary domain",
  markets: "Markets", mandate: "Mandate description", availability: "Availability",
};
export const CORPORATE_FIELD_LABELS: Record<string, string> = {
  legalName: "Legal name", tradingName: "Trading name", registrationNo: "Registration number", country: "Country of incorporation",
  hqCity: "HQ city", website: "Website", sector: "Industry/sector", sizeBand: "Company size", yearFounded: "Year founded",
  description: "Description", markets: "Markets of operation", interests: "Areas of interest", contactName: "Primary contact",
  contactTitle: "Job title", contactEmail: "Work email", contactPhone: "Phone", contactLinkedin: "LinkedIn",
  billingName: "Billing contact", billingEmail: "Billing email",
};

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const keys = Array.from(rows.reduce((s, r) => { Object.keys(r).forEach(k => s.add(k)); return s; }, new Set<string>()));
  const esc = (v: unknown) => {
    const s = Array.isArray(v) ? v.join("; ") : v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  return [keys.join(","), ...rows.map(r => keys.map(k => esc(r[k])).join(","))].join("\n");
}
export function downloadCsv(name: string, rows: Record<string, unknown>[]) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
