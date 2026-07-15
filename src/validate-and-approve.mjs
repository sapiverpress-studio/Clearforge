import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATE = process.env.CLEARFORGE_DATE || new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());

const draftDir = path.join(ROOT, "drafts", DATE);
const structuredPath = path.join(draftDir, "structured_output.json");
const featurePath = path.join(draftDir, "feature.md");
const approvalPath = path.join(draftDir, "approval.json");
const validationPath = path.join(draftDir, "validation.json");
const socialInterestPath = path.join(draftDir, "social_interest_report.json");

if (!fs.existsSync(structuredPath)) throw new Error(`Missing ${structuredPath}`);
const data = JSON.parse(fs.readFileSync(structuredPath, "utf8"));

// Hard failures protect factual accuracy, safety and basic publishability.
// Editorial and formatting imperfections are warnings so a usable edition can publish.
const failures = [];
const warnings = [];

const sources = Array.isArray(data.sources) ? data.sources : [];
const stories = Array.isArray(data.story_summaries) ? data.story_summaries : [];
const article = String(data.main_article || "").trim();
const feature = fs.existsSync(featurePath) ? fs.readFileSync(featurePath, "utf8").trim() : "";
const social = data.social || {};
const openClaims = Array.isArray(data.claims_to_verify)
  ? data.claims_to_verify.map((claim) => String(claim || "").trim()).filter(Boolean)
  : [];
const articleWords = article.split(/\s+/).filter(Boolean).length;
const featureWords = feature.split(/\s+/).filter(Boolean).length;

