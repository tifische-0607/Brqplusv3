import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const GENERAL_CHANNEL_ID = "00000000-0000-0000-0000-00000000beef";

export type ChannelType = "general" | "mission" | "dm";

export type ChannelSummary = {
  id: string;
  name: string | null;
  type: ChannelType;
  created_at: string;
  // For DM channels, the "other" member's profile so the UI can display their name
  other_member: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

export const listMyChannels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as any;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Membership rows (excluding general — handled separately)
    const { data: memberRows, error: mErr } = await supabaseAdmin
      .from("channel_members")
      .select("channel_id")
      .eq("user_id", userId);
    if (mErr) throw new Error(mErr.message);
    const memberIds = (memberRows ?? []).map((r: any) => r.channel_id);

    const { data: channels, error: cErr } = await supabaseAdmin
      .from("channels")
      .select("id, name, type, created_at")
      .or(
        memberIds.length > 0
          ? `type.eq.general,id.in.(${memberIds.join(",")})`
          : "type.eq.general",
      )
      .order("created_at", { ascending: true });
    if (cErr) throw new Error(cErr.message);

    // For DM channels, fetch the "other" member profile
    const dmIds = (channels ?? []).filter((c: any) => c.type === "dm").map((c: any) => c.id);
    let dmOther: Record<string, { id: string; full_name: string | null; avatar_url: string | null }> = {};
    if (dmIds.length > 0) {
      const { data: dmMembers, error: dmErr } = await supabaseAdmin
        .from("channel_members")
        .select("channel_id, user_id")
        .in("channel_id", dmIds);
      if (dmErr) throw new Error(dmErr.message);

      const otherUserIds = new Set<string>();
      const otherByChannel: Record<string, string> = {};
      for (const row of dmMembers ?? []) {
        if (row.user_id !== userId) {
          otherByChannel[row.channel_id] = row.user_id;
          otherUserIds.add(row.user_id);
        }
      }
      if (otherUserIds.size > 0) {
        const { data: profs, error: pErr } = await supabaseAdmin
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", Array.from(otherUserIds));
        if (pErr) throw new Error(pErr.message);
        const byId = new Map((profs ?? []).map((p: any) => [p.id, p]));
        for (const [chId, otherId] of Object.entries(otherByChannel)) {
          const p = byId.get(otherId);
          if (p) dmOther[chId] = p as any;
        }
      }
    }

    const result: ChannelSummary[] = (channels ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      created_at: c.created_at,
      other_member: c.type === "dm" ? dmOther[c.id] ?? null : null,
    }));

    return { channels: result };
  });

export const listChannelMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ channel_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: channel, error: cErr } = await supabaseAdmin
      .from("channels")
      .select("id, type")
      .eq("id", data.channel_id)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!channel) throw new Error("Channel not found");

    // For general: list all profiles. Otherwise: must be a member.
    if (channel.type !== "general") {
      const { data: meRow, error: meErr } = await supabaseAdmin
        .from("channel_members")
        .select("user_id")
        .eq("channel_id", data.channel_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (meErr) throw new Error(meErr.message);
      if (!meRow) throw new Error("Forbidden: not a member of this channel");
    }

    // Build the set of profile ids that are mapped to the member directory
    // (fractional_executives.user_id). Always include any profile named "Curator".
    const { data: execRows, error: execErr } = await supabaseAdmin
      .from("fractional_executives")
      .select("user_id")
      .not("user_id", "is", null);
    if (execErr) throw new Error(execErr.message);
    const directoryIds = new Set<string>(
      (execRows ?? []).map((r: any) => r.user_id).filter(Boolean),
    );

    if (channel.type === "general") {
      const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, avatar_url")
        .order("full_name", { ascending: true });
      if (error) throw new Error(error.message);
      const filtered = (data ?? []).filter(
        (p: any) =>
          directoryIds.has(p.id) ||
          (p.full_name ?? "").trim().toLowerCase() === "curator",
      );
      return { members: filtered };
    }

    const { data: rows, error } = await supabaseAdmin
      .from("channel_members")
      .select("user_id")
      .eq("channel_id", data.channel_id);
    if (error) throw new Error(error.message);
    const ids = (rows ?? []).map((r: any) => r.user_id);
    if (ids.length === 0) return { members: [] };
    const { data: profs, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", ids);
    if (pErr) throw new Error(pErr.message);
    const filtered = (profs ?? []).filter(
      (p: any) =>
        directoryIds.has(p.id) ||
        (p.full_name ?? "").trim().toLowerCase() === "curator",
    );
    return { members: filtered };
  });


