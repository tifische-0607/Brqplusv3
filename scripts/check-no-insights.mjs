#!/usr/bin/env node
// Build guard: fails if any reference to the removed insights route reappears.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const FORBIDDEN_FILE = "src/routes/insights.tsx";
// Only the public top-level /insights route is forbidden. Member-area
// insights live under src/routes/_authenticated/ and are allowed to link
// to "/insights" within the authenticated portal.
const PATTERNS = [
  /src\/routes\/insights\.tsx/,
];
const SCAN_DIRS = ["src"];
const EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

if (existsSync(join(ROOT, FORBIDDEN_FILE))) {
  console.error(`[check-no-insights] Forbidden file exists: ${FORBIDDEN_FILE}`);
  process.exit(1);
}

const offenders = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (name === "node_modules" || name.startsWith(".")) continue;
      walk(p);
    } else if ([...EXT].some((e) => p.endsWith(e))) {
      const content = readFileSync(p, "utf8");
      for (const re of PATTERNS) {
        if (re.test(content)) {
          offenders.push(`${relative(ROOT, p)} matches ${re}`);
          break;
        }
      }
    }
  }
}
for (const d of SCAN_DIRS) if (existsSync(join(ROOT, d))) walk(join(ROOT, d));

if (offenders.length) {
  console.error("[check-no-insights] Forbidden insights references found:");
  for (const o of offenders) console.error("  - " + o);
  process.exit(1);
}
console.log("[check-no-insights] OK — no insights references.");