if (sources.length < 3 || sources.length > 5) failures.push(`Expected 3–5 sources, got ${sources.length}`);
if (stories.length < 3 || stories.length > 5) failures.push(`Expected 3–5 stories, got ${stories.length}`);
if (!article) failures.push("Missing main article");
if (article && articleWords < 500) warnings.push(`Article is shorter than the preferred 650 words (${articleWords})`);
if (articleWords > 1400) warnings.push(`Article is longer than the preferred 1,200 words (${articleWords})`);
if (!feature) warnings.push("Missing full feature piece; daily article and social channels may still publish");
if (feature && featureWords < 1200) warnings.push(`Full feature is shorter than the preferred 1,400 words (${featureWords})`);
if (featureWords > 3000) warnings.push(`Full feature is longer than the preferred 2,800 words (${featureWords})`);
if (feature && !/^#\s+/m.test(feature)) warnings.push("Full feature has no H1 headline");
if (feature && !/##\s+Sources/i.test(feature)) warnings.push("Full feature has no exact Sources section heading");
if (openClaims.length) failures.push(`Unresolved claims remain: ${openClaims.join(" | ")}`);

for (const [i, story] of stories.entries()) {
  const check = String(story?.claim_to_verify || "").trim();
  if (!/^none\b/i.test(check)) {
    failures.push(`Story ${i + 1} still has an unresolved verification check: ${check || "missing claim_to_verify"}`);
  }
}

const urls = new Set();
const editionDate = new Date(`${String(DATE).slice(0, 10)}T23:59:59Z`);
for (const [i, source] of sources.entries()) {
  if (!source?.url || !/^https:\/\//i.test(source.url)) failures.push(`Source ${i + 1} has no valid HTTPS URL`);
  if (!source?.published_date || !/^\d{4}-\d{2}-\d{2}$/.test(source.published_date)) {
    failures.push(`Source ${i + 1} has invalid date`);
  } else {
    const published = new Date(`${source.published_date}T00:00:00Z`);
    if (published > editionDate) failures.push(`Source ${i + 1} has a future publication date: ${source.published_date}`);
    const ageDays = Math.floor((editionDate - published) / 86400000);
    if (ageDays > 7) warnings.push(`Source ${i + 1} is ${ageDays} days old; confirm it is background rather than current news`);
  }
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
const joined = `${JSON.stringify(data)}\n${feature}`;
for (const pattern of bannedPatterns) if (pattern.test(joined)) failures.push(`Blocked wording matched ${pattern}`);

const socialFields = {
  tiktok_script: String(social.tiktok_script || "").trim(),
  youtube_shorts_script: String(social.youtube_shorts_script || "").trim(),
  facebook_post: String(social.facebook_post || "").trim(),
  pinterest_title: String(social.pinterest_title || "").trim(),
  pinterest_description: String(social.pinterest_description || "").trim(),
  linkedin_post: String(social.linkedin_post || "").trim()
};

for (const [name, value] of Object.entries(socialFields)) {
  if (!value) warnings.push(`Missing ${name.replaceAll("_", " ")}; that channel will be skipped`);
}

const genericOpeningPatterns = [
  /^ai news is noisy\b/i,
  /^today in (practical )?ai\b/i,
  /^here(?:'s| is) the latest ai news\b/i,
  /^clearforge\b/i,
  /^in today(?:'s)? (?:ai )?(?:news|brief)\b/i
];

function firstSentence(value) {
  return String(value || "").split(/(?<=[.!?])\s+|\n+/)[0].trim();
}

const shortFormChecks = [
  ["TikTok", socialFields.tiktok_script, 45],
  ["YouTube Shorts", socialFields.youtube_shorts_script, 45],
  ["Facebook", socialFields.facebook_post, 35],
  ["LinkedIn", socialFields.linkedin_post, 35]
];

const socialChecks = [];
for (const [platform, value, minimumWords] of shortFormChecks) {
  const opening = firstSentence(value);
  const words = value.split(/\s+/).filter(Boolean).length;
  const generic = genericOpeningPatterns.some((pattern) => pattern.test(opening));
  if (value && generic) warnings.push(`${platform} opens with generic brand/news language rather than an audience interest`);
  if (value && words < minimumWords) warnings.push(`${platform} content is shorter than preferred (${words} words)`);
  if (value && opening.split(/\s+/).filter(Boolean).length < 5) warnings.push(`${platform} opening may be too vague to identify the subject`);
  socialChecks.push({ platform, opening, words, generic_opening: generic, passed: Boolean(value) });
}

if (socialFields.pinterest_title && socialFields.pinterest_title.split(/\s+/).filter(Boolean).length < 4) {
  warnings.push("Pinterest title may be too vague to express a searchable problem or useful promise");
}
if (socialFields.pinterest_description && socialFields.pinterest_description.split(/\s+/).filter(Boolean).length < 20) {
  warnings.push("Pinterest description may be too short to explain the searchable payoff");
}
if (socialFields.facebook_post && !/[?]/.test(socialFields.facebook_post)) {
  warnings.push("Facebook post has no meaningful audience question");
}

const quoteLines = Array.isArray(social.quote_card_lines) ? social.quote_card_lines.map((x) => String(x || "").trim()) : [];
if (quoteLines.length !== 5) warnings.push(`Expected 5 quote/card lines, got ${quoteLines.length}`);
for (const [i, line] of quoteLines.entries()) {
  if (line && line.split(/\s+/).filter(Boolean).length < 5) warnings.push(`Quote/card line ${i + 1} may be too vague`);
}

const uniqueHosts = new Set(sources.map((s) => { try { return new URL(s.url).hostname; } catch { return ""; } }).filter(Boolean));
if (uniqueHosts.size < 2) failures.push("Fewer than two distinct source domains");

const coreApproved = failures.length === 0;
const approval = {
  date: DATE,
  article_approved: coreApproved && Boolean(article),
  feature_approved: coreApproved && Boolean(feature),
  facebook_approved: coreApproved && Boolean(socialFields.facebook_post),
  pinterest_approved: coreApproved && Boolean(socialFields.pinterest_title) && Boolean(socialFields.pinterest_description),
  youtube_approved: coreApproved && Boolean(socialFields.youtube_shorts_script),
  dev_approved: coreApproved && Boolean(feature),
  notes: coreApproved
    ? `Automatically approved with ${warnings.length} non-blocking quality warning${warnings.length === 1 ? "" : "s"}.`
    : `Automatically blocked for factual or safety reasons: ${failures.join("; ")}`
};

const validation = {
  date: DATE,
  passed: coreApproved,
  policy: "Only factual, sourcing, safety and minimum-content failures block publication. Editorial and formatting issues are warnings.",
  failures,
  warnings,
  stats: {
    source_count: sources.length,
    story_count: stories.length,
    article_words: articleWords,
    feature_words: featureWords,
    unique_source_domains: uniqueHosts.size,
    unresolved_claim_count: openClaims.length,
    social_channels_present: socialChecks.filter((item) => item.passed).length,
    social_channels_total: socialChecks.length
  }
};

const socialInterestReport = {
  date: DATE,
  principle: "Clearforge social assets should clearly signal a subject and payoff, but quality imperfections do not block otherwise safe publication.",
  passed: socialChecks.every((item) => item.passed),
  checks: socialChecks,
  pinterest: {
    title: socialFields.pinterest_title,
    title_words: socialFields.pinterest_title.split(/\s+/).filter(Boolean).length,
    description_words: socialFields.pinterest_description.split(/\s+/).filter(Boolean).length
  },
  warnings: warnings.filter((item) => /Facebook|opening|audience|Pinterest|TikTok|YouTube|LinkedIn|Quote/i.test(item))
};

fs.writeFileSync(approvalPath, JSON.stringify(approval, null, 2) + "\n");
fs.writeFileSync(validationPath, JSON.stringify(validation, null, 2) + "\n");
fs.writeFileSync(socialInterestPath, JSON.stringify(socialInterestReport, null, 2) + "\n");

console.log(`Validation ${coreApproved ? "passed" : "failed"} for ${DATE}`);
if (!coreApproved) process.exit(2);
