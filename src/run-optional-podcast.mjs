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
const podcastDir = path.join(draftDir, "podcast");
const warningPath = path.join(draftDir, "podcast-warning.txt");

function run(command, args) {
  return spawnSync(command, args, {
    cwd: ROOT,
    env: process.env,
    stdio: "inherit",
    shell: false
  });
}

function discardPodcast(reason) {
  fs.rmSync(podcastDir, { recursive: true, force: true });
  fs.writeFileSync(
    warningPath,
    `Podcast skipped for ${DATE}. ${reason}\nThe verified report, social pack, feature and review workflow remain available.\n`,
    "utf8"
  );
  console.warn(`Podcast skipped without failing the Sapiver Forge production run: ${reason}`);
}

let generate = run(process.execPath, ["src/generate-broad-ai-news-podcast.mjs"]);
if (generate.status !== 0) {
  console.warn("Initial daily podcast generation failed; making one bounded retry from the same verified source set.");
  generate = run(process.execPath, ["src/generate-broad-ai-news-podcast.mjs"]);
}
if (generate.status !== 0) {
  discardPodcast(`Podcast generation exited with status ${generate.status ?? "unknown"}.`);
  process.exit(0);
}

const brand = run("npm", ["run", "brand:current"]);
if (brand.status !== 0) {
  discardPodcast(`Podcast branding exited with status ${brand.status ?? "unknown"}.`);
  process.exit(0);
}

const verify = run("npm", ["run", "verify:claims"]);
if (verify.status !== 0) {
  discardPodcast("Podcast claim verification found blocking issues.");
  process.exit(0);
}

console.log(`Optional podcast passed generation and claim verification for ${DATE}.`);
