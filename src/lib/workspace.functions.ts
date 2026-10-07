import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MISSION_TYPES = [
  "Enterprise Advisory",
  "BFR Transformation",
  "Ummah Impact / Digital Inclusion",
] as const;

const DOC_CATEGORIES = ["Brief", "Regulatory", "Financial Model", "Report", "Other"] as const;

export type MyMission = {
  id: string;
  title: string;
  mission_type: string | null;
  status: string;
  priority: string;
  brief: string | null;
  estimated_timeline: string | null;
  estimated_fee: string | null;
  description: string | null;
  updated_at: string;
  created_at: string;
  members: { user_id: string; full_name: string | null; initials: string | null; avatar_color: string | null; role: string }[];
  last_activity_at: string;
};

export const listMyMissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ missions: MyMission[] }> => {
    const { userId: _userId } = context as any;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // All authenticated members can see every mission.
    const { data: missions, error } = await supabaseAdmin
      .from("missions")
      .select("id, title, mission_type, status, priority, brief, estimated_timeline, estimated_fee, description, client_id, created_at, updated_at")
      .order("priority", { ascending: true })
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    const allIds = (missions ?? []).map((m: any) => m.id);
    if (allIds.length === 0) return { missions: [] };


    // Members per mission (mission_members + client + execs)
    const { data: mm } = await supabaseAdmin
      .from("mission_members")
      .select("mission_id, user_id, role, profiles:profiles!mission_members_user_id_fkey(full_name, initials, avatar_color)")
      .in("mission_id", allIds);

    const { data: me } = await supabaseAdmin
      .from("mission_experts")
      .select("mission_id, executive:fractional_executives!mission_experts_executive_id_fkey(user_id, profile:profiles!fractional_executives_user_id_fkey(full_name, initials, avatar_color))")
      .in("mission_id", allIds);

    const clientByMission: Record<string, { user_id: string; full_name: string | null; initials: string | null; avatar_color: string | null } | null> = {};
    const clientIds = Array.from(new Set(((missions ?? []) as any[]).map((m) => m.client_id).filter(Boolean)));
    if (clientIds.length > 0) {
      const { data: clientProfiles } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, initials, avatar_color")
        .in("id", clientIds);
      const profMap: Record<string, any> = {};
      for (const p of clientProfiles ?? []) profMap[(p as any).id] = p;
      for (const m of (missions ?? []) as any[]) {
        const cid = m.client_id;
        if (cid && profMap[cid]) {
          clientByMission[m.id] = {
            user_id: cid,
            full_name: profMap[cid].full_name ?? null,
            initials: profMap[cid].initials ?? null,
            avatar_color: profMap[cid].avatar_color ?? null,
          };
        }
      }
    }

    const membersByMission: Record<string, MyMission["members"]> = {};
    const seen: Record<string, Set<string>> = {};
    function addMember(missionId: string, m: MyMission["members"][number]) {
      const set = (seen[missionId] ||= new Set());
      if (set.has(m.user_id)) return;
      set.add(m.user_id);
      (membersByMission[missionId] ||= []).push(m);
    }
    for (const row of (mm ?? []) as any[]) {
      addMember(row.mission_id, {
        user_id: row.user_id,
        full_name: row.profiles?.full_name ?? null,
        initials: row.profiles?.initials ?? null,
        avatar_color: row.profiles?.avatar_color ?? null,
        role: row.role,
      });
    }
    for (const row of (me ?? []) as any[]) {
      const uid = row.executive?.user_id;
      if (!uid) continue;
      addMember(row.mission_id, {
        user_id: uid,
        full_name: row.executive?.profile?.full_name ?? null,
        initials: row.executive?.profile?.initials ?? null,
        avatar_color: row.executive?.profile?.avatar_color ?? null,
        role: "operator",
      });
    }
    for (const [missionId, c] of Object.entries(clientByMission)) {
      if (!c) continue;
      addMember(missionId, { ...c, role: "client" });
    }

    // Latest message timestamp per mission for "last activity"
    const { data: channels } = await supabaseAdmin
      .from("channels")
      .select("id, mission_id")
      .in("mission_id", allIds);
    const channelIdToMission: Record<string, string> = {};
    for (const c of channels ?? []) channelIdToMission[(c as any).id] = (c as any).mission_id;

    const lastActivity: Record<string, string> = {};
    const chanIds = Object.keys(channelIdToMission);
    if (chanIds.length > 0) {
      const { data: msgs } = await supabaseAdmin
        .from("messages")
        .select("channel_id, created_at")
        .in("channel_id", chanIds)
        .order("created_at", { ascending: false })
        .limit(500);
      for (const m of msgs ?? []) {
        const mid = channelIdToMission[(m as any).channel_id];
        if (mid && !lastActivity[mid]) lastActivity[mid] = (m as any).created_at;
      }
    }

    return {
      missions: (missions ?? []).map((m: any) => ({
        id: m.id,
        title: m.title,
        mission_type: m.mission_type,
        status: m.status,
        priority: m.priority ?? "P3",
        brief: m.brief,
        estimated_timeline: m.estimated_timeline ?? null,
        estimated_fee: m.estimated_fee ?? null,
        description: m.description,
        created_at: m.created_at,
        updated_at: m.updated_at,
        members: membersByMission[m.id] ?? [],
        last_activity_at: lastActivity[m.id] ?? m.updated_at,
      })),
    };
  });

