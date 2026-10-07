import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listBillingMilestones,
  saveContractFee,
  issueInvoice,
  markMilestonePaid,
  recordSignoff,
  type BillingMilestone,
  type ContractInfo,
} from "@/lib/billing.functions";
import {
  formatMoney,
  formatMoneyAbbr,
  formatDate,
  today,
  addDays,
  type Currency,
} from "@/lib/billing-format";

type Role = "client" | "operator" | "brqplus_lead";
type Props = { missionId: string; userRole: Role; missionTitle: string };

const CURRENCIES: Currency[] = ["MYR", "SGD", "USD", "IDR", "AED"];

const STATUS_BADGE: Record<BillingMilestone["status"], { cls: string; label: string }> = {
  locked: { cls: "bg-muted/40 text-muted-foreground border-border", label: "Locked" },
  due: { cls: "bg-amber-500/15 text-amber-500 border-amber-500/40", label: "Due" },
  invoiced: { cls: "bg-cyan/15 text-cyan border-cyan/40", label: "Invoiced" },
  paid: { cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/40", label: "Paid" },
  overdue: { cls: "bg-red-500/15 text-red-500 border-red-500/40", label: "Overdue" },
};

const NODE_DOT: Record<BillingMilestone["status"], string> = {
  paid: "bg-foreground border-2 border-card",
  due: "bg-amber-500/30 border-2 border-amber-500",
  invoiced: "bg-cyan/30 border-2 border-cyan",
  overdue: "bg-red-500/30 border-2 border-red-500",
  locked: "bg-muted border border-border",
};

const AMOUNT_COLOR: Record<BillingMilestone["status"], string> = {
  paid: "text-emerald-500",
  due: "text-amber-500",
  invoiced: "text-amber-500",
  overdue: "text-red-500",
  locked: "text-muted-foreground",
};

function getMilestonePosition(m: BillingMilestone): number {
  if (m.milestone_key === "signoff") return 100;
  return m.trigger_pct ?? 0;
}

export function BillingPanel({ missionId, userRole }: Props) {
  const qc = useQueryClient();
  const fetchList = useServerFn(listBillingMilestones);
  const q = useQuery({
    queryKey: ["billing", missionId],
    queryFn: () => fetchList({ data: { mission_id: missionId } }),
  });

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`billing-${missionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "billing_milestones", filter: `mission_id=eq.${missionId}` },
        () => qc.invalidateQueries({ queryKey: ["billing", missionId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [missionId, qc]);

  const [contractOpen, setContractOpen] = useState(false);
  const [issueFor, setIssueFor] = useState<BillingMilestone | null>(null);
  const [paidFor, setPaidFor] = useState<BillingMilestone | null>(null);
  const [signoffOpen, setSignoffOpen] = useState(false);
  const [printMilestone, setPrintMilestone] = useState<BillingMilestone | null>(null);

  if (q.isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading billing…</div>;
  }
  if (q.isError) {
    return <div className="p-8 text-sm text-destructive">Failed to load billing.</div>;
  }

  const milestones = q.data!.milestones;
  const contract = q.data!.contract;
  const fee = contract?.contract_fee != null ? Number(contract.contract_fee) : null;
  const currency = (contract?.contract_currency ?? "MYR") as Currency;
  const isLead = userRole === "brqplus_lead";

  // Empty state
  if (!fee) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-md rounded-[10px] border border-border bg-card p-6 text-center">
          <div className="text-2xl text-muted-foreground">🧾</div>
          <p className="mt-2 text-sm font-medium text-foreground">No contract fee set</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {isLead
              ? "Set the contract value to activate the billing schedule."
              : "Contact your BRQ+ lead to configure billing."}
          </p>
          {isLead && (
            <button
              onClick={() => setContractOpen(true)}
              className="mt-4 rounded-md border border-border bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90"
            >
              Set contract fee →
            </button>
          )}
        </div>
        {contractOpen && (
          <ContractDrawer
            missionId={missionId}
            existing={contract}
            onClose={() => setContractOpen(false)}
            onSaved={() => {
              setContractOpen(false);
              qc.invalidateQueries({ queryKey: ["billing", missionId] });
            }}
          />
        )}
      </div>
    );
  }

  const totalPaid = milestones.filter((m) => m.status === "paid").reduce((s, m) => s + Number(m.amount ?? 0), 0);
  const totalDue = milestones
    .filter((m) => ["due", "invoiced", "overdue"].includes(m.status))
    .reduce((s, m) => s + Number(m.amount ?? 0), 0);
  const totalLocked = milestones.filter((m) => m.status === "locked").reduce((s, m) => s + Number(m.amount ?? 0), 0);
  const anyOverdue = milestones.some((m) => m.status === "overdue");
  const pctReceived = fee > 0 ? Math.round((totalPaid / fee) * 100) : 0;

  return (
    <div className="flex-1 space-y-4 overflow-y-auto p-5 lg:p-8">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Contract value"
          value={formatMoney(fee, currency)}
          extra={
            isLead && (
              <button
                onClick={() => setContractOpen(true)}
                className="mt-1 text-[11px] text-cyan hover:underline"
              >
                Edit ✎
              </button>
            )
          }
        />
        <Stat
          label="Total received"
          value={formatMoney(totalPaid, currency)}
          valueClass="text-emerald-500"
        />
        <Stat
          label="Currently due"
          value={formatMoney(totalDue, currency)}
          valueClass={anyOverdue ? "text-red-500" : totalDue > 0 ? "text-amber-500" : "text-muted-foreground"}
        />
        <Stat
          label="Remaining locked"
          value={formatMoney(totalLocked, currency)}
          valueClass="text-muted-foreground"
        />
      </div>

      {/* Timeline */}
      <div className="rounded-[10px] border border-border bg-card p-5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{pctReceived}% of contract value received</span>
          <span>
            {formatMoney(totalPaid, currency)} of {formatMoney(fee, currency)}
          </span>
        </div>
        <div className="relative mt-8 mb-10 h-1.5 rounded-full bg-muted/50">
          <div
            className="absolute left-0 top-0 h-1.5 rounded-full bg-foreground transition-all duration-500"
            style={{ width: `${Math.min(100, pctReceived)}%` }}
          />
          {milestones.map((m) => {
            const pos = getMilestonePosition(m);
            return (
              <div
                key={m.id}
                className="group absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${pos}%` }}
              >
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-muted-foreground">
                  {m.milestone_key === "signoff" ? "Signoff" : `${m.milestone_key} · ${m.trigger_pct}%`}
                </div>
                <div className={`h-3.5 w-3.5 rounded-full ${NODE_DOT[m.status]}`} />
                <div
                  className={`absolute top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] ${AMOUNT_COLOR[m.status]}`}
                >
                  {formatMoneyAbbr(m.amount, currency)}
                  {m.status === "paid" && " ✓"}
                </div>
                {/* Tooltip */}
                <div className="pointer-events-none absolute bottom-6 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-card px-2 py-1.5 text-[11px] text-foreground shadow-md group-hover:block">
                  <div className="font-medium">{m.label}</div>
                  <div className="text-muted-foreground">{formatMoney(m.amount, currency)}</div>
                  <div className="text-muted-foreground">{STATUS_BADGE[m.status].label}</div>
                  {m.invoice_number && <div className="text-muted-foreground">Invoice: {m.invoice_number}</div>}
                  {m.paid_at && <div className="text-muted-foreground">Paid: {formatDate(m.paid_at)}</div>}
                  {m.status === "invoiced" && m.payment_due_date && (
                    <div className="text-muted-foreground">Due: {formatDate(m.payment_due_date)}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Schedule */}
      <div>
        <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          Invoice schedule
        </div>
        <div className="overflow-hidden rounded-[10px] border border-border bg-card">
          {/* Desktop header */}
          <div className="hidden grid-cols-[2.2fr_0.8fr_0.7fr_1.1fr_1.2fr_1fr_1fr] gap-3 border-b border-border bg-muted/30 px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground lg:grid">
            <div>Milestone</div>
            <div>Trigger</div>
            <div className="text-center">% of fee</div>
            <div>Amount</div>
            <div>Invoice no.</div>
            <div>Status</div>
            <div>Action</div>
          </div>

          {milestones.map((m) => (
            <ScheduleRow
              key={m.id}
              m={m}
              currency={currency}
              userRole={userRole}
              onIssue={() => setIssueFor(m)}
              onMarkPaid={() => setPaidFor(m)}
              onSignoff={() => setSignoffOpen(true)}
              onDownload={() => setPrintMilestone(m)}
            />
          ))}
        </div>
      </div>

      {contractOpen && (
        <ContractDrawer
          missionId={missionId}
          existing={contract}
          onClose={() => setContractOpen(false)}
          onSaved={() => {
            setContractOpen(false);
            qc.invalidateQueries({ queryKey: ["billing", missionId] });
          }}
        />
      )}
      {issueFor && (
        <IssueInvoiceDrawer
          milestone={issueFor}
          currency={currency}
          contract={contract}
          onClose={() => setIssueFor(null)}
          onSaved={(num) => {
            setIssueFor(null);
            qc.invalidateQueries({ queryKey: ["billing", missionId] });
            // open print
            const updated = { ...issueFor, invoice_number: num, status: "invoiced" as const };
            setPrintMilestone(updated);
          }}
        />
      )}
      {paidFor && (
        <MarkPaidDrawer
          milestone={paidFor}
          currency={currency}
          onClose={() => setPaidFor(null)}
          onSaved={() => {
            setPaidFor(null);
            qc.invalidateQueries({ queryKey: ["billing", missionId] });
          }}
        />
      )}
      {signoffOpen && (
        <SignoffDialog
          missionId={missionId}
          signoffAmount={milestones.find((m) => m.milestone_key === "signoff")?.amount ?? 0}
          currency={currency}
          onClose={() => setSignoffOpen(false)}
          onSaved={() => {
            setSignoffOpen(false);
            qc.invalidateQueries({ queryKey: ["billing", missionId] });
          }}
        />
      )}
      {printMilestone && (
        <InvoicePrint
          milestone={printMilestone}
          currency={currency}
          contract={contract}
          onClose={() => setPrintMilestone(null)}
        />
      )}
    </div>
  );
}

