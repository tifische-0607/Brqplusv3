import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type InsightSummary = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  domain: string | null;
  cover_image_url: string | null;
  published_at: string | null;
  author: { id: string; full_name: string | null } | null;
};

export type InsightFull = InsightSummary & {
  content: string;
  published: boolean;
};

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

// ---------- Member-facing reads ----------

export const listPublishedInsights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ insights: InsightSummary[] }> => {
    const { supabase } = context as any;
    const { data, error } = await supabase
      .from("insights")
      .select("id, title, slug, excerpt, domain, cover_image_url, published_at, author:profiles!insights_author_id_fkey(id, full_name)")
      .eq("published", true)
      .order("published_at", { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);
    return { insights: (data ?? []) as any };
  });

export const getInsightBySlug = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ slug: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }): Promise<{ insight: InsightFull | null; related: InsightSummary[] }> => {
    const { supabase } = context as any;
    const { data: row, error } = await supabase
      .from("insights")
      .select("id, title, slug, content, excerpt, domain, cover_image_url, published, published_at, author:profiles!insights_author_id_fkey(id, full_name)")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { insight: null, related: [] };

    let related: InsightSummary[] = [];
    if (row.published && row.domain) {
      const { data: rel } = await supabase
        .from("insights")
        .select("id, title, slug, excerpt, domain, cover_image_url, published_at, author:profiles!insights_author_id_fkey(id, full_name)")
        .eq("published", true)
        .eq("domain", row.domain)
        .neq("id", row.id)
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(3);
      related = (rel ?? []) as any;
    }
    return { insight: row as any, related };
  });

export const listLatestAnnouncements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ limit: z.number().int().min(1).max(20).default(3) }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { data: rows, error } = await supabase
      .from("announcements")
      .select("id, title, body, audience, published_at")
      .order("published_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return { announcements: rows ?? [] };
  });

// ---------- Admin CRUD ----------

const insightInputSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(2).max(200),
  slug: z.string().min(2).max(120).optional(),
  excerpt: z.string().max(300).nullable().optional(),
  content: z.string().default(""),
  domain: z.string().max(80).nullable().optional(),
  cover_image_url: z.string().url().nullable().optional(),
  author_id: z.string().uuid().nullable().optional(),
  published: z.boolean().default(false),
  published_at: z.string().nullable().optional(),
});

export const listAllInsightsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) return { insights: [], forbidden: true as const };
    const { data, error } = await supabase
      .from("insights")
      .select("id, title, slug, domain, published, published_at, updated_at, author:profiles!insights_author_id_fkey(id, full_name)")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { insights: data ?? [] };
  });

export const upsertInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => insightInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");

    const slug = data.slug?.trim() || slugify(data.title);
    const published_at =
      data.published && !data.published_at ? new Date().toISOString() : data.published_at ?? null;

    const payload = {
      title: data.title,
      slug,
      excerpt: data.excerpt ?? null,
      content: data.content ?? "",
      domain: data.domain ?? null,
      cover_image_url: data.cover_image_url ?? null,
      author_id: data.author_id ?? userId,
      published: data.published,
      published_at,
    };

    if (data.id) {
      const { error } = await supabase.from("insights").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    } else {
      const { data: row, error } = await supabase.from("insights").insert(payload).select("id").single();
      if (error) throw new Error(error.message);
      return { id: row.id as string };
    }
  });

export const deleteInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await supabase.from("insights").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Announcements admin CRUD ----------

const announcementSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(2).max(200),
  body: z.string().min(1),
  audience: z.enum(["all", "members", "admins"]).default("all"),
  published_at: z.string().optional(),
});

export const listAnnouncementsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) return { announcements: [], forbidden: true as const };
    const { data, error } = await supabase
      .from("announcements")
      .select("id, title, body, audience, published_at, created_at")
      .order("published_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { announcements: data ?? [] };
  });

export const upsertAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => announcementSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");

    const payload = {
      title: data.title,
      body: data.body,
      audience: data.audience,
      published_at: data.published_at ?? new Date().toISOString(),
      created_by: userId,
    };

    if (data.id) {
      const { error } = await supabase.from("announcements").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    } else {
      const { data: row, error } = await supabase.from("announcements").insert(payload).select("id").single();
      if (error) throw new Error(error.message);
      return { id: row.id as string };
    }
  });

export const deleteAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await supabase.from("announcements").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