export const getMission = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const r = z.object({ id: z.string().uuid() }).safeParse(d);
    if (!r.success) throw new Response("Invalid mission id", { status: 400 });
    return r.data;
  })
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Access check via is_mission_member RPC (or admin)
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
    // All authenticated members have access to every mission workspace; no membership gate.


    const { data: mission, error } = await supabaseAdmin
      .from("missions")
      .select("id, title, mission_type, status, brief, description, country, customer, client_id, lead_executive_id, target_days, contract_fee, contract_currency, created_at, updated_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!mission) throw new Error("Mission not found");

    const { data: channelRow } = await supabaseAdmin
      .from("channels")
      .select("id")
      .eq("mission_id", data.id)
      .maybeSingle();

    const { data: mm } = await supabaseAdmin
      .from("mission_members")
      .select("user_id, role, profiles:profiles!mission_members_user_id_fkey(id, full_name, initials, avatar_color)")
      .eq("mission_id", data.id);

    const { data: me } = await supabaseAdmin
      .from("mission_experts")
      .select("executive:fractional_executives!mission_experts_executive_id_fkey(user_id, profile:profiles!fractional_executives_user_id_fkey(full_name, initials, avatar_color))")
      .eq("mission_id", data.id);

    let clientProfile: any = null;
    if ((mission as any).client_id) {
      const { data: cp } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, initials, avatar_color")
        .eq("id", (mission as any).client_id)
        .maybeSingle();
      clientProfile = cp;
    }

    type Member = { user_id: string; role: string; full_name: string | null; initials: string | null; avatar_color: string | null };
    const merged: Member[] = [];
    const seen = new Set<string>();
    function addMember(m: Member) {
      if (seen.has(m.user_id)) return;
      seen.add(m.user_id);
      merged.push(m);
    }
    for (const r of (mm ?? []) as any[]) {
      addMember({
        user_id: r.user_id,
        role: r.role,
        full_name: r.profiles?.full_name ?? null,
        initials: r.profiles?.initials ?? null,
        avatar_color: r.profiles?.avatar_color ?? null,
      });
    }
    for (const r of (me ?? []) as any[]) {
      const uid = r.executive?.user_id;
      if (!uid) continue;
      addMember({
        user_id: uid,
        role: "operator",
        full_name: r.executive?.profile?.full_name ?? null,
        initials: r.executive?.profile?.initials ?? null,
        avatar_color: r.executive?.profile?.avatar_color ?? null,
      });
    }
    if (clientProfile) {
      addMember({
        user_id: clientProfile.id,
        role: "client",
        full_name: clientProfile.full_name ?? null,
        initials: clientProfile.initials ?? null,
        avatar_color: clientProfile.avatar_color ?? null,
      });
    }

    // Determine current user's role on this mission
    let myRole: "client" | "operator" | "brqplus_lead" | "admin" | "viewer" = "viewer";
    if (isAdmin) myRole = "admin";
    else if (mission.client_id === userId) myRole = "client";
    else {
      const found = (mm ?? []).find((r: any) => r.user_id === userId);
      if (found) myRole = found.role as typeof myRole;
      else {
        const myExec = (me ?? []).find((r: any) => r.executive?.user_id === userId);
        if (myExec) myRole = "operator";
      }
    }

    const { ndaBlocksUser } = await import("./nda.server");
    const nda_blocked = await ndaBlocksUser(data.id, userId);

    return {
      mission,
      nda_blocked,
      channel_id: channelRow?.id ?? null,
      members: merged,
      my_role: myRole as "client" | "operator" | "brqplus_lead" | "admin" | "viewer",
    };
  });

