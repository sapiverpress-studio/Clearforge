import fs from "node:fs";
import path from "node:path";
import { extractEntities, extractMaterialNumbers, hasUsableEvidenceLocation, isMeaningfulEvidencePassage, isUsableAtomicClaim, normalizeText, splitSentences, verifyAtomicClaim } from "./evidence-verification.mjs";

const INTERNAL_RECOVERY = /retrieved evidence supports|original draft claimed|rejected before lock|deterministic fallback/i;
const PUBLISHER_FURNITURE = /share share on twitter|twitter linkedin email|try starlog|vibe-coding is fine|copy link|skip to content|&(?:#\d+|#x[0-9a-f]+|[a-z]+);|[↗]/i;
const ALLOWED_ENTITIES = new Set(["Sapiver Forge", "Sapiver Press", "AI", "TikTok", "YouTube", "Facebook", "Pinterest"]);
const words = (value) => String(value || "").trim().split(/\s+/).filter(Boolean).length;

export function auditPublishability(root, edition) {
  const draftDir = path.join(root, "drafts", edition);
  const readJson = (name, fallback = {}) => {
    try { return JSON.parse(fs.readFileSync(path.join(draftDir, name), "utf8")); } catch { return fallback; }
  };
  const data = readJson("structured_output.json");
  const lock = readJson("locked-facts.json", { facts: [] });
  const factReport = readJson("fact-discipline-report.json", null);
  const facts = Array.isArray(lock.facts) ? lock.facts : [];
  const failures = [];
  const warnings = [];

  if (!facts.length) failures.push("No verified locked facts remain.");
  for (const [index, fact] of facts.entries()) {
    if (!isUsableAtomicClaim(fact.atomic_claim)) failures.push(`Locked fact ${index + 1} is incomplete or contains publisher furniture.`);
    if (!isMeaningfulEvidencePassage(fact.exact_supporting_evidence_passage)) failures.push(`Locked fact ${index + 1} has unusable evidence.`);
    if (!hasUsableEvidenceLocation(fact.evidence_location)) failures.push(`Locked fact ${index + 1} has no stable evidence location.`);
    let publisher = "";
    try { publisher = new URL(fact.source_url).hostname.split(".").find((part) => !/^(?:www|com|org|net|co|uk)$/i.test(part)) || ""; } catch {}
    if (!verifyAtomicClaim(fact.atomic_claim, `${publisher ? `${publisher} published this report. ` : ""}${fact.exact_supporting_evidence_passage}`).supported) failures.push(`Locked fact ${index + 1} does not map back to its evidence.`);
  }

  if (factReport) {
    const unsupported = Number(factReport.unsupported_atomic_claim_count ?? factReport.unsupported_claim_count ?? 0);
    if (unsupported > 0) failures.push(`Fact-discipline report contains ${unsupported} unsupported atomic claim${unsupported === 1 ? "" : "s"}.`);
    if (factReport.passed === false) failures.push("Fact-discipline report failed.");
  }

  for (const field of ["headline", "dek", "main_article", "practical_takeaway", "what_to_test_next"]) {
    if (!String(data[field] || "").trim()) failures.push(`Missing public field: ${field}.`);
  }
  const sources = Array.isArray(data.sources) ? data.sources : [];
  const minimumArticleWords = sources.length >= 3 ? 450 : 650;
  if (words(data.main_article) < minimumArticleWords) failures.push(`Daily article is below the ${minimumArticleWords}-word minimum for ${sources.length} verified source${sources.length === 1 ? "" : "s"}.`);
  if (/^(?:a verified ai development|today in ai|ai news|an ai update|what happened in ai)\b/i.test(String(data.headline || "").trim())) failures.push("Headline is generic and does not identify the story.");
  if (words(data.practical_takeaway) < 35) failures.push("Practical takeaway is too thin to be useful.");
  if (words(data.what_to_test_next) < 25) failures.push("What-to-test-next section is too thin to be actionable.");
  if (!sources.length) failures.push("No public source records remain.");
  for (const [index, source] of sources.entries()) {
    if (!isUsableAtomicClaim(source.confirmed_fact)) failures.push(`Source ${index + 1} has no complete verified fact.`);
    if (!/^https:\/\//i.test(String(source.url || ""))) failures.push(`Source ${index + 1} has no HTTPS URL.`);
  }
  if (!Array.isArray(data.story_summaries) || !data.story_summaries.length) failures.push("No usable story summaries remain.");

  const social = data.social || {};
  const requiredSocial = {
    tiktok_script: [18, 120], tiktok_caption: [8, 100], youtube_shorts_script: [18, 140],
    facebook_post: [25, 220], pinterest_title: [4, 18], pinterest_description: [20, 120]
  };
  for (const [field, [min, max]] of Object.entries(requiredSocial)) {
    const count = words(social[field]);
    if (!String(social[field] || "").trim()) failures.push(`Missing social output: ${field}.`);
    else if (count < min || count > max) failures.push(`${field} has unusable length (${count} words; expected ${min}–${max}).`);
  }
  if (!Array.isArray(social.quote_card_lines) || social.quote_card_lines.filter((item) => String(item || "").trim()).length !== 5) failures.push("Quote-card pack must contain five complete lines.");

  const renderedFiles = ["daily_brief.md", "social_pack.md", "claims_to_verify.md"]
    .map((name) => { try { return fs.readFileSync(path.join(draftDir, name), "utf8"); } catch { return ""; } }).join("\n");
  const publicCorpus = `${JSON.stringify(data)}\n${renderedFiles}`;
  if (INTERNAL_RECOVERY.test(publicCorpus)) failures.push("Internal recovery wording leaked into public output.");
  if (PUBLISHER_FURNITURE.test(publicCorpus)) failures.push("Publisher navigation, promotional furniture or raw HTML entities leaked into public output.");
  if (/output-release-30-day-validation|payhip\.com\/b\/pkSEY/i.test(publicCorpus)) failures.push("Abandoned Output Release campaign leaked into current output.");
  if (/\bClear\s*Forge\b/i.test(publicCorpus)) failures.push("Old Clearforge branding leaked into current output.");
  if (/\band energy management\b/i.test(publicCorpus)) failures.push("A known incomplete sentence fragment leaked into public output.");
  if (/\s\?\s*(?:\\n|"|$)/.test(publicCorpus)) failures.push("Stray question-mark punctuation remains in public copy.");

  const podcastPath = path.join(draftDir, "podcast", "COPY_PASTE_INTO_ELEVENLABS.txt");
  if (fs.existsSync(podcastPath)) {
    const podcast = fs.readFileSync(podcastPath, "utf8").trim();
    const lockedCorpus = normalizeText(facts.map((fact) => `${fact.atomic_claim} ${fact.exact_supporting_evidence_passage}`).join("\n"));
    if (INTERNAL_RECOVERY.test(podcast) || PUBLISHER_FURNITURE.test(podcast)) failures.push("Podcast contains internal or publisher-furniture text.");
    for (const number of extractMaterialNumbers(podcast)) if (!lockedCorpus.includes(normalizeText(number))) failures.push(`Podcast number has no locked-fact support: ${number}.`);
    for (const sentence of splitSentences(podcast)) {
      const sentenceStart = normalizeText(sentence);
      const unsupportedEntity = extractEntities(sentence).find((entity) => {
        const startsSentence = sentenceStart.startsWith(normalizeText(entity));
        return !startsSentence && !ALLOWED_ENTITIES.has(entity) && !lockedCorpus.includes(normalizeText(entity));
      });
      if (unsupportedEntity) failures.push(`Podcast entity has no locked-fact support: ${unsupportedEntity}.`);
    }
  } else warnings.push("Podcast omitted; this is allowed and does not block the edition.");

  return { edition, passed: failures.length === 0, failures: [...new Set(failures)], warnings: [...new Set(warnings)] };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const root = process.cwd();
  const edition = process.env.SAPIVER_FORGE_DATE || new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const report = auditPublishability(root, edition);
  fs.writeFileSync(path.join(root, "drafts", edition, "publishability-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  if (!report.passed) throw new Error(`Publishability audit failed: ${report.failures.join("; ")}`);
  console.log(`Publishability audit passed for ${edition}.`);
}
