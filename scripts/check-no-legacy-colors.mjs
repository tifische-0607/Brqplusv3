#!/usr/bin/env node
// Build guard: fail if legacy hex values or stock Tailwind palette classes
// reappear anywhere in src/ or generated files.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["src"];
const EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".css", ".html"]);

// Allowed hex values anywhere in source (theme tokens + intentional surfaces).
const ALLOWED_HEX = new Set([
  "#0d0d0d", "#1a1a1a", "#c9a84c", "#f0d78c", // Noir & Gold tokens
  "#fafafa", "#a3a3a3",                        // error-page neutrals on noir
  "#fff", "#ffffff", "#000", "#000000",        // primitives
  "#111111", "#ccc",                                       // shadcn chart tooltip default
  "#ffc107", "#ff3d00", "#4caf50", "#1976d2", // Google brand logo (required by Google brand guidelines)
]);

// Files exempt from the audit (auto-generated / third-party shapes).
const EXEMPT = [
  /src\/integrations\/supabase\//,
  /src\/routeTree\.gen\.ts$/,
];

// Legacy hex literals that must never reappear.
const FORBIDDEN_HEX = [
  /#00e5ff\b/i,
  /#0a0a1a\b/i,
  /#141432\b/i,
  /#1e1e5a\b/i,
  /#4f46e5\b/i,
];

// Stock Tailwind color palettes — the design system uses semantic tokens only.
// Status colors (success=emerald, warning=amber, danger=red) are allowed for
// admin UI indicators where semantic meaning is universal.
const STATUS_ALLOWLIST = /^(?:bg|text|border|ring)-(?:emerald|amber|red)-(?:400|500)(?:\/\d{1,3})?$/;
const STOCK_PALETTE_RE =
  /\b(?:bg|text|border|ring|from|to|via|fill|stroke|outline|decoration|placeholder|caret|accent|shadow|divide)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}(?:\/\d{1,3})?\b/g;

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;

const offenders = [];

function isExempt(p) {
  const rel = relative(ROOT, p);
  return EXEMPT.some((re) => re.test(rel));
}

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (name === "node_modules" || name.startsWith(".")) continue;
      walk(p);
      continue;
    }
    if (![...EXT].some((e) => p.endsWith(e))) continue;
    if (isExempt(p)) continue;

    const content = readFileSync(p, "utf8");
    const rel = relative(ROOT, p);

    for (const re of FORBIDDEN_HEX) {
      const m = content.match(re);
      if (m) offenders.push(`${rel}: forbidden hex ${m[0]}`);
    }

    const hexMatches = content.match(HEX_RE) ?? [];
    for (const hex of hexMatches) {
      if (!ALLOWED_HEX.has(hex.toLowerCase())) {
        offenders.push(`${rel}: unapproved hex ${hex} (allowlist in scripts/check-no-legacy-colors.mjs)`);
      }
    }

    const stockMatches = content.match(STOCK_PALETTE_RE) ?? [];
    for (const cls of stockMatches) {
      if (!STATUS_ALLOWLIST.test(cls)) {
        offenders.push(`${rel}: stock Tailwind palette class ${cls} — use semantic tokens`);
      }
    }
  }
}

for (const d of SCAN_DIRS) if (existsSync(join(ROOT, d))) walk(join(ROOT, d));

if (offenders.length) {
  console.error("[check-no-legacy-colors] Violations:");
  for (const o of offenders) console.error("  - " + o);
  process.exit(1);
}
console.log("[check-no-legacy-colors] OK — no legacy colors or stock palette classes.");
