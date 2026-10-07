import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Hash, Plus, Send, Trash2, Users, X, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listMyChannels,
  listChannelMembers,
  listChannelMessages,
  createMissionChannel,
  deleteMissionChannel,
  getIsAdmin,
  getOrCreateDmChannel,
  searchProfiles,
  sendChannelMessage,
  getUnreadCounts,
  markChannelRead,
  GENERAL_CHANNEL_ID,
  type ChannelSummary,
} from "@/lib/chat.functions";


export const Route = createFileRoute("/_authenticated/chat")({
  validateSearch: (s: Record<string, unknown>): { c?: string } => (typeof s.c === "string" ? { c: s.c } : {}),
  head: () => ({ meta: [{ title: "Member chat — BRQ+" }] }),
  component: ChatPage,
});

type Member = { id: string; full_name: string | null; avatar_url: string | null };
type Message = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  channel_id: string;
  mentioned_users?: string[] | null;
  profile?: { id: string; full_name: string | null; avatar_url: string | null } | null;
};

function renderMessageContent(content: string, names: Set<string>) {
  // Match @ followed by a name (greedy up to 4 words, then trim to longest known)
  const regex = /@([\p{L}\p{N}'._-]+(?:\s+[\p{L}\p{N}'._-]+){0,3})/gu;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = regex.exec(content)) !== null) {
    const full = m[1];
    // Try to find longest matching known name (prefix match by words)
    const words = full.split(/\s+/);
    let matched = "";
    for (let n = words.length; n > 0; n--) {
      const candidate = words.slice(0, n).join(" ");
      if (names.has(candidate.toLowerCase())) {
        matched = candidate;
        break;
      }
    }
    if (!matched) continue;
    if (m.index > last) parts.push(content.slice(last, m.index));
    parts.push(
      <span
        key={`mention-${key++}`}
        className="rounded bg-cyan/15 px-1 py-0.5 font-semibold text-cyan"
      >
        @{matched}
      </span>,
    );
    last = m.index + 1 + matched.length;
    regex.lastIndex = last;
  }
  if (last < content.length) parts.push(content.slice(last));
  return parts.length > 0 ? parts : content;
}


function channelLabel(c: ChannelSummary): string {
  if (c.type === "dm") return c.other_member?.full_name ?? "Direct message";
  return c.name ?? "Untitled";
}

