#!/usr/bin/env node
// Build guard: company tagline allowlist.
// Only approved taglines are permitted. Any occurrence of the old
// tagline or close structural variants fails the build.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["src"];
const EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

const APPROVED_TAGLINES = [
  "BRQ Plus Sdn Bhd\\nCompany Reg. 202601006582 (1668680-A)",
];

const EXEMPT = [
  /src\/integrations\/supabase\//,
  /src\/routeTree\.gen\.ts$/,
];

// Exact old tagline text must never reappear.
const FORBIDDEN_EXACT = [
  /High-impact advisory and execution for ethical fintech, Islamic finance, and digital inclusion/i,
];

// Variant detector: a line under 120 chars containing the core old-tagline
// structure "advisory and execution for ... fintech/Islamic/digital".
// This avoids false positives on meta descriptions that insert words
// between "execution" and "for" (e.g., "vanguard for", "collective for").
const VARIANT_RE =
  /^(?!.*import).{30,120}$.*advisory and execution for.*(?:fintech|Islamic|digital)/i;

const offenders = [];

function isExempt(p) {
  return EXEMPT.some((re) => re.test(relative(ROOT, p)));
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

    // Check exact forbidden patterns
    for (const re of FORBIDDEN_EXACT) {
      if (re.test(content)) {
        offenders.push(`${rel}: forbidden exact tagline`);
      }
    }

    // Check for structural variants on a per-line basis
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!VARIANT_RE.test(line)) continue;
      const isApproved = APPROVED_TAGLINES.some((t) => line.includes(t));
      if (!isApproved) {
        offenders.push(`${rel}:${i + 1}: unapproved tagline variant`);
      }
    }
  }
}

for (const d of SCAN_DIRS) if (existsSync(join(ROOT, d))) walk(join(ROOT, d));

// Canonical tagline location must contain an approved tagline
const FOOTER = join(ROOT, "src/components/site/Footer.tsx");
if (!existsSync(FOOTER)) {
  offenders.push("src/components/site/Footer.tsx: tagline location missing");
} else {
  const footer = readFileSync(FOOTER, "utf8");
  const hasApproved = APPROVED_TAGLINES.some((t) => footer.includes(t));
  if (!hasApproved) {
    offenders.push("src/components/site/Footer.tsx: does not contain an approved tagline");
  }
}

if (offenders.length) {
  console.error("[check-tagline-allowlist] Violations:");
  for (const o of offenders) console.error("  - " + o);
  process.exit(1);
}
console.log("[check-tagline-allowlist] OK — only approved taglines present.");
