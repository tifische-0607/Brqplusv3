import { useNavigate, useSearch } from "@tanstack/react-router";
import { X } from "lucide-react";

/** Read/write admin list filters in the URL so filtered views are shareable. */
export function useUrlFilters() {
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const navigate = useNavigate();
  const get = (k: string) => (search[k] == null ? "" : String(search[k]));
  const set = (patch: Record<string, string | undefined>) => {
    const next: Record<string, unknown> = { ...search };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "") delete next[k];
      else next[k] = v;
    }
    navigate({ to: ".", search: next as never, replace: true });
  };
  return { get, set };
}

export function FilterChips({ chips, onRemove }: { chips: Array<{ key: string; label: string }>; onRemove: (key: string) => void }) {
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Filtered by</span>
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onRemove(c.key)}
          aria-label={`Remove filter ${c.label}`}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-gold/50 bg-gold/10 px-3 py-1 text-xs text-gold hover:bg-gold/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          {c.label}
          <X className="h-3 w-3" aria-hidden />
        </button>
      ))}
    </div>
  );
}