function Stat({ label, value, valueClass, extra }: { label: string; value: string; valueClass?: string; extra?: React.ReactNode }) {
  return (
    <div className="rounded-[10px] border border-border bg-card p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-[15px] font-medium ${valueClass ?? "text-foreground"}`}>{value}</div>
      {extra}
    </div>
  );
}

function ScheduleRow({
  m,
  currency,
  userRole,
  onIssue,
  onMarkPaid,
  onSignoff,
  onDownload,
}: {
  m: BillingMilestone;
  currency: string;
  userRole: Role;
  onIssue: () => void;
  onMarkPaid: () => void;
  onSignoff: () => void;
  onDownload: () => void;
}) {
  const isLead = userRole === "brqplus_lead";
  const badge = STATUS_BADGE[m.status];
  const rowTint =
    m.status === "due"
      ? "bg-amber-500/5"
      : m.status === "overdue"
        ? "bg-red-500/5"
        : "";
  const triggerLabel =
    m.milestone_key === "signoff"
      ? "Signoff"
      : `${m.trigger_pct}%`;
  const triggerColor =
    m.status === "paid"
      ? "text-emerald-500"
      : m.status === "overdue"
        ? "text-red-500"
        : m.status === "due" || m.status === "invoiced"
          ? "text-amber-500"
          : "text-muted-foreground";
  const subtitle = m.triggered_at
    ? `Triggered at ${m.trigger_pct ?? "—"}% · ${formatDate(m.triggered_at)}`
    : m.milestone_key === "signoff"
      ? "Unlocks on post-implementation signoff"
      : `Unlocks at ${m.trigger_pct}% mission progress`;

  const action = (() => {
    if (m.milestone_key === "signoff" && m.status === "locked" && isLead) {
      return (
        <button
          onClick={onSignoff}
          className="rounded-md border border-border bg-foreground px-2.5 py-1 text-[11px] font-medium text-background hover:opacity-90"
        >
          Record signoff
        </button>
      );
    }
    if (m.status === "due" && isLead) {
      return (
        <button
          onClick={onIssue}
          className="rounded-md border border-border bg-foreground px-2.5 py-1 text-[11px] font-medium text-background hover:opacity-90"
        >
          Issue invoice
        </button>
      );
    }
    if (m.status === "invoiced" && isLead) {
      return (
        <div className="flex gap-1">
          <button
            onClick={onMarkPaid}
            className="rounded-md border border-border bg-foreground px-2.5 py-1 text-[11px] font-medium text-background hover:opacity-90"
          >
            Mark paid
          </button>
          <button
            onClick={onDownload}
            className="rounded-md border border-border bg-card px-2.5 py-1 text-[11px] text-foreground hover:bg-muted"
          >
            Download
          </button>
        </div>
      );
    }
    if (m.status === "overdue" && isLead) {
      return (
        <button
          onClick={onMarkPaid}
          className="rounded-md border border-border bg-foreground px-2.5 py-1 text-[11px] font-medium text-background hover:opacity-90"
        >
          Mark paid
        </button>
      );
    }
    if (m.status === "paid" || (m.invoice_number && (m.status === "invoiced" || m.status === "overdue"))) {
      return (
        <button
          onClick={onDownload}
          className="rounded-md border border-border bg-card px-2.5 py-1 text-[11px] text-foreground hover:bg-muted"
        >
          {m.status === "paid" ? "Download" : "View invoice"}
        </button>
      );
    }
    if (m.status === "locked") {
      return (
        <button
          disabled
          className="cursor-not-allowed rounded-md border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground opacity-30"
        >
          Issue invoice
        </button>
      );
    }
    return null;
  })();

  return (
    <>
      {/* Desktop row */}
      <div
        className={`hidden grid-cols-[2.2fr_0.8fr_0.7fr_1.1fr_1.2fr_1fr_1fr] gap-3 border-b border-border px-4 py-3 last:border-b-0 lg:grid ${rowTint}`}
      >
        <div>
          <div className={`text-[13px] font-medium ${m.status === "locked" ? "text-muted-foreground" : "text-foreground"}`}>
            {m.label}
          </div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">{subtitle}</div>
        </div>
        <div className={`text-[12px] ${triggerColor}`}>{triggerLabel}</div>
        <div className="text-center text-[12px] text-muted-foreground">{m.fee_pct}%</div>
        <div
          className={`text-[12px] ${AMOUNT_COLOR[m.status]} ${["due", "invoiced", "overdue"].includes(m.status) ? "font-medium" : ""}`}
        >
          {formatMoney(m.amount, currency)}
        </div>
        <div className="text-[12px] text-muted-foreground">
          {m.invoice_number ? (
            <button onClick={onDownload} className="text-cyan hover:underline">
              {m.invoice_number}
            </button>
          ) : (
            "—"
          )}
        </div>
        <div>
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${badge.cls}`}>
            {badge.label}
          </span>
        </div>
        <div>{action}</div>
      </div>

      {/* Mobile card */}
      <div className={`block border-b border-border p-3 last:border-b-0 lg:hidden ${rowTint}`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[13px] font-medium text-foreground">{m.label}</div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">{subtitle}</div>
          </div>
          <span className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${badge.cls}`}>
            {badge.label}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <div className={`text-[13px] font-medium ${AMOUNT_COLOR[m.status]}`}>{formatMoney(m.amount, currency)}</div>
          <div className="text-[11px] text-muted-foreground">{m.fee_pct}% · {triggerLabel}</div>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <div className="text-[11px] text-muted-foreground">{m.invoice_number ?? ""}</div>
          {action}
        </div>
      </div>
    </>
  );
}

