// Server-only helpers for BRQ+ Membership Agreement e-signing.

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function decodePngDataUrl(dataUrl: string): Uint8Array {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new Error("Signature must be a PNG image.");
  const bytes = Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0));
  const magic = [0x89, 0x50, 0x4e, 0x47];
  if (bytes.length < 500 || !magic.every((b, i) => bytes[i] === b)) throw new Error("Please draw your signature.");
  return bytes;
}

export function formatDualTime(iso: string) {
  const d = new Date(iso);
  const fmt = (tz: string) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: tz, dateStyle: "long", timeStyle: "long" }).format(d);
  return { utc: fmt("UTC"), myt: fmt("Asia/Kuala_Lumpur") };
}

/** Standard PDF fonts are Latin-1 only; normalise typographic characters. */
function pdfSafe(s: string): string {
  return s
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "");
}

function markdownToPlain(md: string): string {
  return md
    .replace(/\r\n/g, "\n")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/(^|\s)[*_](.+?)[*_](?=\s|$)/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/^\s*[-*+]\s+/gm, "- ");
}

export type PdfSignature = {
  signer_name: string;
  signer_title: string | null;
  company_name: string | null;
  signer_type: string;
  signer_email: string | null;
  signed_at: string;
  ip_address: string | null;
  user_agent: string | null;
  sha256: string;
  signature_id: string;
  signature_png_base64: string;
};

export type PdfInput = PdfSignature & {
  title: string;
  version: string;
  body_markdown: string;
  draft?: boolean;
};

export const DRAFT_PDF_TEXT = "WORKING DRAFT - not yet final. Subject to legal review.";

const TYPE_LABEL: Record<string, string> = {
  company_admin: "Company Admin",
  company_user: "Company User",
  personal: "Personal member",
  member: "Member",
  customer: "Customer",
  facilitator: "Facilitator (BRQ+)",
  external: "External party",
};

function makeDoc(jsPDF: any) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 56;
  const st = { y: M };
  const ensure = (h: number) => {
    if (st.y + h > H - M) {
      doc.addPage();
      st.y = M;
    }
  };
  const para = (text: string, size = 10, style: "normal" | "bold" = "normal", gap = 4) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(pdfSafe(text), W - M * 2) as string[];
    for (const line of lines) {
      ensure(size * 1.35);
      doc.text(line, M, st.y);
      st.y += size * 1.35;
    }
    st.y += gap;
  };
  const banner = () => {
    doc.setFillColor(245, 180, 60);
    doc.rect(M, st.y - 12, W - M * 2, 24, "F");
    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(DRAFT_PDF_TEXT, M + 8, st.y + 4);
    doc.setTextColor(0, 0, 0);
    st.y += 28;
  };
  const newPage = () => {
    doc.addPage();
    st.y = M;
  };
  return { doc, M, st, para, ensure, banner, newPage };
}

function bodySection(k: ReturnType<typeof makeDoc>, p: { title: string; version: string; body_markdown: string; draft?: boolean }) {
  if (p.draft) k.banner();
  k.para(p.title, 18, "bold", 2);
  k.para(`Version ${p.version}`, 11, "normal", 14);
  for (const block of markdownToPlain(p.body_markdown).split(/\n{2,}/)) {
    if (block.trim()) k.para(block.trim(), 10, "normal", 8);
  }
}

function signaturePage(k: ReturnType<typeof makeDoc>, docLabel: string, s: PdfSignature, heading = "Signature page") {
  k.newPage();
  const { doc, M } = k;
  k.para(heading, 16, "bold", 10);
  const t = formatDualTime(s.signed_at);
  const rows: [string, string][] = [
    ["Signer", s.signer_name],
    ["Title", s.signer_title || "-"],
    ["Company", s.company_name || "-"],
    ["Signer type", TYPE_LABEL[s.signer_type] ?? s.signer_type],
    ["Document", docLabel],
    ["Signed (UTC)", t.utc],
    ["Signed (Asia/Kuala_Lumpur)", t.myt],
  ];
  for (const [a, b] of rows) k.para(`${a}: ${b}`, 11, "normal", 2);
  k.st.y += 10;
  k.ensure(140);
  doc.setFontSize(9);
  doc.text("Signature:", M, k.st.y);
  k.st.y += 8;
  doc.addImage(`data:image/png;base64,${s.signature_png_base64}`, "PNG", M, k.st.y, 240, 90);
  k.st.y += 96;
  doc.line(M, k.st.y, M + 240, k.st.y);
  k.st.y += 28;
  k.para("Audit trail", 13, "bold", 6);
  const audit: [string, string][] = [
    ["Signer email", s.signer_email || "-"],
    ["IP address", s.ip_address || "-"],
    ["User agent", s.user_agent || "-"],
    ["Document SHA-256", s.sha256],
    ["Signature ID", s.signature_id],
  ];
  for (const [a, b] of audit) k.para(`${a}: ${b}`, 9, "normal", 2);
}

export async function buildSignedPdf(p: PdfInput): Promise<Uint8Array> {
  const { jsPDF } = await import("jspdf");
  const k = makeDoc(jsPDF);
  bodySection(k, p);
  signaturePage(k, `${p.title} (version ${p.version})`, p);
  return new Uint8Array(k.doc.output("arraybuffer") as ArrayBuffer);
}

/** Fully executed document: text + one signature page per party. */
export async function buildExecutedPdf(p: { title: string; version: string; body_markdown: string; draft?: boolean; executed_at: string; signatures: PdfSignature[] }): Promise<Uint8Array> {
  const { jsPDF } = await import("jspdf");
  const k = makeDoc(jsPDF);
  bodySection(k, p);
  p.signatures.forEach((s, i) => signaturePage(k, `${p.title} (version ${p.version})`, s, `Signature page ${i + 1} of ${p.signatures.length}`));
  k.newPage();
  k.para("Execution record", 16, "bold", 10);
  const t = formatDualTime(p.executed_at);
  k.para(`Fully executed (UTC): ${t.utc}`, 11, "normal", 2);
  k.para(`Fully executed (Asia/Kuala_Lumpur): ${t.myt}`, 11, "normal", 8);
  for (const s of p.signatures) k.para(`${s.signer_name}${s.company_name ? ` (${s.company_name})` : ""} - signed ${formatDualTime(s.signed_at).utc} - SHA-256 ${s.sha256}`, 9, "normal", 3);
  return new Uint8Array(k.doc.output("arraybuffer") as ArrayBuffer);
}

/** Merge the NDA Schedule values into the template body. */
export function renderNdaBody(template: string, sch: NdaSchedule, parties: { name: string; company_name: string | null; country: string | null }[]): string {
  const partyLines = parties.length
    ? "\n" + parties.map((p) => `    - ${p.name}${p.company_name ? `, ${p.company_name}` : ""}${p.country ? `, ${p.country}` : ""}`).join("\n")
    : "To be confirmed";
  return template
    .replace("{mission title and reference}", `${sch.mission_title}${sch.reference ? ` (${sch.reference})` : ""}`)
    .replace("{program}", sch.program || "-")
    .replace("{list of parties: name, company, country}", partyLines)
    .replace("{purpose}", sch.purpose || "-")
    .replace("{period}", sch.confidentiality_period || "3 years after the engagement ends")
    .replace('{special terms or "None"}', sch.special_terms?.trim() || "None");
}

export type NdaSchedule = {
  mission_title: string;
  reference: string | null;
  program: string | null;
  purpose: string | null;
  confidentiality_period: string;
  special_terms: string | null;
};
