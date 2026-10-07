import { useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { addMemberNote } from "@/lib/membership.functions";

export function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <section className="rounded-xl border border-border bg-card p-6">
    <div className="flex items-center justify-between gap-3"><h2 className="font-display text-lg font-bold text-foreground">{title}</h2>{action}</div>
    <div className="mt-4">{children}</div>
  </section>;
}
export function Facts({ items }: { items: [string, unknown][] }) {
  return <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">{items.map(([k, v]) => <div key={k}>
    <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{k}</dt>
    <dd className="mt-0.5 whitespace-pre-wrap break-words text-foreground">{Array.isArray(v) ? (v.length ? v.join(", ") : "—") : v == null || v === "" ? "—" : String(v)}</dd>
  </div>)}</dl>;
}
export function NotesPanel({ subjectType, subjectId, notes, onAdded }: { subjectType: "user" | "company"; subjectId: string; notes: any[]; onAdded: () => void }) {
  const add = useServerFn(addMemberNote);
  const [text, setText] = useState("");
  const m = useMutation({ mutationFn: () => add({ data: { subject_type: subjectType, subject_id: subjectId, note: text } }), onSuccess: () => { setText(""); onAdded(); } });
  return <Panel title="Admin notes (internal)">
    <form onSubmit={e => { e.preventDefault(); if (text.trim()) m.mutate(); }} className="flex gap-2">
      <input value={text} maxLength={4000} onChange={e => setText(e.target.value)} placeholder="Add an internal note" className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none" />
      <button disabled={m.isPending} className="rounded-md border border-gold bg-gold/10 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gold">Add</button>
    </form>
    {m.isError && <p className="mt-2 text-sm text-destructive">{(m.error as Error).message}</p>}
    <ul className="mt-4 space-y-3">{notes.length === 0 ? <li className="text-sm text-muted-foreground">No notes yet.</li> : notes.map(n => <li key={n.id} className="border-l border-gold/40 pl-3 text-sm"><p className="whitespace-pre-wrap text-foreground">{n.note}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p></li>)}</ul>
  </Panel>;
}
export function AuditList({ rows }: { rows: any[] }) {
  return <Panel title="Audit trail">
    <ul className="space-y-2 text-sm">{rows.length === 0 ? <li className="text-muted-foreground">No recorded actions.</li> : rows.map(r => <li key={r.id} className="flex flex-wrap justify-between gap-2 border-b border-border/50 pb-2">
      <span className="text-foreground">{r.action}{r.reason ? <span className="text-muted-foreground"> — {r.reason}</span> : null}</span>
      <span className="text-xs text-muted-foreground">{r.actor_email ?? "system"} · {new Date(r.created_at).toLocaleString()}</span>
    </li>)}</ul>
  </Panel>;
}
