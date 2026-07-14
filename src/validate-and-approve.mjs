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
if (articleWords < 650) failures.push("Article is shorter than 650 words");
if (articleWords > 1200) failures.push("Article is longer than 1200 words");
if (!feature) failures.push("Missing full feature piece");
if (feature && featureWords < 1400) failures.push("Full feature is shorter than 1,400 words");
if (featureWords > 2800) failures.push("Full feature is longer than 2,800 words");
if (feature && !/^#\s+/m.test(feature)) failures.push("Full feature has no H1 headline");
if (feature && !/##\s+Sources/i.test(feature)) failures.push("Full feature has no Sources section");
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
  if (!value) failures.push(`Missing ${name.replaceAll("_", " ")}`);
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
  if (generic) failures.push(`${platform} opens with generic brand/news language rather than an audience interest`);
  if (words < minimumWords) failures.push(`${platform} content is too short to deliver a clear audience payoff (${words} words)`);
  if (opening.split(/\s+/).filter(Boolean).length < 5) warnings.push(`${platform} opening may be too vague to identify the subject`);
  socialChecks.push({ platform, opening, words, generic_opening: generic, passed: !generic && words >= minimumWords });
}

if (socialFields.pinterest_title.split(/\s+/).filter(Boolean).length < 4) {
  failures.push("Pinterest title is too vague to express a searchable problem or useful promise");
}
if (socialFields.pinterest_description.split(/\s+/).filter(Boolean).length < 20) {
  failures.push("Pinterest description is too short to explain the searchable payoff");
}
if (!/[?]/.test(socialFields.facebook_post)) {
  warnings.push("Facebook post has no meaningful audience question; confirm it invites a real workflow or experience response");
}

const quoteLines = Array.isArray(social.quote_card_lines) ? social.quote_card_lines.map((x) => String(x || "").trim()) : [];
if (quoteLines.length !== 5) failures.push(`Expected 5 quote/card lines, got ${quoteLines.length}`);
for (const [i, line] of quoteLines.entries()) {
  if (line.split(/\s+/).filter(Boolean).length < 5) failures.push(`Quote/card line ${i + 1} is too vague to carry a complete useful idea`);
}

const uniqueHosts = new Set(sources.map((s) => { try { return new URL(s.url).hostname; } catch { return ""; } }).filter(Boolean));
if (uniqueHosts.size < 2) failures.push("Fewer than two distinct source domains");

const approved = failures.length === 0;
const approval = {
  date: DATE,
  article_approved: approved,
  feature_approved: approved,
  facebook_approved: approved,
  pinterest_approved: approved,
  youtube_approved: approved,
  dev_approved: approved,
  notes: approved
    ? "Automatically approved after factual, editorial and social-interest validation checks passed."
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
    article_words: articleWords,
    feature_words: featureWords,
    unique_source_domains: uniqueHosts.size,
    unresolved_claim_count: openClaims.length,
    social_interest_checks_passed: socialChecks.filter((item) => item.passed).length,
    social_interest_checks_total: socialChecks.length
  }
};

const socialInterestReport = {
  date: DATE,
  principle: "Clearforge social assets must clearly signal a subject and payoff to a relevant stranger, because distribution is driven by viewer interest rather than follower count alone.",
  passed: socialChecks.every((item) => item.passed) && !failures.some((item) => /Pinterest|Quote\/card|social|TikTok|YouTube|Facebook|LinkedIn/i.test(item)),
  checks: socialChecks,
  pinterest: {
    title: socialFields.pinterest_title,
    title_words: socialFields.pinterest_title.split(/\s+/).filter(Boolean).length,
    description_words: socialFields.pinterest_description.split(/\s+/).filter(Boolean).length
  },
  warnings: warnings.filter((item) => /Facebook|opening|audience/i.test(item))
};

fs.writeFileSync(approvalPath, JSON.stringify(approval, null, 2) + "\n");
fs.writeFileSync(validationPath, JSON.stringify(validation, null, 2) + "\n");
fs.writeFileSync(socialInterestPath, JSON.stringify(socialInterestReport, null, 2) + "\n");

console.log(`Validation ${approved ? "passed" : "failed"} for ${DATE}`);
if (!approved) process.exit(2);
