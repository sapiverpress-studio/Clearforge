import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATE = process.env.CLEARFORGE_DATE || new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());

const draftDir = path.join(ROOT, "drafts", DATE);
const structuredPath = path.join(draftDir, "structured_output.json");
const approvalPath = path.join(draftDir, "approval.json");
const validationPath = path.join(draftDir, "validation.json");

if (!fs.existsSync(structuredPath)) throw new Error(`Missing ${structuredPath}`);
const data = JSON.parse(fs.readFileSync(structuredPath, "utf8"));

const failures = [];
const warnings = [];

const sources = Array.isArray(data.sources) ? data.sources : [];
const stories = Array.isArray(data.story_summaries) ? data.story_summaries : [];
const article = String(data.main_article || "").trim();
const social = data.social || {};

if (sources.length < 3 || sources.length > 5) failures.push(`Expected 3–5 sources, got ${sources.length}`);
if (stories.length < 3 || stories.length > 5) failures.push(`Expected 3–5 stories, got ${stories.length}`);
if (article.split(/\s+/).filter(Boolean).length < 650) failures.push("Article is shorter than 650 words");
if (article.split(/\s+/).filter(Boolean).length > 1200) failures.push("Article is longer than 1200 words");

const urls = new Set();
for (const [i, source] of sources.entries()) {
  if (!source?.url || !/^https:\/\//i.test(source.url)) failures.push(`Source ${i + 1} has no valid HTTPS URL`);
  if (!source?.published_date || !/^\d{4}-\d{2}-\d{2}$/.test(source.published_date)) failures.push(`Source ${i + 1} has invalid date`);
  if (!source?.confirmed_fact) failures.push(`Source ${i + 1} missing confirmed_fact`);
  if (!source?.interpretation) failures.push(`Source ${i + 1} missing interpretation`);
  if (urls.has(source.url)) failures.push(`Duplicate source URL: ${source.url}`);
  urls.add(source.url);
}

const bannedPatterns = [
  /guaranteed income/i,
  /guaranteed profit/i,
  /replace everyone/i,
  /100% accurate/i,
  /no risk/i
];
const joined = JSON.stringify(data);
for (const pattern of bannedPatterns) if (pattern.test(joined)) failures.push(`Blocked wording matched ${pattern}`);

if (!String(social.facebook_post || "").trim()) failures.push("Missing Facebook post");
if (!String(social.youtube_shorts_script || "").trim()) failures.push("Missing YouTube Shorts script");
if (!String(social.pinterest_title || "").trim()) failures.push("Missing Pinterest title");
if (!String(social.pinterest_description || "").trim()) failures.push("Missing Pinterest description");

const uniqueHosts = new Set(sources.map((s) => { try { return new URL(s.url).hostname; } catch { return ""; } }).filter(Boolean));
if (uniqueHosts.size < 2) warnings.push("Fewer than two distinct source domains");

const approved = failures.length === 0;
const approval = {
  date: DATE,
  article_approved: approved,
  facebook_approved: approved,
  pinterest_approved: approved,
  youtube_approved: approved,
  notes: approved
    ? "Automatically approved after deterministic validation checks passed."
    : `Automatically blocked: ${failures.join("; ")}`
};

const validation = {
  date: DATE,
  passed: approved,
  failures,
  warnings,
  stats: {
    source_count: sources.length,
    story_count: stories.length,
    article_words: article.split(/\s+/).filter(Boolean).length,
    unique_source_domains: uniqueHosts.size
  }
};

fs.writeFileSync(approvalPath, JSON.stringify(approval, null, 2) + "\n");
fs.writeFileSync(validationPath, JSON.stringify(validation, null, 2) + "\n");

console.log(`Validation ${approved ? "passed" : "failed"} for ${DATE}`);
if (!approved) process.exit(2);
