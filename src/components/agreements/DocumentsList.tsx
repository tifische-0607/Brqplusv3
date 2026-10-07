import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getDocumentPdfUrl, listDossierDocuments, type DossierDoc } from "@/lib/documents.functions";
import { focusRing } from "@/components/members/portal-ui";

type Scope = { mine: true } | { userId: string } | { companyId: string } | { allNdas: true };

const th = "px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground";
const td = "px-2 py-2 align-top";
const link = `min-h-11 rounded-sm text-left text-xs font-semibold uppercase tracking-wider text-gold hover:underline ${focusRing}`;

export function DocumentsList({ scope, showSigner }: { scope: Scope; showSigner?: boolean }) {
  const fn = useServerFn(listDossierDocuments);
  const dl = useServerFn(getDocumentPdfUrl);
  const q = useQuery({ queryKey: ["dossier-documents", scope], queryFn: () => fn({ data: scope as any }), retry: false });
  const [err, setErr] = useState<string | null>(null);

  async function open(d: DossierDoc, executed = false) {
    setErr(null);
    try {
      const { url } = await dl({ data: { kind: d.kind, id: d.id, executed } });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Download failed");
    }
  }

  if (q.isLoading) return <p role="status" className="text-sm text-muted-foreground">Loading documents…</p>;
  if (q.isError) return <p role="alert" className="text-sm text-destructive">{(q.error as Error).message}</p>;
  const rows = q.data!.documents;
  if (!rows.length) return <p className="text-sm text-muted-foreground">No signed documents on record.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <caption className="sr-only">Signed BRQ+ documents and PDF downloads</caption>
        <thead className="border-b border-border">
          <tr>
            <th className={th}>Document</th>
            <th className={th}>Version</th>
            <th className={th}>Mission</th>
            {showSigner && <th className={th}>Signer</th>}
            <th className={th}>Signed at</th>
            <th className={th}>Status</th>
            <th className={th}>PDF</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={`${d.kind}-${d.id}`} className="border-b border-border/50">
              <td className={`${td} text-foreground`}>{d.doc_label}</td>
              <td className={td}>
                <span className="text-foreground">{d.version}</span>
                <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${d.signed_on_draft ? "bg-warning/15 text-warning" : "bg-gold/15 text-gold"}`}>{d.signed_on_draft ? "Signed on draft" : "Final"}</span>
              </td>
              <td className={`${td} text-muted-foreground`}>{d.mission_title ?? "—"}</td>
              {showSigner && <td className={`${td} text-muted-foreground`}>{d.signer}{d.signer_title ? `, ${d.signer_title}` : ""}{d.external ? " (external)" : ""}</td>}
              <td className={`${td} text-muted-foreground`}>{new Date(d.signed_at).toLocaleString()}</td>
              <td className={`${td} capitalize text-foreground`}>{d.status}</td>
              <td className={td}>
                <div className="flex flex-col gap-1">
                   {d.has_pdf ? <button type="button" className={link} aria-label={`Download ${d.doc_label} PDF`} onClick={() => open(d)}>Download PDF</button> : <span className="text-xs text-muted-foreground">PDF pending</span>}
                   {d.has_executed_pdf && <button type="button" className={link} aria-label={`Download executed ${d.doc_label} PDF`} onClick={() => open(d, true)}>Executed PDF</button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {err && <p role="alert" className="mt-2 text-sm text-destructive">{err}</p>}
    </div>
  );
}