/* ----- Contract drawer ----- */

function ContractDrawer({
  missionId,
  existing,
  onClose,
  onSaved,
}: {
  missionId: string;
  existing: ContractInfo | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const save = useServerFn(saveContractFee);
  const [fee, setFee] = useState<string>(existing?.contract_fee ? String(existing.contract_fee) : "");
  const [currency, setCurrency] = useState<Currency>((existing?.contract_currency as Currency) ?? "MYR");
  const [signedAt, setSignedAt] = useState(existing?.contract_signed_at?.slice(0, 10) ?? "");
  const [email, setEmail] = useState(existing?.billing_contact_email ?? "");
  const [prefix, setPrefix] = useState(existing?.invoice_prefix ?? "BRQ");
  const [saving, setSaving] = useState(false);

  const feeNum = Number(fee);
  const preview = useMemo(() => {
    if (!feeNum || feeNum <= 0) return [];
    const defs: { key: string; label: string; pct: number }[] = [
      { key: "M0", label: "Engagement retainer", pct: 10 },
      { key: "M1", label: "Milestone 1 — initial delivery", pct: 20 },
      { key: "M2", label: "Milestone 2 — mid-point review", pct: 20 },
      { key: "M3", label: "Milestone 3 — advanced delivery", pct: 20 },
      { key: "M4", label: "Milestone 4 — pre-completion", pct: 20 },
      { key: "signoff", label: "Final payment — signoff", pct: 10 },
    ];
    const rows = defs.map((d) => ({ ...d, amount: Math.round((feeNum * d.pct) / 100 * 100) / 100 }));
    const sum = rows.reduce((s, r) => s + r.amount, 0);
    const diff = feeNum - sum;
    if (diff !== 0) rows[rows.length - 1].amount = Math.round((rows[rows.length - 1].amount + diff) * 100) / 100;
    return rows;
  }, [feeNum]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!feeNum || feeNum <= 0) {
      toast.error("Enter a valid contract value");
      return;
    }
    setSaving(true);
    try {
      await save({
        data: {
          mission_id: missionId,
          contract_fee: feeNum,
          contract_currency: currency,
          contract_signed_at: signedAt || null,
          billing_contact_email: email || null,
          invoice_prefix: prefix.toUpperCase() || "BRQ",
        },
      });
      toast.success("Contract fee saved. Billing schedule created.");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DrawerShell title={existing?.contract_fee ? "Edit contract fee" : "Set contract fee"} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4 text-sm">
        <Field label="Contract value" required>
          <input
            type="number"
            min={1}
            step={0.01}
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            required
          />
        </Field>
        <Field label="Currency">
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as Currency)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Contract signed date">
          <input
            type="date"
            max={today()}
            value={signedAt}
            onChange={(e) => setSignedAt(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Billing contact email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="client@company.com"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">This email will appear on invoices.</p>
        </Field>
        <Field label="Invoice prefix">
          <input
            type="text"
            maxLength={6}
            value={prefix}
            onChange={(e) => setPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm uppercase"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Invoices will be numbered: {prefix || "BRQ"}-{new Date().getFullYear()}-001
          </p>
        </Field>

        {preview.length > 0 && (
          <div className="rounded-md border border-border bg-muted/20 p-3">
            <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">Schedule preview</div>
            <div className="space-y-1">
              {preview.map((r) => (
                <div key={r.key} className="flex justify-between text-[12px]">
                  <span className="text-foreground">{r.label}</span>
                  <span className="text-muted-foreground">
                    {r.pct}% · {formatMoney(r.amount, currency)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2 border-t border-border pt-2 text-[11px] text-muted-foreground">
              Total: {formatMoney(feeNum, currency)}
              {preview.reduce((s, r) => s + r.amount, 0) !== feeNum && " (adjusted for rounding)"}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-3">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md border border-border bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save contract fee"}
          </button>
        </div>
      </form>
    </DrawerShell>
  );
}

/* ----- Issue invoice drawer ----- */

function IssueInvoiceDrawer({
  milestone,
  currency,
  contract,
  onClose,
  onSaved,
}: {
  milestone: BillingMilestone;
  currency: string;
  contract: ContractInfo | null;
  onClose: () => void;
  onSaved: (invoiceNumber: string) => void;
}) {
  const issue = useServerFn(issueInvoice);
  const [invDate, setInvDate] = useState(today());
  const [dueChoice, setDueChoice] = useState<"7" | "14" | "30" | "custom">("14");
  const [customDue, setCustomDue] = useState(addDays(today(), 14));
  const [billTo, setBillTo] = useState(contract?.billing_contact_email ?? "");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const dueDate = dueChoice === "custom" ? customDue : addDays(invDate, Number(dueChoice));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await issue({
        data: {
          milestone_id: milestone.id,
          invoice_date: invDate,
          payment_due_date: dueDate,
          bill_to: billTo || null,
          notes: notes || null,
        },
      });
      toast.success(`Invoice ${res.invoice_number} issued.`);
      onSaved(res.invoice_number);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to issue invoice");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DrawerShell title={`Issue invoice — ${milestone.label}`} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4 text-sm">
        <div className="rounded-md border border-border bg-muted/20 p-3 text-[12px]">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Amount due</span>
            <span className="font-medium text-foreground">{formatMoney(milestone.amount, currency)}</span>
          </div>
        </div>
        <Field label="Invoice date">
          <input
            type="date"
            max={today()}
            value={invDate}
            onChange={(e) => setInvDate(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            required
          />
        </Field>
        <Field label="Payment due in">
          <select
            value={dueChoice}
            onChange={(e) => setDueChoice(e.target.value as any)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="7">7 days</option>
            <option value="14">14 days</option>
            <option value="30">30 days</option>
            <option value="custom">Custom date</option>
          </select>
          {dueChoice === "custom" && (
            <input
              type="date"
              min={invDate}
              value={customDue}
              onChange={(e) => setCustomDue(e.target.value)}
              className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          )}
          <p className="mt-1 text-[11px] text-muted-foreground">Due: {formatDate(dueDate)}</p>
        </Field>
        <Field label="Bill to">
          <textarea
            rows={3}
            value={billTo}
            onChange={(e) => setBillTo(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Invoice notes">
          <textarea
            rows={2}
            maxLength={300}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Scope summary, deliverables reference, or payment instructions…"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
        <div className="flex items-center justify-end gap-2 pt-3">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md border border-border bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Issuing…" : "Issue & download"}
          </button>
        </div>
      </form>
    </DrawerShell>
  );
}

/* ----- Mark paid drawer ----- */

function MarkPaidDrawer({
  milestone,
  currency,
  onClose,
  onSaved,
}: {
  milestone: BillingMilestone;
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const mark = useServerFn(markMilestonePaid);
  const expected = Number(milestone.amount ?? 0);
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState<string>(String(expected));
  const [ref, setRef] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const amountNum = Number(amount);
  const variance = amountNum - expected;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amountNum || amountNum < 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setSaving(true);
    try {
      await mark({
        data: {
          milestone_id: milestone.id,
          paid_at: date,
          amount_received: amountNum,
          payment_reference: ref || null,
          payment_note: note || null,
        },
      });
      toast.success(`Payment recorded for ${milestone.label}.`);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DrawerShell title={`Record payment — ${milestone.label}`} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4 text-sm">
        <div className="rounded-md border border-border bg-muted/20 p-3 text-[12px]">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Invoice number</span>
            <span className="text-foreground">{milestone.invoice_number ?? "—"}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-muted-foreground">Amount invoiced</span>
            <span className="text-foreground">{formatMoney(expected, currency)}</span>
          </div>
        </div>
        <Field label="Date received" required>
          <input
            type="date"
            max={today()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            required
          />
        </Field>
        <Field label="Amount received">
          <input
            type="number"
            min={0}
            step={0.01}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">Enter the actual amount if different from invoiced.</p>
          {Math.abs(variance) > 0.005 && (
            <p className="mt-1 text-[11px] text-amber-500">
              Variance of {formatMoney(variance, currency)}. Add a note to explain.
            </p>
          )}
        </Field>
        <Field label="Payment reference">
          <input
            type="text"
            maxLength={80}
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Internal note">
          <textarea
            rows={2}
            maxLength={200}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
        <div className="flex items-center justify-end gap-2 pt-3">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md border border-border bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Confirm payment received"}
          </button>
        </div>
      </form>
    </DrawerShell>
  );
}

/* ----- Signoff dialog ----- */

function SignoffDialog({
  missionId,
  signoffAmount,
  currency,
  onClose,
  onSaved,
}: {
  missionId: string;
  signoffAmount: number | null;
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const record = useServerFn(recordSignoff);
  const [date, setDate] = useState(today());
  const [signedBy, setSignedBy] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!signedBy.trim()) {
      toast.error("Enter who signed off");
      return;
    }
    setSaving(true);
    try {
      await record({
        data: {
          mission_id: missionId,
          signoff_date: date,
          signed_by: signedBy.trim(),
          reference: reference || null,
          note: note || null,
        },
      });
      toast.success("Signoff recorded. Final invoice unlocked.");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-[10px] border border-border bg-card p-5">
        <div className="text-center text-2xl text-emerald-500">✓</div>
        <h3 className="mt-2 text-center text-[15px] font-medium text-foreground">
          Record post-implementation signoff
        </h3>
        <p className="mt-2 text-center text-[13px] leading-relaxed text-muted-foreground">
          This confirms the client has formally accepted the delivered work. Recording signoff will unlock
          the final invoice of {formatMoney(signoffAmount, currency)}.
        </p>
        <form onSubmit={onSubmit} className="mt-4 space-y-3 text-sm">
          <Field label="Signoff date">
            <input
              type="date"
              max={today()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              required
            />
          </Field>
          <Field label="Signed off by">
            <input
              type="text"
              value={signedBy}
              onChange={(e) => setSignedBy(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              required
            />
          </Field>
          <Field label="Reference / document">
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Note">
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </Field>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md border border-border bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Confirm signoff"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ----- Invoice print preview ----- */

function InvoicePrint({
  milestone,
  currency,
  contract,
  onClose,
}: {
  milestone: BillingMilestone;
  currency: string;
  contract: ContractInfo | null;
  onClose: () => void;
}) {
  useEffect(() => {
    // Set a class to enable print stylesheet, then trigger print after paint
    document.body.classList.add("invoice-printing");
    const id = window.setTimeout(() => {
      window.print();
    }, 300);
    const onAfter = () => {
      document.body.classList.remove("invoice-printing");
      onClose();
    };
    window.addEventListener("afterprint", onAfter);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("afterprint", onAfter);
      document.body.classList.remove("invoice-printing");
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="invoice-print-root w-full max-w-2xl rounded-[10px] border border-border bg-card p-8">
        <div className="flex items-start justify-between border-b border-border pb-4">
          <div>
            <div className="text-2xl font-medium text-foreground">BRQ+</div>
            <div className="text-[11px] text-muted-foreground">BRQ Plus Sdn Bhd</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Tax invoice</div>
            <div className="mt-1 text-[13px] font-medium text-foreground">{milestone.invoice_number ?? "—"}</div>
            <div className="text-[11px] text-muted-foreground">
              Issued: {formatDate(milestone.invoice_issued_at)}
            </div>
            {milestone.payment_due_date && (
              <div className="text-[11px] text-muted-foreground">Due: {formatDate(milestone.payment_due_date)}</div>
            )}
          </div>
        </div>

        <div className="mt-4 text-[12px]">
          <div className="text-muted-foreground">Bill to</div>
          <div className="mt-1 whitespace-pre-wrap text-foreground">
            {contract?.billing_contact_email ?? "—"}
          </div>
        </div>

        <table className="mt-6 w-full text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="py-2">Description</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border">
              <td className="py-2 text-foreground">{milestone.label}</td>
              <td className="py-2 text-right text-foreground">{formatMoney(milestone.amount, currency)}</td>
            </tr>
            <tr>
              <td className="py-3 text-right font-medium text-foreground">Total</td>
              <td className="py-3 text-right font-medium text-foreground">{formatMoney(milestone.amount, currency)}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-6 border-t border-border pt-3 text-[11px] text-muted-foreground">
          BRQ Plus Sdn Bhd · Reg. 202601006582 (1668680-A) · Kuala Lumpur
        </div>

        <div className="mt-4 flex justify-end gap-2 print:hidden">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
            Close
          </button>
          <button
            onClick={() => window.print()}
            className="rounded-md border border-border bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90"
          >
            Print / Save PDF
          </button>
        </div>
      </div>
    </div>
  );
}

/* ----- Shared bits ----- */

function DrawerShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/15" onClick={onClose} />
      <div className="flex w-full max-w-md flex-col overflow-y-auto border-l border-border bg-card p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <h3 className="text-[15px] font-medium text-foreground">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </span>
      {children}
    </label>
  );
}
