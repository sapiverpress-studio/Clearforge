import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PODCAST_DIR = path.join(ROOT, "public", "podcast");
const NEW_COVER = "sapiver-forge-ai-briefing-cover-v1.png";
const OLD_BASE = "https://clearforge-daily-brief.netlify.app";
const NEW_BASE = "https://sapiverforge-daily-brief.netlify.app";

function replaceText(file, transforms) {
  if (!fs.existsSync(file)) return false;
  const before = fs.readFileSync(file, "utf8");
  let after = before;
  for (const [from, to] of transforms) {
    after = typeof from === "string" ? after.split(from).join(to) : after.replace(from, to);
  }
  if (after === before) return false;
  fs.writeFileSync(file, after);
  console.log(`Updated ${path.relative(ROOT, file)}`);
  return true;
}

const shared = [
  [OLD_BASE, NEW_BASE],
  ["Clearforge AI Briefing", "Sapiver Forge AI Briefing"],
  ["Clearforge explains", "Sapiver Forge explains"],
  ["/podcast/cover.png", `/podcast/${NEW_COVER}`],
  [`${NEW_BASE}/podcast/cover.png`, `${NEW_BASE}/podcast/${NEW_COVER}`]
];

// Repair the canonical generator first so future episodes cannot restore stale branding.
replaceText(path.join(ROOT, "scripts", "publish-podcast-feed.mjs"), [
  ...shared,
  ["<managingEditor>clearforge@sapiverpress.co.uk (Sapiver Forge)</managingEditor>", "<managingEditor>clearforge@sapiverpress.co.uk (Sapiver Forge)</managingEditor>"],
  ["Daily briefings, weekly learning editions and focused research", "Weekly briefings, practical learning editions and focused research"]
]);

// Repair the currently published feed and pages. Historical GUIDs deliberately remain
// clearforge:* because changing them would make podcast platforms create duplicates.
replaceText(path.join(PODCAST_DIR, "feed.xml"), [
  ...shared,
  ["Daily briefings, weekly learning editions and focused research", "Weekly briefings, practical learning editions and focused research"]
]);
replaceText(path.join(PODCAST_DIR, "index.html"), shared);
replaceText(path.join(ROOT, "PODCAST_RSS_SETUP.md"), [
  ...shared,
  ["# Clearforge hosted podcast feed", "# Sapiver Forge hosted podcast feed"],
  ["Clearforge Daily Autopilot", "Sapiver Forge weekly publishing workflow"],
  ["clearforge-daily-podcast-", "sapiver-forge-weekly-podcast-"]
]);

const episodeDir = path.join(PODCAST_DIR, "episodes");
if (fs.existsSync(episodeDir)) {
  for (const name of fs.readdirSync(episodeDir)) {
    if (name.endsWith(".html")) replaceText(path.join(episodeDir, name), shared);
  }
}

// Validate the resulting public identity and protect the historical GUIDs.
const feedPath = path.join(PODCAST_DIR, "feed.xml");
const feed = fs.readFileSync(feedPath, "utf8");
if (!feed.includes("<title>Sapiver Forge AI Briefing</title>")) throw new Error("Feed title was not repaired.");
if (!feed.includes(`/podcast/${NEW_COVER}`)) throw new Error("Feed does not use the cache-busting Sapiver Forge cover URL.");
if (feed.includes("clearforge-daily-brief.netlify.app")) throw new Error("Legacy hostname remains in feed.");
if (!feed.includes("<guid isPermaLink=\"false\">clearforge:")) throw new Error("Historical GUIDs were changed; refusing to continue.");
console.log("Podcast branding repair validated; historical episode GUIDs preserved.");
