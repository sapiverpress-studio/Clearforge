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
const claimVerificationPath = path.join(draftDir, "claim-verification.json");

if (!fs.existsSync(structuredPath)) throw new Error(`Missing ${structuredPath}`);
const data = JSON.parse(fs.readFileSync(structuredPath, "utf8"));
const claimVerification = fs.existsSync(claimVerificationPath)
  ? JSON.parse(fs.readFileSync(claimVerificationPath, "utf8"))
  : null;

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
const editionDate = new Date(`${String(DATE).slice(0, 10)}T23:59:59Z`);

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function validateFreshness(item, label) {
  if (!validDate(item?.event_date)) {
    failures.push(`${label} has invalid or missing event_date`);
    return;
  }
  if (!["current", "background"].includes(item?.freshness_status)) {
    failures.push(`${label} has invalid or missing freshness_status`);
    return;
  }
  const eventDate = new Date(`${item.event_date}T00:00:00Z`);
  const ageDays = Math.floor((editionDate - eventDate) / 86400000);
  if (eventDate > editionDate) failures.push(`${label} has a future event date: ${item.event_date}`);
  if (item.freshness_status === "current" && ageDays > 7) {
    failures.push(`${label} is ${ageDays} days old and cannot be approved as current`);
  }
  if (item.freshness_status === "background" && ageDays <= 7) {
    failures.push(`${label} is within seven days but is inconsistently labelled background`);
  }
}

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
if (!claimVerification) {
  failures.push("Independent claim-verification report is missing");
} else {
  if (claimVerification.passed !== true) failures.push("Independent claim verification did not pass");
  if (Number(claimVerification.confidence) < 0.9) {
    failures.push(`Claim-verification confidence is below 0.90 (${Number(claimVerification.confidence) || 0})`);
  }
  for (const finding of claimVerification.blocking_findings || []) {
    failures.push(`Claim verification: ${finding.exact_claim || finding.reason || "blocking finding"}`);
  }
  for (const output of claimVerification.missing_outputs || []) {
    failures.push(`Claim verifier did not inspect complete output: ${output}`);
  }
}

for (const [i, story] of stories.entries()) {
  const check = String(story?.claim_to_verify || "").trim();
  if (!/^none\b/i.test(check)) {
    failures.push(`Story ${i + 1} still has an unresolved verification check: ${check || "missing claim_to_verify"}`);
  }
  validateFreshness(story, `Story ${i + 1}`);
}

