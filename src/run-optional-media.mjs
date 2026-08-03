import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { campaignIsActive } from "./commercial-campaign.mjs";

const ROOT = process.cwd();
const DATE = process.env.SAPIVER_FORGE_DATE || process.env.SAPIVER_FORGE_DATE || new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(new Date());
const draftDir = path.join(ROOT, "drafts", DATE);
const mediaDir = path.join(ROOT, "media", DATE);
const warningPath = path.join(draftDir, "media-warning.txt");
const structuredPath = path.join(draftDir, "structured_output.json");

let originalStructured = null;
try {
  if (fs.existsSync(structuredPath)) {
    originalStructured = fs.readFileSync(structuredPath, "utf8");
    const data = JSON.parse(originalStructured);
    const stories = Array.isArray(data.story_summaries) ? data.story_summaries : [];
    const sources = Array.isArray(data.sources) ? data.sources : [];
    if (!campaignIsActive(DATE) && stories.length >= 1 && stories.length < 3 && stories.length === sources.length) {
      const expandedStories = [];
      const expandedSources = [];
      for (let index = 0; index < 3; index += 1) {
        const sourceIndex = index % stories.length;
        expandedStories.push({ ...stories[sourceIndex] });
        expandedSources.push({ ...sources[sourceIndex] });
      }
      data.story_summaries = expandedStories;
      data.sources = expandedSources;
      fs.writeFileSync(structuredPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
      console.log(`Adapted ${stories.length}-story edition into a three-scene media sequence without changing the verified report.`);
    }
  }

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
    process.exitCode = 0;
  } else {
    fs.rmSync(warningPath, { force: true });
    console.log(`Optional media generated for ${DATE}.`);

    const tiktokVideo = spawnSync(process.execPath, ["src/generate-tiktok-video.mjs"], {
      cwd: ROOT,
      env: process.env,
      stdio: "inherit"
    });
    if (tiktokVideo.status !== 0) {
      console.warn("TikTok MP4 generation returned a non-zero status; narration audio, script and caption remain available.");
    }
  }
} finally {
  if (originalStructured !== null) fs.writeFileSync(structuredPath, originalStructured, "utf8");
}
