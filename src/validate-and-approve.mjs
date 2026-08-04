import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATE = process.env.SAPIVER_FORGE_DATE || new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());

const draftDir = path.join(ROOT, "drafts", DATE);
const structuredPath = path.join(draftDir, "structured_output.json");
const featurePath = path.join(draftDir, "feature.md");
const approvalPath = path.join(draftDir, "approval.json");
const validationPath = path.join(draftDir, "validation.json");
const socialInterestPath = path.join(draftDir, "social_interest_report.json");
const factReportPath = path.join(draftDir, "fact-discipline-report.json");

if (!fs.existsSync(structuredPath)) throw new Error(`Missing ${structuredPath}`);
const data = JSON.parse(fs.readFileSync(structuredPath, "utf8"));
const feature = fs.existsSync(featurePath) ? fs.readFileSync(featurePath, "utf8").trim() : "";
const factReport = fs.existsSync(factReportPath) ? JSON.parse(fs.readFileSync(factReportPath, "utf8")) : null;

const failures = [];
const warnings = [];
const words = (value) => String(value || "").trim().split(/\s+/).filter(Boolean).length;
const sources = Array.isArray(data.sources) ? data.sources : [];
const stories = Array.isArray(data.story_summaries) ? data.story_summaries : [];
const article = String(data.main_article || "").trim();
const social = data.social || {};
const articleWords = words(article);
const featureWords = words(feature);
const openClaims = Array.isArray(data.claims_to_verify) ? data.claims_to_verify.map(String).map((x) => x.trim()).filter(Boolean) : [];

if (sources.length < 1 || sources.length > 5) failures.push(`Expected 1–5 verified sources, got ${sources.length}`);
if (stories.length < 1 || stories.length > 5) failures.push(`Expected 1–5 verified stories, got ${stories.length}`);
if (!article) failures.push("Missing main article");

const minimumArticleWords = sources.length >= 3 ? 450 : 650;
if (article && articleWords < minimumArticleWords) {
  failures.push(`Article is commercially insufficient for ${sources.length} verified source${sources.length === 1 ? "" : "s"}: ${articleWords} words; minimum ${minimumArticleWords}`);
}
if (articleWords > 1600) warnings.push(`Article is unusually long (${articleWords} words)`);
if (!feature) warnings.push("Optional feature omitted");
if (feature && featureWords < 1000) warnings.push(`Optional feature is short (${featureWords} words)`);
if (openClaims.length) failures.push(`Unresolved claims remain: ${openClaims.join(" | ")}`);

const genericHeadline = /^(?:a verified ai development|today in ai|ai news|an ai update|what happened in ai)\b/i;
if (genericHeadline.test(String(data.headline || "").trim())) failures.push("Headline is generic and does not identify the actual story");
if (words(data.headline) < 5) failures.push("Headline is too vague to identify the story");
if (words(data.practical_takeaway) < 35) failures.push("Practical takeaway is too thin to be useful");
if (words(data.what_to_test_next) < 25) failures.push("What-to-test-next section is too thin to be actionable");

for (const [i, story] of stories.entries()) {
  const check = String(story?.claim_to_verify || "").trim();
  if (!/^none\b/i.test(check)) failures.push(`Story ${i + 1} still has an unresolved verification check: ${check || "missing claim_to_verify"}`);
}

