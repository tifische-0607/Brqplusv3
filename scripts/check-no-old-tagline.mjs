#!/usr/bin/env node
// Build guard: fail if the old tagline text reappears anywhere in src/ or generated files.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["src"];
const EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".css", ".html"]);

// The old tagline and close fragments that must never reappear.
const FORBIDDEN = [
  /High-impact advisory and execution for ethical fintech, Islamic finance, and digital inclusion/i,
];

// Auto-generated / third-party paths to skip.
const EXEMPT = [
  /src\/integrations\/supabase\//,
  /src\/routeTree\.gen\.ts$/,
];

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

    for (const re of FORBIDDEN) {
      if (re.test(content)) {
        offenders.push(`${rel}: old tagline found`);
      }
    }
  }
}

for (const d of SCAN_DIRS) if (existsSync(join(ROOT, d))) walk(join(ROOT, d));

if (offenders.length) {
  console.error("[check-no-old-tagline] Violations:");
  for (const o of offenders) console.error("  - " + o);
  process.exit(1);
}
console.log("[check-no-old-tagline] OK — no old tagline references.");
