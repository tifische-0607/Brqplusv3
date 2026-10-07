import { createServerFn } from "@tanstack/react-start";

type PublicMember = {
  id: string;
  name: string;
  role: string;
  expertise: string[];
  markets: string[];
  availability: "available" | "limited" | "unavailable" | "not_deployed";
  bio: string | null;
  avatar_url: string | null;
  linkedin_url: string | null;
  mission_count: number;
};

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const listPublicCollective = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("fractional_executives")
    .select("id, name, role, expertise, markets, availability, bio, avatar_path, linkedin_url")
    .limit(200);
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const execIds = rows.map((r: any) => r.id);
  let missionCounts: Record<string, number> = {};
  if (execIds.length > 0) {
    const { data: meData, error: meErr } = await supabaseAdmin
      .from("mission_experts")
      .select("executive_id")
      .in("executive_id", execIds);
    if (meErr) throw new Error(meErr.message);
    for (const row of (meData ?? [])) {
      missionCounts[row.executive_id] = (missionCounts[row.executive_id] ?? 0) + 1;
    }
  }

  const withUrls: PublicMember[] = await Promise.all(
    rows.map(async (r: any) => {
      let avatar_url: string | null = null;
      if (r.avatar_path) {
        const { data: signed } = await supabaseAdmin.storage
          .from("executive-avatars")
          .createSignedUrl(r.avatar_path, 3600);
        avatar_url = signed?.signedUrl ?? null;
      }
      return {
        id: r.id,
        name: r.name,
        role: r.role,
        expertise: r.expertise ?? [],
        markets: r.markets ?? [],
        availability: r.availability,
        bio: r.bio,
        avatar_url,
        linkedin_url: r.linkedin_url ?? null,
        mission_count: missionCounts[r.id] ?? 0,
      };
    }),
  );

  return { members: shuffle(withUrls) };
});
