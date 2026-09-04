import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { generateStructured } from "./gemini-provider.mjs";

const ROOT = process.cwd();
const WEEK_END = String(process.env.PODCAST_WEEK_END || new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date())).trim();
const BASE = String(process.env.BLOG_BASE_URL || "https://suite.sapiverpress.co.uk").replace(/\/$/, "");
if (!/^\d{4}-\d{2}-\d{2}$/.test(WEEK_END)) throw new Error("PODCAST_WEEK_END must use YYYY-MM-DD.");

const end = new Date(`${WEEK_END}T12:00:00Z`);
const start = new Date(end); start.setUTCDate(start.getUTCDate() - 6);
const iso = (date) => date.toISOString().slice(0, 10);
const WEEK_START = iso(start);
const OUT = path.join(ROOT, "reports", "weekly-intelligence", WEEK_END);
const slug = `${WEEK_END}-weekly-intelligence`;
const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
fs.mkdirSync(OUT, { recursive: true });

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function loadDailyEditions() {
  const root = path.join(ROOT, "news-intelligence");
  if (!fs.existsSync(root)) return [];
  const editions = [];
  for (const date of fs.readdirSync(root).sort()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < WEEK_START || date > WEEK_END) continue;
    const file = path.join(root, date, "manifest.json");
    if (!fs.existsSync(file)) continue;
    const manifest = readJson(file);
    if (manifest.type !== "sapiver_forge_news_intelligence") continue;
    if (!Array.isArray(manifest.stories) || manifest.stories.length < 1) continue;
    if (manifest.newsletter_ready_for_human_approval !== true) continue;
    if (Number(manifest.overall_confidence || 0) < 0.78) continue;
    editions.push(manifest);
  }
  return editions;
}

const PODCAST_SCHEMA = {
  type: "object",
  properties: {
    episode_title: { type: "string" },
    episode_description: { type: "string" },
    opening: { type: "string" },
    sections: {
      type: "array",
      minItems: 4,
      maxItems: 7,
      items: {
        type: "object",
        properties: {
          heading: { type: "string" },
          narration: { type: "string" }
        },
        required: ["heading", "narration"]
      }
    },
    closing: { type: "string" },
    estimated_duration_minutes: { type: "number" }
  },
  required: ["episode_title", "episode_description", "opening", "sections", "closing", "estimated_duration_minutes"]
};

function buildInput(editions) {
  return editions.map((edition) => `DATE ${edition.date}\n${edition.stories.map((story, index) => `${index + 1}. ${story.headline}\nConfirmed: ${story.confirmed_fact}\nWhy it matters: ${story.why_it_matters}\nInterpretation: ${story.interpretation}\nSource: ${story.source} — ${story.url}\nConfidence: ${story.confidence}`).join("\n\n")}\nPractical takeaway: ${edition.practical_takeaway}\nWatch next: ${edition.watch_next}`).join("\n\n---\n\n");
}

function makeTranscript(podcast) {
  const parts = [podcast.opening, ...podcast.sections.map((section) => section.narration), podcast.closing]
    .map((part) => clean(part))
    .filter(Boolean);
  const text = parts.join("\n\n");
  if (/https?:\/\//i.test(text)) throw new Error("Podcast narration contains a raw URL.");
  if (/\[[^\]]+\]/.test(text)) throw new Error("Podcast narration contains stage directions.");
  return text;
}