const urls = new Set();
for (const [i, source] of sources.entries()) {
  if (!source?.url || !/^https:\/\//i.test(source.url)) failures.push(`Source ${i + 1} has no valid HTTPS URL`);
  if (!source?.published_date || !/^\d{4}-\d{2}-\d{2}$/.test(source.published_date)) {
    failures.push(`Source ${i + 1} has invalid date`);
  } else {
    const published = new Date(`${source.published_date}T00:00:00Z`);
    if (published > editionDate) failures.push(`Source ${i + 1} has a future publication date: ${source.published_date}`);
  }
  validateFreshness(source, `Source ${i + 1}`);
  if (validDate(source?.published_date) && validDate(source?.event_date) && source.event_date > source.published_date) {
    failures.push(`Source ${i + 1} claims event date ${source.event_date} after publication date ${source.published_date}`);
  }
  if (!source?.freshness_basis) failures.push(`Source ${i + 1} missing freshness_basis`);
  if (!source?.confirmed_fact) failures.push(`Source ${i + 1} missing confirmed_fact`);
  if (!source?.interpretation) failures.push(`Source ${i + 1} missing interpretation`);
  if (urls.has(source.url)) failures.push(`Duplicate source URL: ${source.url}`);
  urls.add(source.url);
}

if (sources.length === stories.length) {
  sources.forEach((source, index) => {
    const story = stories[index];
    if (source.event_date !== story.event_date || source.freshness_status !== story.freshness_status) {
      failures.push(`Source and story ${index + 1} disagree on event date or freshness`);
    }
  });
}

const currentConfirmedSources = sources.filter((item) => item.coverage_lane === "confirmed_development" && item.freshness_status === "current").length;
const currentConfirmedStories = stories.filter((item) => item.coverage_lane === "confirmed_development" && item.freshness_status === "current").length;
const currentImpactSources = sources.filter((item) => item.coverage_lane === "human_impact" && item.freshness_status === "current").length;
const currentImpactStories = stories.filter((item) => item.coverage_lane === "human_impact" && item.freshness_status === "current").length;
if (currentConfirmedSources < 2 || currentConfirmedStories < 2) {
  failures.push("Fewer than two current confirmed developments pass the seven-day freshness gate");
}
if (currentImpactSources < 1 || currentImpactStories < 1) {
  failures.push("No current evidence-based human-impact story passes the seven-day freshness gate");
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
  /^in today(?:'s)? (?:ai )?(?:news|brief)\b/i,
  /\b(?:three|four|five|\d+)\s+(?:ai\s+)?updates?\b/i,
  /\bai updates? that (?:actually )?matter\b/i
];

function firstSentence(value) {
  return String(value || "").split(/(?<=[.!?])\s+|\n+/)[0].trim();
}

const shortFormChecks = [
  ["TikTok", socialFields.tiktok_script, 18],
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

const tiktokOpening = firstSentence(socialFields.tiktok_script);
const tiktokWords = socialFields.tiktok_script.split(/\s+/).filter(Boolean).length;
if (socialFields.tiktok_script && (tiktokWords < 18 || tiktokWords > 30)) {
  failures.push(`TikTok script must contain 18–30 spoken words; got ${tiktokWords}`);
}
if (socialFields.tiktok_script && !/\b(freelanc\w*|client(?:-facing)? work|work (?:for|to) (?:a |your )?client|send(?:ing)? .* client)\b/i.test(tiktokOpening)) {
  failures.push("TikTok opening does not identify the freelancer/client-work audience");
}
if (socialFields.tiktok_script && genericOpeningPatterns.some((pattern) => pattern.test(tiktokOpening))) {
  failures.push("TikTok opening uses the failed generic AI-update format");
}
if (socialFields.tiktok_script && !/\b(check|verify|confirm|compare|review|keep|remove|record|open|read|stop|pause|ask|decide|label|mark|ensure|inspect|test)\b|make sure|look for|double[- ]check/i.test(socialFields.tiktok_script)) {
  failures.push("TikTok script gives no immediate practical check");
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
  automated_checks_passed: coreApproved,
  human_approval_required: true,
  article_approved: coreApproved && Boolean(article),
  feature_approved: coreApproved && Boolean(feature),
  facebook_approved: coreApproved && Boolean(socialFields.facebook_post),
  pinterest_approved: coreApproved && Boolean(socialFields.pinterest_title) && Boolean(socialFields.pinterest_description),
  youtube_approved: coreApproved && Boolean(socialFields.youtube_shorts_script),
  dev_approved: coreApproved && Boolean(feature),
  notes: coreApproved
    ? `Automated checks passed with ${warnings.length} non-blocking quality warning${warnings.length === 1 ? "" : "s"}. Human approval is still required.`
    : `Automatically blocked for factual or safety reasons: ${failures.join("; ")}`
};

const validation = {
  date: DATE,
  passed: coreApproved,
  policy: "Independent claim verification plus deterministic factual, sourcing, safety and minimum-content checks must pass. Editorial and formatting issues remain warnings.",
  failures,
  warnings,
  stats: {
    source_count: sources.length,
    story_count: stories.length,
    article_words: articleWords,
    feature_words: featureWords,
    unique_source_domains: uniqueHosts.size,
    unresolved_claim_count: openClaims.length,
    claim_verification_passed: claimVerification?.passed === true,
    claim_verification_confidence: Number(claimVerification?.confidence) || 0,
    current_confirmed_development_count: currentConfirmedStories,
    current_human_impact_count: currentImpactStories,
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

if (coreApproved) {
  for (const file of [path.join(draftDir, "daily_brief.md"), path.join(draftDir, "social_pack.md")]) {
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, "utf8").replace(
      /^Status: .*(?:automatic validation|independent claim verification) pending.*$/m,
      "Status: Claim and structural checks passed — human approval pending"
    );
    fs.writeFileSync(file, content, "utf8");
  }
}

console.log(`Validation ${coreApproved ? "passed" : "failed"} for ${DATE}`);
if (!coreApproved) process.exit(2);
