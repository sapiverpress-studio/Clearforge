import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const DATE = process.env.CLEARFORGE_DATE || new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(new Date());
const draftDir = path.join(ROOT, "drafts", DATE);
const warningPath = path.join(draftDir, "feature-warning.txt");

const result = spawnSync(process.execPath, ["src/generate-full-feature.mjs"], {
  cwd: ROOT,
  env: process.env,
  stdio: "inherit"
});

if (result.status !== 0) {
  fs.rmSync(path.join(draftDir, "feature.md"), { force: true });
  fs.rmSync(path.join(draftDir, "feature.json"), { force: true });
  fs.mkdirSync(draftDir, { recursive: true });
  fs.writeFileSync(
    warningPath,
    `Feature skipped for ${DATE}. Generation exited with status ${result.status ?? "unknown"}.\nThe verified report and social pack remain available for review.\n`,
    "utf8"
  );
  console.warn("Optional feature generation failed; continuing with the verified report and social pack.");
  process.exit(0);
}

fs.rmSync(warningPath, { force: true });
console.log(`Optional feature generated for ${DATE}.`);