function weeklyArticleHtml(podcast, editions, sources) {
  const highlights = editions.flatMap((edition) => edition.stories.map((story) => ({ ...story, date: edition.date })))
    .sort((a, b) => Number(b.confidence || 0) - Number(a.confidence || 0))
    .slice(0, 8);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(podcast.episode_title)} | Sapiver Forge</title><meta name="description" content="${esc(podcast.episode_description)}"><link rel="stylesheet" href="/styles.css"></head><body><header class="site-header"><a class="brand" href="/">Sapiver Forge</a><p>Human-led. AI-empowered.</p></header><main class="content"><section class="hero"><p class="eyebrow">Weekly Intelligence · ${esc(WEEK_END)}</p><h1>${esc(podcast.episode_title)}</h1><p>${esc(podcast.episode_description)}</p><p><a href="/podcast/">Listen to the Sapiver Forge AI Briefing</a></p></section><section class="posts"><h2>The week that mattered</h2>${highlights.map((story) => `<article><h3>${esc(story.headline)}</h3><p><strong>Confirmed:</strong> ${esc(story.confirmed_fact)}</p><p><strong>Why it matters:</strong> ${esc(story.why_it_matters)}</p><p><a href="${esc(story.url)}">${esc(story.source)} source</a></p></article>`).join("")}<h2>Source set</h2><ul>${sources.map((source) => `<li><a href="${esc(source.url)}">${esc(source.source)} — ${esc(source.title)}</a></li>`).join("")}</ul></section></main></body></html>`;
}

async function main() {
  const editions = loadDailyEditions();
  if (editions.length < 3) throw new Error(`Need at least three verification-ready Daily Brief editions between ${WEEK_START} and ${WEEK_END}; found ${editions.length}.`);
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required to synthesise the weekly podcast.");

  const podcast = await generateStructured({
    system: [
      "You write Sapiver Forge's weekly intelligence podcast for practical UK listeners.",
      "Synthesis is the point: do not simply read each daily newsletter in order.",
      "Separate confirmed facts from interpretation, avoid hype and investment advice, and do not invent new facts.",
      "The spoken script must sound natural when read by a calm British voice. Do not include stage directions or raw URLs."
    ],
    prompt: `Create the weekly Sapiver Forge Intelligence Brief covering ${WEEK_START} to ${WEEK_END}.\n\nTarget a focused 5-8 minutes of spoken audio, roughly 650-1,050 words total. Choose only the four or five developments that mattered most across AI, technology, business, research and developer activity. Connect related developments and explain what changed over the week. End briefly with what is worth watching next. Do not pad the script or repeat facts simply to make it longer.\n\nDo not mention source URLs in spoken narration. Do not claim predictions are facts. Do not advertise products.\n\nVERIFIED DAILY EDITIONS:\n\n${buildInput(editions)}`,
    schema: PODCAST_SCHEMA
  });

  const transcript = makeTranscript(podcast);
  const wordCount = transcript.split(/\s+/).filter(Boolean).length;
  if (wordCount < 500) throw new Error(`Weekly podcast script is too short (${wordCount} words).`);
  if (wordCount > 1400) throw new Error(`Weekly podcast script is too long (${wordCount} words).`);

  const allSources = [];
  const seen = new Set();
  for (const edition of editions) {
    for (const story of edition.stories) {
      if (!story.url || seen.has(story.url)) continue;
      seen.add(story.url);
      allSources.push({ source: story.source, title: story.source_title || story.headline, url: story.url, date: edition.date });
    }
  }
  const sourceNotes = `# Sources for ${podcast.episode_title}\n\nThis episode synthesises verification-ready Sapiver Forge Daily Brief editions from ${WEEK_START} to ${WEEK_END}.\n\n${allSources.map((source) => `- ${source.date} — [${source.source}: ${source.title}](${source.url})`).join("\n")}`;
  const metadataCore = {
    episode: {
      episode_title: clean(podcast.episode_title),
      episode_description: clean(podcast.episode_description),
      date: WEEK_END,
      published_at: `${WEEK_END}T09:00:00Z`,
      estimated_duration_minutes: Math.max(4, Math.min(10, Number(podcast.estimated_duration_minutes || wordCount / 145))),
      selection_reason: `Weekly synthesis of ${editions.length} verification-ready Sapiver Forge Daily Brief editions.`,
      related_article_url: `${BASE}/posts/${slug}.html`,
      related_feature_url: `${BASE}/features/${slug}.html`
    },
    week_start: WEEK_START,
    week_end: WEEK_END,
    source_edition_count: editions.length,
    source_count: allSources.length,
    word_count: wordCount,
    slug,
    human_approval_required: true,
    approved_for_automatic_publication: false
  };
  const candidateId = crypto.createHash("sha256")
    .update(JSON.stringify({ metadata: metadataCore, transcript, sources: allSources }))
    .digest("hex");
  const metadata = { ...metadataCore, candidate_id: candidateId };
  const scriptMd = `# ${podcast.episode_title}\n\n${podcast.episode_description}\n\n## Opening\n\n${podcast.opening}\n\n${podcast.sections.map((section) => `## ${section.heading}\n\n${section.narration}`).join("\n\n")}\n\n## Closing\n\n${podcast.closing}\n`;
  const articleHtml = weeklyArticleHtml(podcast, editions, allSources);

  // Retain the established filename because the feed publisher also uses it as the public transcript.
  fs.writeFileSync(path.join(OUT, "COPY_PASTE_INTO_ELEVENLABS.txt"), transcript + "\n", "utf8");
  fs.writeFileSync(path.join(OUT, "podcast-script.md"), scriptMd, "utf8");
  fs.writeFileSync(path.join(OUT, "episode-metadata.json"), JSON.stringify(metadata, null, 2) + "\n", "utf8");
  fs.writeFileSync(path.join(OUT, "source-notes.md"), sourceNotes + "\n", "utf8");
  fs.writeFileSync(path.join(OUT, "weekly-article.html"), articleHtml, "utf8");
  const sealedFiles = ["COPY_PASTE_INTO_ELEVENLABS.txt", "podcast-script.md", "episode-metadata.json", "source-notes.md", "weekly-article.html"];
  const fileHashes = Object.fromEntries(sealedFiles.map((name) => [
    name,
    crypto.createHash("sha256").update(fs.readFileSync(path.join(OUT, name))).digest("hex")
  ]));
  fs.writeFileSync(path.join(OUT, "candidate-manifest.json"), JSON.stringify({
    schema_version: 1,
    type: "sapiver_forge_weekly_intelligence_podcast",
    week_start: WEEK_START,
    week_end: WEEK_END,
    candidate_id: candidateId,
    human_approval_required: true,
    approved_for_automatic_publication: false,
    file_hashes: fileHashes
  }, null, 2) + "\n", "utf8");

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `week_end=${WEEK_END}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `slug=${slug}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `report_dir=${path.relative(ROOT, OUT).replaceAll("\\", "/")}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `candidate_id=${candidateId}\n`);
  }
  console.log(`Generated sealed weekly intelligence podcast candidate ${candidateId}: ${wordCount} words from ${editions.length} daily editions.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
