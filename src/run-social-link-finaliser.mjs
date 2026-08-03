import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const DATE = process.env.SAPIVER_FORGE_DATE || process.env.SAPIVER_FORGE_DATE || new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(new Date());
const draftDir = path.join(ROOT, "drafts", DATE);
const warningPath = path.join(draftDir, "social-link-warning.txt");

const result = spawnSync(process.execPath, ["src/finalise-social-links.mjs"], {
  cwd: ROOT,
  env: process.env,
  stdio: "inherit"
});

if (result.status !== 0) {
  fs.mkdirSync(draftDir, { recursive: true });
  fs.writeFileSync(
    warningPath,
    `Social CTA finalisation failed for ${DATE} with status ${result.status ?? "unknown"}.\nThe generated social copy has been preserved for human review instead of being discarded.\n`,
    "utf8"
  );
  console.warn("Social CTA finalisation failed; preserving the social pack for human review.");
  process.exit(0);
}

fs.rmSync(warningPath, { force: true });
console.log(`Social CTA finalisation completed for ${DATE}.`);
