import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const DATE = process.env.SAPIVER_FORGE_DATE || process.env.CLEARFORGE_DATE || new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(new Date());
const draftDir = path.join(ROOT, "drafts", DATE);
const mediaDir = path.join(ROOT, "media", DATE);
const warningPath = path.join(draftDir, "media-warning.txt");

const result = spawnSync(process.execPath, ["src/generate-ai-media.mjs"], {
  cwd: ROOT,
  env: process.env,
  stdio: "inherit"
});

if (result.status !== 0) {
  fs.rmSync(mediaDir, { recursive: true, force: true });
  fs.mkdirSync(draftDir, { recursive: true });
  fs.writeFileSync(
    warningPath,
    `Media skipped for ${DATE}. Generation exited with status ${result.status ?? "unknown"}.\nThe verified report, social copy and review package remain available.\n`,
    "utf8"
  );
  console.warn("Optional media generation failed; continuing with text outputs and review packaging.");
  process.exit(0);
}

fs.rmSync(warningPath, { force: true });
console.log(`Optional media generated for ${DATE}.`);
