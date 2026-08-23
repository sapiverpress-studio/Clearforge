import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATE = String(process.env.NEWS_INTELLIGENCE_DATE || "").trim();
const REQUESTED = String(process.env.NEWS_INTELLIGENCE_CANDIDATE_ID || "").trim();
const BASE = String(process.env.BLOG_BASE_URL || "https://sapiverforge-daily-brief.netlify.app").replace(/\/$/, "");

if (!/^\d{4}-\d{2}-\d{2}$/.test(DATE)) throw new Error("NEWS_INTELLIGENCE_DATE must use YYYY-MM-DD.");
if (!REQUESTED) throw new Error("NEWS_INTELLIGENCE_CANDIDATE_ID is required.");

const sourceDir = path.join(ROOT, "news-intelligence", DATE);
const manifestPath = path.join(sourceDir, "manifest.json");
if (!fs.existsSync(manifestPath)) throw new Error(`Missing intelligence candidate for ${DATE}.`);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
if (manifest.candidate_id !== REQUESTED) throw new Error("Candidate ID mismatch; refusing website publication.");
if (manifest.newsletter_ready_for_human_approval !== true) throw new Error("Candidate is not verification-ready.");
if (Number(manifest.overall_confidence || 0) < 0.78) throw new Error("Candidate is below the website publication confidence threshold.");

const esc = (value) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const publicRoot = path.join(ROOT, "public", "daily-brief", "intelligence");
const articleDir = path.join(publicRoot, DATE);
fs.mkdirSync(articleDir, { recursive: true });

const title = clean(manifest.newsletter_subject || `Sapiver Forge Daily Brief — ${DATE}`);
const stories = Array.isArray(manifest.stories) ? manifest.stories : [];
if (!stories.length) throw new Error("Candidate contains no stories.");

const storyHtml = stories.map((story, index) => `<article class="intelligence-story">
<p class="eyebrow">${esc(story.category || "Briefing")} · ${esc(story.source || "Source")}</p>
<h2>${esc(story.headline)}</h2>
<p><strong>Confirmed:</strong> ${esc(story.confirmed_fact)}</p>
<p><strong>Why it matters:</strong> ${esc(story.why_it_matters)}</p>
<p><strong>Our read:</strong> ${esc(story.interpretation)}</p>
<p><a href="${esc(story.url)}" rel="noopener noreferrer">Open the source for story ${index + 1}</a></p>
</article>`).join("\n");

const article = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | Sapiver Forge</title><meta name="description" content="Verified Sapiver Forge intelligence covering AI, technology and business developments for ${esc(DATE)}."><link rel="canonical" href="${BASE}/daily-brief/intelligence/${DATE}/"><link rel="stylesheet" href="/styles.css"></head><body><header class="site-header"><a class="brand" href="/">Sapiver Forge</a><p>Human-led. AI-empowered.</p><nav aria-label="Site links"><a href="/">Sapiver Forge</a><a href="/daily-brief/">Daily Brief</a><a href="/daily-brief/intelligence/">Intelligence archive</a><a href="/newsletter/">Daily Brief email</a></nav></header><main class="content"><section class="hero"><p class="eyebrow">Verified Daily Intelligence · ${esc(DATE)}</p><h1>${esc(title)}</h1><p>Confirmed reporting is separated from Sapiver Forge interpretation. Every story links back to its source.</p></section><section class="posts">${storyHtml}</section><section class="posts"><h2>Practical takeaway</h2><p>${esc(manifest.practical_takeaway || "")}</p><h2>What to watch next</h2><p>${esc(manifest.watch_next || "")}</p></section><section class="posts"><p><a class="button" href="/daily-brief/intelligence/">Browse Daily Brief intelligence</a> <a class="button button-secondary" href="/newsletter/">Get the weekday email</a></p></section></main><footer class="site-footer"><p>Produced with AI assistance and released with human approval by Sapiver Forge.</p></footer></body></html>`;
fs.writeFileSync(path.join(articleDir, "index.html"), article, "utf8");

const release = {
  date: DATE,
  candidate_id: REQUESTED,
  title,
  url: `/daily-brief/intelligence/${DATE}/`,
  released_at: new Date().toISOString(),
  story_count: stories.length,
  practical_takeaway: clean(manifest.practical_takeaway || "")
};
fs.writeFileSync(path.join(sourceDir, "site-release.json"), JSON.stringify(release, null, 2) + "\n", "utf8");

const releases = [];
const intelligenceRoot = path.join(ROOT, "news-intelligence");
if (fs.existsSync(intelligenceRoot)) {
  for (const name of fs.readdirSync(intelligenceRoot).sort().reverse()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(name)) continue;
    const releasePath = path.join(intelligenceRoot, name, "site-release.json");
    if (!fs.existsSync(releasePath)) continue;
    try { releases.push(JSON.parse(fs.readFileSync(releasePath, "utf8"))); } catch {}
  }
}

const indexCards = releases.map((item, index) => `<article><p class="eyebrow">${index === 0 ? "Latest verified edition" : esc(item.date)}</p><h2><a href="${esc(item.url)}">${esc(item.title)}</a></h2><p>${esc(item.practical_takeaway || `${item.story_count || 0} verified stories.`)}</p></article>`).join("\n");
const index = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Daily Brief Intelligence | Sapiver Forge</title><meta name="description" content="Sapiver Forge's verified weekday intelligence archive covering AI, technology and business."><link rel="canonical" href="${BASE}/daily-brief/intelligence/"><link rel="stylesheet" href="/styles.css"></head><body><header class="site-header"><a class="brand" href="/">Sapiver Forge</a><p>Human-led. AI-empowered.</p><nav aria-label="Site links"><a href="/">Sapiver Forge</a><a href="/daily-brief/">Daily Brief</a><a href="/podcast/">Podcast</a><a href="/newsletter/">Daily Brief email</a></nav></header><main class="content"><section class="hero"><p class="eyebrow">Sapiver Forge Daily Brief</p><h1>Verified intelligence archive</h1><p>Weekday reporting on AI, technology and business with confirmed facts separated from interpretation.</p></section><section class="posts">${indexCards || "<p>No approved intelligence editions have been released yet.</p>"}</section></main><footer class="site-footer"><p>Produced with AI assistance and released with human approval by Sapiver Forge.</p></footer></body></html>`;
fs.writeFileSync(path.join(publicRoot, "index.html"), index, "utf8");
fs.writeFileSync(path.join(publicRoot, "editions.json"), JSON.stringify(releases, null, 2) + "\n", "utf8");
console.log(`Published approved intelligence candidate ${REQUESTED} to the website source for ${DATE}.`);