const urls = new Set();
const editionDate = new Date(`${String(DATE).slice(0, 10)}T23:59:59Z`);
for (const [i, source] of sources.entries()) {
  if (!source?.url || !/^https:\/\//i.test(source.url)) failures.push(`Source ${i + 1} has no valid HTTPS URL`);
  if (!source?.published_date || !/^\d{4}-\d{2}-\d{2}$/.test(source.published_date)) failures.push(`Source ${i + 1} has invalid date`);
  else {
    const published = new Date(`${source.published_date}T00:00:00Z`);
    if (published > editionDate) failures.push(`Source ${i + 1} has a future publication date: ${source.published_date}`);
    const ageDays = Math.floor((editionDate - published) / 86400000);
    if (ageDays > 14) warnings.push(`Source ${i + 1} is ${ageDays} days old`);
  }
  if (!source?.confirmed_fact) failures.push(`Source ${i + 1} missing confirmed_fact`);
  if (!source?.interpretation) failures.push(`Source ${i + 1} missing interpretation`);
  if (urls.has(source.url)) failures.push(`Duplicate source URL: ${source.url}`);
  urls.add(source.url);
}

if (factReport) {
  const unsupported = Number(factReport.unsupported_atomic_claim_count ?? factReport.unsupported_claim_count ?? 0);
  if (unsupported > 0) failures.push(`Fact-discipline report contains ${unsupported} unsupported atomic claim${unsupported === 1 ? "" : "s"}`);
  if (factReport.passed === false) failures.push("Fact-discipline report failed");
}

const publicCorpus = JSON.stringify(data);
if (/output-release-30-day-validation|payhip\.com\/b\/pkSEY/i.test(publicCorpus)) failures.push("Abandoned Output Release campaign leaked into current edition");
if (/\bClear\s*Forge\b/i.test(publicCorpus)) failures.push("Old Clearforge branding leaked into current edition");

const requiredSocial = {
  tiktok_script: [18, 120],
  tiktok_caption: [8, 100],
  youtube_shorts_script: [18, 140],
  facebook_post: [25, 220],
  pinterest_title: [4, 18],
  pinterest_description: [20, 120]
};
const socialChecks = [];
for (const [field, [min, max]] of Object.entries(requiredSocial)) {
  const value = String(social[field] || "").trim();
  const count = words(value);
  if (!value) failures.push(`Missing required social output: ${field}`);
  else if (count < min || count > max) failures.push(`${field} has unusable length (${count} words; expected ${min}–${max})`);
  socialChecks.push({ platform: field, words: count, passed: Boolean(value) && count >= min && count <= max });
}
if (social.linkedin_post) warnings.push("LinkedIn copy was generated but LinkedIn is not a required active channel");
if (!Array.isArray(social.quote_card_lines) || social.quote_card_lines.filter((x) => String(x || "").trim()).length !== 5) failures.push("Quote-card pack must contain five complete lines");

const bannedPatterns = [/guaranteed income/i, /guaranteed profit/i, /replace everyone/i, /100% accurate/i, /no risk/i];
for (const pattern of bannedPatterns) if (pattern.test(publicCorpus)) failures.push(`Blocked wording matched ${pattern}`);

const uniqueHosts = new Set(sources.map((s) => { try { return new URL(s.url).hostname; } catch { return ""; } }).filter(Boolean));
if (uniqueHosts.size < 1) failures.push("No distinct source domain remains");

const coreApproved = failures.length === 0;
const approval = {
  date: DATE,
  article_approved: coreApproved && Boolean(article),
  feature_approved: coreApproved && Boolean(feature),
  facebook_approved: coreApproved && Boolean(social.facebook_post),
  pinterest_approved: coreApproved && Boolean(social.pinterest_title) && Boolean(social.pinterest_description),
  youtube_approved: coreApproved && Boolean(social.youtube_shorts_script),
  dev_approved: coreApproved && Boolean(feature),
  notes: coreApproved ? `Automated factual, editorial and channel checks passed with ${warnings.length} warning${warnings.length === 1 ? "" : "s"}. Exact-candidate human approval is still required.` : `Automatically blocked: ${failures.join("; ")}`
};

const validation = {
  date: DATE,
  passed: coreApproved,
  policy: "Publication requires factual integrity, editorial sufficiency and usable outputs for every active channel. Optional podcast, feature and LinkedIn output do not block publication.",
  failures: [...new Set(failures)],
  warnings: [...new Set(warnings)],
  stats: {
    source_count: sources.length,
    story_count: stories.length,
    article_words: articleWords,
    minimum_article_words: minimumArticleWords,
    feature_words: featureWords,
    unique_source_domains: uniqueHosts.size,
    unresolved_claim_count: openClaims.length,
    social_channels_present: socialChecks.filter((item) => item.passed).length,
    social_channels_total: socialChecks.length
  }
};

const socialInterestReport = {
  date: DATE,
  principle: "Every active-channel asset must be complete, identify the subject and offer a clear audience payoff.",
  passed: socialChecks.every((item) => item.passed),
  checks: socialChecks,
  warnings: warnings.filter((item) => /Facebook|Pinterest|TikTok|YouTube|LinkedIn|Quote/i.test(item))
};

fs.writeFileSync(approvalPath, JSON.stringify(approval, null, 2) + "\n");
fs.writeFileSync(validationPath, JSON.stringify(validation, null, 2) + "\n");
fs.writeFileSync(socialInterestPath, JSON.stringify(socialInterestReport, null, 2) + "\n");
console.log(`Validation ${coreApproved ? "passed" : "failed"} for ${DATE}`);
if (!coreApproved) process.exit(2);