export const listChannelMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ channel_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Access check
    const { data: chan, error: cErr } = await supabaseAdmin
      .from("channels")
      .select("type, mission_id")
      .eq("id", data.channel_id)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!chan) throw new Error("Channel not found");
    if (chan.type !== "general") {
      let allowed = false;
      const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });
      if (isAdmin) allowed = true;
      if (!allowed && chan.mission_id) {
        const { data: ok } = await supabaseAdmin.rpc("is_mission_member", {
          _mission_id: chan.mission_id,
          _user_id: userId,
        });
        allowed = !!ok;
      }
      if (!allowed) {
        const { data: meRow } = await supabaseAdmin
          .from("channel_members")
          .select("user_id")
          .eq("channel_id", data.channel_id)
          .eq("user_id", userId)
          .maybeSingle();
        allowed = !!meRow;
      }
      if (!allowed) throw new Error("Forbidden: not a member of this channel");
    }
    if (chan.mission_id) {
      const { assertNdaCleared } = await import("./nda.server");
      await assertNdaCleared(chan.mission_id, userId);
    }


    const { data: rows, error } = await supabaseAdmin
      .from("messages")
      .select("id, user_id, content, created_at, channel_id, mentioned_users, profile:profiles(id, full_name, avatar_url)")
      .eq("channel_id", data.channel_id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { messages: (rows ?? []).reverse() };
  });

export const createMissionChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ name: z.string().trim().min(1).max(80) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { assertAdmin } = await import("@/lib/authz.server");
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");



    const { data: chan, error } = await supabaseAdmin
      .from("channels")
      .insert({ name: data.name, type: "mission", created_by: userId })
      .select("id, name, type, created_at")
      .single();
    if (error) throw new Error(error.message);

    const { error: mErr } = await supabaseAdmin
      .from("channel_members")
      .insert({ channel_id: chan.id, user_id: userId });
    if (mErr) throw new Error(mErr.message);

    return { channel: chan };
  });

export const deleteMissionChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ channel_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { assertAdmin } = await import("@/lib/authz.server");
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: chan, error: cErr } = await supabaseAdmin
      .from("channels")
      .select("id, type")
      .eq("id", data.channel_id)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!chan) throw new Error("Channel not found");
    if (chan.type !== "mission") throw new Error("Only mission groups can be deleted");

    const { error } = await supabaseAdmin
      .from("channels")
      .delete()
      .eq("id", data.channel_id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const getIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const { data, error } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (error) throw new Error(error.message);
    return { isAdmin: data === true };
  });


export const addMissionChannelMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ channel_id: z.string().uuid(), user_id: z.string().uuid() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Only allow inviting peers to DM channels via this endpoint.
    // Mission/general channel membership is admin-controlled via the
    // mission flows and sync_mission_channel_members.
    const { data: chan, error: cErr } = await supabaseAdmin
      .from("channels")
      .select("id, type")
      .eq("id", data.channel_id)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!chan) throw new Error("Channel not found");
    if (chan.type !== "dm") {
      throw new Error("Forbidden: membership for this channel type is admin-managed");
    }

    // Caller must already be a member of the DM to invite
    const { data: meRow } = await supabaseAdmin
      .from("channel_members")
      .select("user_id")
      .eq("channel_id", data.channel_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!meRow) throw new Error("Forbidden: not a member of this channel");

    const { error } = await supabaseAdmin
      .from("channel_members")
      .upsert(
        { channel_id: data.channel_id, user_id: data.user_id },
        { onConflict: "channel_id,user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const getOrCreateDmChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ other_user_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    if (data.other_user_id === userId) throw new Error("Cannot DM yourself");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Find an existing DM channel containing exactly these two users
    const { data: mineChannels } = await supabaseAdmin
      .from("channel_members")
      .select("channel_id, channels!inner(type)")
      .eq("user_id", userId);
    const myDmIds = (mineChannels ?? [])
      .filter((r: any) => r.channels?.type === "dm")
      .map((r: any) => r.channel_id);

    if (myDmIds.length > 0) {
      const { data: otherRows } = await supabaseAdmin
        .from("channel_members")
        .select("channel_id")
        .in("channel_id", myDmIds)
        .eq("user_id", data.other_user_id);
      const matchId = otherRows?.[0]?.channel_id;
      if (matchId) return { channel_id: matchId as string, created: false };
    }

    const { data: chan, error } = await supabaseAdmin
      .from("channels")
      .insert({ type: "dm", created_by: userId, name: null })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { error: mErr } = await supabaseAdmin
      .from("channel_members")
      .insert([
        { channel_id: chan.id, user_id: userId },
        { channel_id: chan.id, user_id: data.other_user_id },
      ]);
    if (mErr) throw new Error(mErr.message);

    return { channel_id: chan.id as string, created: true };
  });

