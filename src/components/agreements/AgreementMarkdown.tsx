import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function textOf(n: ReactNode): string {
  if (typeof n === "string" || typeof n === "number") return String(n);
  if (Array.isArray(n)) return n.map(textOf).join("");
  return "";
}

export function AgreementMarkdown({ body, highlightToConfirm = false }: { body: string; highlightToConfirm?: boolean }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-foreground [&_h1]:font-display [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mt-5 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-bold [&_h3]:mt-4 [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_li_ul]:mt-1 [&_a]:text-cyan [&_a]:underline [&_strong]:font-semibold [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_th]:p-2 [&_th]:text-left [&_td]:border [&_td]:border-border [&_td]:p-2 [&_td]:align-top">
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkGfm]}
        components={
          highlightToConfirm
            ? {
                strong: ({ children }) =>
                  /to confirm/i.test(textOf(children)) ? (
                    <mark className="rounded bg-warning px-1 font-semibold text-warning-foreground">{children}</mark>
                  ) : (
                    <strong>{children}</strong>
                  ),
              }
            : undefined
        }
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}

export const DRAFT_BANNER_TEXT = "WORKING DRAFT — not yet final. Subject to legal review.";

export function DraftBanner({ className = "" }: { className?: string }) {
  return (
    <div role="note" className={`rounded-md border border-warning bg-warning/15 px-4 py-3 text-sm font-semibold text-warning ${className}`}>
      {DRAFT_BANNER_TEXT}
    </div>
  );
}