function ChatPage() {
  const qc = useQueryClient();
  const fetchChannels = useServerFn(listMyChannels);
  const fetchMembers = useServerFn(listChannelMembers);
  const fetchMessages = useServerFn(listChannelMessages);
  const createMission = useServerFn(createMissionChannel);
  const deleteMission = useServerFn(deleteMissionChannel);
  const checkAdmin = useServerFn(getIsAdmin);
  const openDm = useServerFn(getOrCreateDmChannel);
  const search = useServerFn(searchProfiles);
  const sendFn = useServerFn(sendChannelMessage);
  const fetchUnread = useServerFn(getUnreadCounts);
  const markRead = useServerFn(markChannelRead);

  const [userId, setUserId] = useState<string | null>(null);

  const [activeId, setActiveId] = useState<string>(Route.useSearch().c ?? GENERAL_CHANNEL_ID);
  const [content, setContent] = useState("");
  const [missionModal, setMissionModal] = useState(false);
  const [dmModal, setDmModal] = useState(false);
  const [missionName, setMissionName] = useState("");
  const [dmQuery, setDmQuery] = useState("");
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const channelsQ = useQuery({
    queryKey: ["chat", "channels"],
    queryFn: () => fetchChannels(),
  });
  const channels: ChannelSummary[] = channelsQ.data?.channels ?? [];

  const adminQ = useQuery({
    queryKey: ["chat", "is-admin"],
    queryFn: () => checkAdmin(),
  });
  const isAdmin = adminQ.data?.isAdmin === true;



  const active = useMemo(
    () => channels.find((c) => c.id === activeId) ?? null,
    [channels, activeId],
  );

  const messagesQ = useQuery({
    queryKey: ["chat", "messages", activeId],
    queryFn: () => fetchMessages({ data: { channel_id: activeId } }),
    enabled: !!activeId,
  });
  const messages: Message[] = (messagesQ.data?.messages ?? []) as Message[];

  const membersQ = useQuery({
    queryKey: ["chat", "members", activeId],
    queryFn: () => fetchMembers({ data: { channel_id: activeId } }),
    enabled: !!activeId,
  });
  const members = membersQ.data?.members ?? [];

  const unreadQ = useQuery({
    queryKey: ["chat", "unread"],
    queryFn: () => fetchUnread(),
    refetchInterval: 30000,
  });
  const unread: Record<string, number> = unreadQ.data?.counts ?? {};

  // Mark active channel as read when opened / when new messages arrive
  useEffect(() => {
    if (!activeId) return;
    markRead({ data: { channel_id: activeId } })
      .then(() => qc.invalidateQueries({ queryKey: ["chat", "unread"] }))
      .catch(() => {});
  }, [activeId, messages.length, markRead, qc]);

  // Realtime subscription for the active channel only
  useEffect(() => {
    if (!activeId) return;
    const channel = supabase
      .channel(`chat-${activeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${activeId}`,
        },
        async (payload) => {
          const row = payload.new as any;
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, full_name, avatar_url")
            .eq("id", row.user_id)
            .maybeSingle();
          qc.setQueryData(["chat", "messages", activeId], (old: any) => {
            const list: Message[] = old?.messages ?? [];
            if (list.some((m) => m.id === row.id)) return old;
            return { messages: [...list, { ...row, profile: profile ?? null }] };
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeId, qc]);

  // Global subscription to refresh unread counts when any new message arrives
  useEffect(() => {
    const channel = supabase
      .channel("chat-unread")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => {
          qc.invalidateQueries({ queryKey: ["chat", "unread"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  // Auto-scroll
  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight });
  }, [messages.length, activeId]);

  const sendM = useMutation({
    mutationFn: (text: string) => sendFn({ data: { channel_id: activeId, content: text } }),
    onSuccess: () => setContent(""),
  });

  const createMissionM = useMutation({
    mutationFn: (name: string) => createMission({ data: { name } }),
    onSuccess: (res: any) => {
      setMissionModal(false);
      setMissionName("");
      qc.invalidateQueries({ queryKey: ["chat", "channels"] });
      if (res?.channel?.id) setActiveId(res.channel.id);
    },
  });

  const deleteMissionM = useMutation({
    mutationFn: (channelId: string) => deleteMission({ data: { channel_id: channelId } }),
    onSuccess: (_res, channelId) => {
      qc.invalidateQueries({ queryKey: ["chat", "channels"] });
      if (activeId === channelId) setActiveId(GENERAL_CHANNEL_ID);
    },
  });

  const openDmM = useMutation({
    mutationFn: (otherId: string) => openDm({ data: { other_user_id: otherId } }),
    onSuccess: (res: any) => {
      setDmModal(false);
      setDmQuery("");
      qc.invalidateQueries({ queryKey: ["chat", "channels"] });
      if (res?.channel_id) setActiveId(res.channel_id);
    },
  });

  const dmSearchQ = useQuery({
    queryKey: ["chat", "search", dmQuery],
    queryFn: () => search({ data: { q: dmQuery } }),
    enabled: dmModal,
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    sendM.mutate(trimmed);
  }

  const generalChannels = channels.filter((c) => c.type === "general");
  const missionChannels = channels.filter((c) => c.type === "mission");
  const dmChannels = channels.filter((c) => c.type === "dm");

  return (
    <div className="-mx-5 -my-8 grid h-[calc(100vh-4rem)] grid-cols-[240px_1fr_220px] lg:-mx-8">
      {/* Left sidebar */}
      <aside className="flex flex-col overflow-y-auto border-r border-border bg-card/50 p-3">
        <SectionLabel>Channels</SectionLabel>
        <ul className="mb-4 space-y-0.5">
          {generalChannels.map((c) => (
            <ChannelRow
              key={c.id}
              active={c.id === activeId}
              icon={<Hash className="h-4 w-4" />}
              label={channelLabel(c)}
              unread={unread[c.id] ?? 0}
              onClick={() => setActiveId(c.id)}
            />
          ))}
        </ul>

        <SectionLabel
          action={
            <button
              onClick={() => setMissionModal(true)}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
              aria-label="Create mission channel"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          }
        >
          Mission Groups
        </SectionLabel>
        <ul className="mb-4 space-y-0.5">
          {missionChannels.length === 0 && (
            <li className="px-2 py-1 text-xs text-muted-foreground">No mission groups</li>
          )}
          {missionChannels.map((c) => (
            <ChannelRow
              key={c.id}
              active={c.id === activeId}
              icon={<Hash className="h-4 w-4" />}
              label={channelLabel(c)}
              unread={unread[c.id] ?? 0}
              onClick={() => setActiveId(c.id)}
            />
          ))}
        </ul>

        <SectionLabel
          action={
            <button
              onClick={() => setDmModal(true)}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
              aria-label="Start direct message"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          }
        >
          Direct Messages
        </SectionLabel>
        <ul className="space-y-0.5">
          {dmChannels.length === 0 && (
            <li className="px-2 py-1 text-xs text-muted-foreground">No DMs yet</li>
          )}
          {dmChannels.map((c) => (
            <ChannelRow
              key={c.id}
              active={c.id === activeId}
              icon={
                c.other_member?.avatar_url ? (
                  <img
                    src={c.other_member.avatar_url}
                    alt=""
                    className="h-5 w-5 rounded-full object-cover"
                  />
                ) : (
                  <MessageSquare className="h-4 w-4" />
                )
              }
              label={channelLabel(c)}
              unread={unread[c.id] ?? 0}
              onClick={() => setActiveId(c.id)}
            />
          ))}
        </ul>
      </aside>

      {/* Center: messages */}
      <section className="flex min-w-0 flex-col">
        <header className="flex h-12 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2 text-foreground">
            {active?.type === "dm" ? (
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Hash className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="font-semibold">{active ? channelLabel(active) : "Channel"}</span>
          </div>
          {isAdmin && active?.type === "mission" && (
            <button
              type="button"
              className="flex items-center gap-1.5 rounded border border-destructive/30 px-2 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
              disabled={deleteMissionM.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    `Delete mission group "${channelLabel(active)}"? All messages will be permanently removed.`,
                  )
                ) {
                  deleteMissionM.mutate(active.id);
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {deleteMissionM.isPending ? "Deleting…" : "Delete group"}
            </button>
          )}
        </header>


        <div ref={scrollerRef} className="flex-1 overflow-y-auto px-4 py-4">
          {messagesQ.isLoading && (
            <p className="text-sm text-muted-foreground">Loading messages…</p>
          )}
          {!messagesQ.isLoading && messages.length === 0 && (
            <p className="text-sm text-muted-foreground">No messages yet — say hello.</p>
          )}
          <ul className="space-y-3">
            {messages.map((m) => {
              const mine = m.user_id === userId;
              const name = m.profile?.full_name ?? "Member";
              const pinged = !!(userId && m.mentioned_users?.includes(userId));
              const memberNames = new Set(
                (members as Member[])
                  .map((mm) => mm.full_name?.toLowerCase())
                  .filter((x): x is string => !!x),
              );
              return (
                <li
                  key={m.id}
                  className={
                    "flex gap-3 rounded-md px-2 py-1.5 " +
                    (pinged ? "bg-cyan/10 ring-1 ring-cyan/30" : "")
                  }
                >
                  {m.profile?.avatar_url ? (
                    <img
                      src={m.profile.avatar_url}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold">
                      {name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">
                      <span className={"font-semibold " + (mine ? "text-cyan" : "text-foreground")}>
                        {name}
                      </span>{" "}
                      ·{" "}
                      {new Date(m.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                    <div className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">
                      {renderMessageContent(m.content, memberNames)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <MessageComposer
          members={members as Member[]}
          value={content}
          onChange={setContent}
          onSubmit={onSubmit}
          disabled={sendM.isPending}
          placeholder={`Message ${active ? channelLabel(active) : "…"}`}
        />
        {sendM.error instanceof Error && (
          <p className="border-t border-destructive/30 bg-destructive/5 px-4 py-2 text-xs text-destructive">
            {sendM.error.message}
          </p>
        )}
      </section>


      {/* Right sidebar: members */}
      <aside className="overflow-y-auto border-l border-border bg-card/30 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Users className="h-3.5 w-3.5" /> Members · {members.length}
        </div>
        <ul className="space-y-1.5">
          {members.map((m: any) => (
            <li key={m.id} className="flex items-center gap-2">
              {m.avatar_url ? (
                <img src={m.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />
              ) : (
                <div className="grid h-6 w-6 place-items-center rounded-full bg-secondary text-[10px] font-semibold">
                  {(m.full_name ?? "?").charAt(0).toUpperCase()}
                </div>
              )}
              <span className="truncate text-sm text-foreground">
                {m.full_name ?? "Member"}
              </span>
            </li>
          ))}
        </ul>
      </aside>

      {/* Mission group modal */}
      {missionModal && (
        <Modal title="New mission group" onClose={() => setMissionModal(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (missionName.trim()) createMissionM.mutate(missionName.trim());
            }}
            className="space-y-3"
          >
            <input
              autoFocus
              value={missionName}
              onChange={(e) => setMissionName(e.target.value)}
              placeholder="Group name (e.g. Acme launch)"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMissionModal(false)}
                className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!missionName.trim() || createMissionM.isPending}
                className="rounded-md bg-cyan px-3 py-2 text-xs font-semibold text-navy disabled:opacity-60"
              >
                {createMissionM.isPending ? "Creating…" : "Create"}
              </button>
            </div>
            {createMissionM.error instanceof Error && (
              <p className="text-xs text-destructive">{createMissionM.error.message}</p>
            )}
          </form>
        </Modal>
      )}

      {/* DM modal */}
      {dmModal && (
        <Modal title="Start a direct message" onClose={() => setDmModal(false)}>
          <input
            autoFocus
            value={dmQuery}
            onChange={(e) => setDmQuery(e.target.value)}
            placeholder="Search members by name…"
            className="mb-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {(dmSearchQ.data?.profiles ?? []).map((p: any) => (
              <li key={p.id}>
                <button
                  onClick={() => openDmM.mutate(p.id)}
                  disabled={openDmM.isPending}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground hover:bg-secondary"
                >
                  {p.avatar_url ? (
                    <img
                      src={p.avatar_url}
                      alt=""
                      className="h-7 w-7 rounded-full object-cover"
                    />
                  ) : (
                    <div className="grid h-7 w-7 place-items-center rounded-full bg-secondary text-xs font-semibold">
                      {(p.full_name ?? "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="truncate">{p.full_name ?? "Member"}</span>
                </button>
              </li>
            ))}
            {dmSearchQ.isSuccess && (dmSearchQ.data?.profiles ?? []).length === 0 && (
              <li className="px-2 py-1 text-xs text-muted-foreground">No members found</li>
            )}
          </ul>
          {openDmM.error instanceof Error && (
            <p className="mt-2 text-xs text-destructive">{openDmM.error.message}</p>
          )}
        </Modal>
      )}
    </div>
  );
}

function SectionLabel({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-1 flex items-center justify-between px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      <span>{children}</span>
      {action}
    </div>
  );
}

function ChannelRow({
  active,
  icon,
  label,
  unread = 0,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  unread?: number;
  onClick: () => void;
}) {
  const hasUnread = unread > 0 && !active;
  return (
    <li>
      <button
        onClick={onClick}
        className={
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition " +
          (active
            ? "bg-secondary text-foreground"
            : hasUnread
              ? "text-foreground hover:bg-secondary/50"
              : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground")
        }
      >
        <span className="shrink-0">{icon}</span>
        <span className={"flex-1 truncate " + (hasUnread ? "font-semibold" : "")}>{label}</span>
        {hasUnread && (
          <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-cyan px-1.5 text-[10px] font-bold text-navy">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
    </li>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-border bg-card p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-foreground">{title}</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function MessageComposer({
  members,
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder,
}: {
  members: Member[];
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number>(-1);
  const [highlight, setHighlight] = useState(0);

  const matches = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return members
      .filter((m) => m.full_name && m.full_name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [mentionQuery, members]);

  useEffect(() => {
    setHighlight(0);
  }, [mentionQuery]);

  function detectMention(text: string, caret: number) {
    // Find nearest @ before caret with no whitespace between
    const upto = text.slice(0, caret);
    const at = upto.lastIndexOf("@");
    if (at < 0) return null;
    // Must be at start or preceded by whitespace
    if (at > 0 && !/\s/.test(upto.charAt(at - 1))) return null;
    const between = upto.slice(at + 1);
    if (/\s/.test(between)) return null;
    return { start: at, query: between };
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    onChange(v);
    const caret = e.target.selectionStart ?? v.length;
    const m = detectMention(v, caret);
    if (m) {
      setMentionStart(m.start);
      setMentionQuery(m.query);
    } else {
      setMentionQuery(null);
      setMentionStart(-1);
    }
  }

  function insertMention(member: Member) {
    if (!member.full_name || mentionStart < 0) return;
    const before = value.slice(0, mentionStart);
    const caret = inputRef.current?.selectionStart ?? value.length;
    const after = value.slice(caret);
    const inserted = `@${member.full_name} `;
    const next = before + inserted + after;
    onChange(next);
    setMentionQuery(null);
    setMentionStart(-1);
    requestAnimationFrame(() => {
      const pos = (before + inserted).length;
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(pos, pos);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionQuery !== null && matches.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => (h + 1) % matches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => (h - 1 + matches.length) % matches.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(matches[highlight]);
        return;
      }
      if (e.key === "Escape") {
        setMentionQuery(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e as unknown as FormEvent);
    }
  }

  return (
    <form onSubmit={onSubmit} className="relative flex gap-2 border-t border-border bg-card/30 p-3">
      {mentionQuery !== null && matches.length > 0 && (
        <div className="absolute bottom-full left-3 right-3 z-20 mb-1 max-h-56 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-lg">
          {matches.map((m, i) => (
            <button
              type="button"
              key={m.id}
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(m);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={
                "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm " +
                (i === highlight ? "bg-secondary text-foreground" : "text-foreground")
              }
            >
              {m.avatar_url ? (
                <img src={m.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />
              ) : (
                <div className="grid h-6 w-6 place-items-center rounded-full bg-secondary text-[10px] font-semibold">
                  {(m.full_name ?? "?").charAt(0).toUpperCase()}
                </div>
              )}
              <span className="truncate">{m.full_name ?? "Member"}</span>
            </button>
          ))}
        </div>
      )}
      <textarea
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        rows={1}
        placeholder={placeholder}
        className="flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
      />
      <button
        type="submit"
        disabled={!value.trim() || disabled}
        className="inline-flex items-center gap-1.5 rounded-md bg-cyan px-3 py-2 text-sm font-semibold text-navy disabled:opacity-60"
      >
        <Send className="h-4 w-4" /> Send
      </button>
    </form>
  );
}