export const searchProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ q: z.string().trim().max(80).optional().default("") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("profiles")
      .select("id, full_name, avatar_url")
      .neq("id", userId)
      .order("full_name", { ascending: true })
      .limit(50);
    if (data.q) query = query.ilike("full_name", `%${data.q}%`);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return { profiles: rows ?? [] };
  });

export const sendChannelMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        channel_id: z.string().uuid(),
        content: z.string().trim().min(1).max(4000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Access check
    const { data: chan } = await supabaseAdmin
      .from("channels")
      .select("type, mission_id")
      .eq("id", data.channel_id)
      .maybeSingle();
    if (!chan) throw new Error("Channel not found");
    if (chan.mission_id) {
      const { assertNdaCleared } = await import("./nda.server");
      await assertNdaCleared(chan.mission_id, userId);
    }
    if (chan.type !== "general") {
      const { data: meRow } = await supabaseAdmin
        .from("channel_members")
        .select("user_id")
        .eq("channel_id", data.channel_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (!meRow) throw new Error("Forbidden: not a member of this channel");
    }

    // Parse @mentions and resolve to user ids among channel-accessible profiles
    const mentionNames = Array.from(
      new Set(
        Array.from(data.content.matchAll(/@([\p{L}\p{N}'._-]+(?:\s+[\p{L}\p{N}'._-]+)*)/gu))
          .map((m) => m[1].trim())
          .filter(Boolean),
      ),
    );
    let mentioned_users: string[] = [];
    if (mentionNames.length > 0) {
      // Candidate profiles: channel members for non-general, all profiles for general
      let candidates: { id: string; full_name: string | null }[] = [];
      if (chan.type === "general") {
        const { data: profs } = await supabaseAdmin
          .from("profiles")
          .select("id, full_name");
        candidates = profs ?? [];
      } else {
        const { data: rows } = await supabaseAdmin
          .from("channel_members")
          .select("user_id")
          .eq("channel_id", data.channel_id);
        const ids = (rows ?? []).map((r: any) => r.user_id);
        if (ids.length > 0) {
          const { data: profs } = await supabaseAdmin
            .from("profiles")
            .select("id, full_name")
            .in("id", ids);
          candidates = profs ?? [];
        }
      }

      const byName = new Map<string, string>();
      for (const p of candidates) {
        if (p.full_name) byName.set(p.full_name.toLowerCase(), p.id);
      }
      // Greedy match: try longest mention first
      const matched = new Set<string>();
      for (const name of mentionNames.sort((a, b) => b.length - a.length)) {
        const id = byName.get(name.toLowerCase());
        if (id) matched.add(id);
      }
      mentioned_users = Array.from(matched);
    }

    const { data: row, error } = await supabaseAdmin
      .from("messages")
      .insert({
        user_id: userId,
        content: data.content,
        channel_id: data.channel_id,
        mentioned_users,
      })
      .select("id, user_id, content, created_at, channel_id, mentioned_users")
      .single();
    if (error) throw new Error(error.message);


    // Mark the channel as read for the sender
    await supabaseAdmin
      .from("channel_reads")
      .upsert(
        { user_id: userId, channel_id: data.channel_id, last_read_at: new Date().toISOString() },
        { onConflict: "user_id,channel_id" },
      );

    return { message: row };
  });

export const getUnreadCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as any;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: memberRows } = await supabaseAdmin
      .from("channel_members")
      .select("channel_id")
      .eq("user_id", userId);
    const memberIds = (memberRows ?? []).map((r: any) => r.channel_id);

    const { data: channels } = await supabaseAdmin
      .from("channels")
      .select("id")
      .or(
        memberIds.length > 0
          ? `type.eq.general,id.in.(${memberIds.join(",")})`
          : "type.eq.general",
      );
    const channelIds = (channels ?? []).map((c: any) => c.id);
    if (channelIds.length === 0) return { counts: {} as Record<string, number> };

    const { data: reads } = await supabaseAdmin
      .from("channel_reads")
      .select("channel_id, last_read_at")
      .eq("user_id", userId)
      .in("channel_id", channelIds);
    const readMap = new Map<string, string>(
      (reads ?? []).map((r: any) => [r.channel_id, r.last_read_at]),
    );

    const counts: Record<string, number> = {};
    await Promise.all(
      channelIds.map(async (cid: string) => {
        let q = supabaseAdmin
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("channel_id", cid)
          .neq("user_id", userId);
        const lastRead = readMap.get(cid);
        if (lastRead) q = q.gt("created_at", lastRead);
        const { count } = await q;
        counts[cid] = count ?? 0;
      }),
    );
    return { counts };
  });

export const markChannelRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ channel_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("channel_reads")
      .upsert(
        { user_id: userId, channel_id: data.channel_id, last_read_at: new Date().toISOString() },
        { onConflict: "user_id,channel_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
