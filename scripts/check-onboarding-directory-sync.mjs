#!/usr/bin/env node
// Build guard: ensures the onboarding flow writes new members into the
// `fractional_executives` table so they appear in the Collective directory
// immediately after completing registration. Regression prevention for the
// "new members missing from the directory" bug.
import { readFileSync, existsSync } from "node:fs";

const FILE = "src/lib/onboarding.functions.ts";

if (!existsSync(FILE)) {
  console.error(`[check-onboarding-directory-sync] Missing file: ${FILE}`);
  process.exit(1);
}

const src = readFileSync(FILE, "utf8");

// Locate the updateExecutiveProfile server function body.
const startIdx = src.indexOf("export const updateExecutiveProfile");
if (startIdx === -1) {
  console.error(
    "[check-onboarding-directory-sync] Could not find updateExecutiveProfile in onboarding.functions.ts",
  );
  process.exit(1);
}
// Heuristic: the next exported const marks the end of the handler block.
const endIdx = src.indexOf("\nexport const ", startIdx + 1);
const body = endIdx === -1 ? src.slice(startIdx) : src.slice(startIdx, endIdx);

const REQUIRED = [
  // Must touch the directory table…
  /fractional_executives/,
  // …with both an upsert-style insert and an update branch keyed on the user.
  /\.from\(\s*["']fractional_executives["']\s*\)[\s\S]*\.insert\(/,
  /\.from\(\s*["']fractional_executives["']\s*\)[\s\S]*\.update\(/,
  /user_id/,
];

const missing = REQUIRED.filter((re) => !re.test(body)).map((re) => re.source);
if (missing.length > 0) {
  console.error(
    "[check-onboarding-directory-sync] updateExecutiveProfile must mirror the member into `fractional_executives` so they appear in the Collective directory after onboarding.\n" +
      "Missing required patterns:\n  - " +
      missing.join("\n  - "),
  );
  process.exit(1);
}

console.log(
  "[check-onboarding-directory-sync] OK — onboarding writes new members into the Collective directory.",
);