export const listMissionDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ mission_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // All authenticated members can read mission documents, once they have signed the mission NDA (if any).
    const { assertNdaCleared } = await import("./nda.server");
    await assertNdaCleared(data.mission_id, (context as any).userId);


    const { data: docs, error } = await supabaseAdmin
      .from("documents")
      .select("id, mission_id, uploaded_by, file_name, file_size, file_type, storage_path, category, created_at")
      .eq("mission_id", data.mission_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const uploaderIds = Array.from(new Set((docs ?? []).map((d) => d.uploaded_by).filter(Boolean) as string[]));
    let profilesById: Record<string, { full_name: string | null; initials: string | null; avatar_color: string | null }> = {};
    if (uploaderIds.length > 0) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, initials, avatar_color")
        .in("id", uploaderIds);
      profilesById = Object.fromEntries((profs ?? []).map((p) => [p.id, { full_name: p.full_name, initials: p.initials, avatar_color: p.avatar_color }]));
    }

    return {
      documents: (docs ?? []).map((d) => ({
        ...d,
        uploader: d.uploaded_by ? profilesById[d.uploaded_by] ?? null : null,
      })),
    };
  });

export const uploadMissionDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        mission_id: z.string().uuid(),
        file_name: z.string().min(1).max(255),
        file_size: z.number().int().min(1).max(50 * 1024 * 1024),
        file_type: z.string().min(1).max(255),
        category: z.enum(DOC_CATEGORIES),
        file_base64: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // All authenticated members can upload to any mission workspace, once they have signed the mission NDA (if any).
    const { assertNdaCleared } = await import("./nda.server");
    await assertNdaCleared(data.mission_id, userId);


    // Decode base64
    const buffer = Buffer.from(data.file_base64, "base64");
    if (buffer.length !== data.file_size) {
      // Soft check; trust decoded length
    }

    // Generate document id and storage path
    const docId = crypto.randomUUID();
    // Sanitize file name and de-duplicate
    let safeName = data.file_name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const { data: existing } = await supabaseAdmin
      .from("documents")
      .select("id")
      .eq("mission_id", data.mission_id)
      .eq("file_name", safeName)
      .maybeSingle();
    let renamed = false;
    if (existing) {
      const ts = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const dot = safeName.lastIndexOf(".");
      safeName = dot > 0 ? `${safeName.slice(0, dot)}_${ts}${safeName.slice(dot)}` : `${safeName}_${ts}`;
      renamed = true;
    }
    const storagePath = `${data.mission_id}/${docId}/${safeName}`;

    const { error: upErr } = await supabaseAdmin.storage
      .from("mission-documents")
      .upload(storagePath, buffer, { contentType: data.file_type, upsert: false });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

    const { data: row, error } = await supabaseAdmin
      .from("documents")
      .insert({
        id: docId,
        mission_id: data.mission_id,
        uploaded_by: userId,
        file_name: safeName,
        file_size: buffer.length,
        file_type: data.file_type,
        storage_path: storagePath,
        category: data.category,
      })
      .select()
      .single();
    if (error) {
      await supabaseAdmin.storage.from("mission-documents").remove([storagePath]);
      throw new Error(error.message);
    }

    // Post system message to the mission channel
    const { data: channelRow } = await supabaseAdmin
      .from("channels")
      .select("id")
      .eq("mission_id", data.mission_id)
      .maybeSingle();
    if (channelRow?.id) {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle();
      const who = prof?.full_name ?? "Someone";
      await supabaseAdmin.from("messages").insert({
        user_id: userId,
        channel_id: channelRow.id,
        content: `📎 ${who} added ${safeName} to the repository.`,
      });
    }

    return { document: row, renamed };
  });

export const signMissionDocumentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ document_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context: _context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: doc } = await supabaseAdmin
      .from("documents")
      .select("mission_id, storage_path, file_name")
      .eq("id", data.document_id)
      .maybeSingle();
    if (!doc) throw new Error("Document not found");
    // All authenticated members can download mission documents, once they have signed the mission NDA (if any).
    const { assertNdaCleared } = await import("./nda.server");
    await assertNdaCleared((doc as any).mission_id, (_context as any).userId);

    const { data: signed, error } = await supabaseAdmin.storage
      .from("mission-documents")
      .createSignedUrl((doc as any).storage_path, 60 * 5, { download: (doc as any).file_name });
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });

export const updateMissionDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        document_id: z.string().uuid(),
        file_name: z.string().min(1).max(255).optional(),
        category: z.enum(DOC_CATEGORIES).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: doc } = await supabaseAdmin
      .from("documents")
      .select("mission_id, uploaded_by")
      .eq("id", data.document_id)
      .maybeSingle();
    if (!doc) throw new Error("Document not found");
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
    const { data: leadRow } = await supabaseAdmin
      .from("mission_members")
      .select("role")
      .eq("mission_id", (doc as any).mission_id)
      .eq("user_id", userId)
      .maybeSingle();
    const isLead = leadRow?.role === "brqplus_lead";
    if (!isAdmin && !isLead && (doc as any).uploaded_by !== userId) {
      throw new Error("Forbidden");
    }
    const patch: any = {};
    if (data.file_name) patch.file_name = data.file_name.replace(/[^a-zA-Z0-9._-]/g, "_");
    if (data.category) patch.category = data.category;
    if (Object.keys(patch).length === 0) return { ok: true as const };
    const { error } = await supabaseAdmin.from("documents").update(patch).eq("id", data.document_id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteMissionDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ document_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: doc } = await supabaseAdmin
      .from("documents")
      .select("mission_id, uploaded_by, storage_path")
      .eq("id", data.document_id)
      .maybeSingle();
    if (!doc) throw new Error("Document not found");
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
    const { data: leadRow } = await supabaseAdmin
      .from("mission_members")
      .select("role")
      .eq("mission_id", (doc as any).mission_id)
      .eq("user_id", userId)
      .maybeSingle();
    const isLead = leadRow?.role === "brqplus_lead";
    if (!isAdmin && !isLead && (doc as any).uploaded_by !== userId) {
      throw new Error("Forbidden");
    }
    await supabaseAdmin.storage.from("mission-documents").remove([(doc as any).storage_path]);
    const { error } = await supabaseAdmin.from("documents").delete().eq("id", data.document_id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const setMissionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        mission_id: z.string().uuid(),
        status: z.enum(["not_started", "active", "in_review", "completed", "on_hold", "cancelled"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
    const { data: leadRow } = await supabaseAdmin
      .from("mission_members")
      .select("role")
      .eq("mission_id", data.mission_id)
      .eq("user_id", userId)
      .maybeSingle();
    const isLead = leadRow?.role === "brqplus_lead";
    if (!isAdmin && !isLead) throw new Error("Forbidden");
    const { error } = await supabaseAdmin
      .from("missions")
      .update({ status: data.status })
      .eq("id", data.mission_id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const PROJECT_STEPS = [
  { key: "kickoff", label: "Kickoff" },
  { key: "discovery", label: "Discovery" },
  { key: "strategy", label: "Strategy" },
  { key: "execution", label: "Execution" },
  { key: "review", label: "Review" },
  { key: "delivery", label: "Delivery" },
] as const;

export type ProjectStepStatus = "not_started" | "in_progress" | "blocked" | "completed";

export const listProjectSteps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ mission_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("mission_project_steps")
      .select("step_key, status, position, updated_at, updated_by")
      .eq("mission_id", data.mission_id);
    if (error) throw new Error(error.message);
    const byKey = new Map<string, any>((rows ?? []).map((r: any) => [r.step_key, r]));
    const steps = PROJECT_STEPS.map((s, i) => {
      const r = byKey.get(s.key);
      return {
        key: s.key,
        label: s.label,
        position: i,
        status: (r?.status ?? "not_started") as ProjectStepStatus,
        updated_at: r?.updated_at ?? null,
        updated_by: r?.updated_by ?? null,
      };
    });
    return { steps };
  });

export const setProjectStepStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        mission_id: z.string().uuid(),
        step_key: z.enum(["kickoff", "discovery", "strategy", "execution", "review", "delivery"]),
        status: z.enum(["not_started", "in_progress", "blocked", "completed"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const position = PROJECT_STEPS.findIndex((s) => s.key === data.step_key);
    const { error } = await supabaseAdmin
      .from("mission_project_steps")
      .upsert(
        {
          mission_id: data.mission_id,
          step_key: data.step_key,
          status: data.status,
          position,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "mission_id,step_key" },
      );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
