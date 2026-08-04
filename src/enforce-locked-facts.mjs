import fs from "node:fs";
import path from "node:path";
import { extractEntities, extractMaterialNumbers, hasUsableEvidenceLocation, isMeaningfulEvidencePassage, isUsableAtomicClaim, normalizeText, splitSentences, verifyAtomicClaim } from "./evidence-verification.mjs";

const ROOT = process.cwd();
const DATE = process.env.SAPIVER_FORGE_DATE || process.env.SAPIVER_FORGE_DATE || new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());
const dir = path.join(ROOT, "drafts", DATE);
const structuredPath = path.join(dir, "structured_output.json");
const evidencePath = path.join(dir, "source-evidence.json");
const lockPath = path.join(dir, "locked-facts.json");
const reportPath = path.join(dir, "fact-discipline-report.json");
if (!fs.existsSync(structuredPath)) throw new Error(`Missing ${structuredPath}`);
if (!fs.existsSync(evidencePath)) throw new Error("Cannot lock facts before source evidence has been retrieved and verified.");

const data = JSON.parse(fs.readFileSync(structuredPath, "utf8"));
const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
const records = Array.isArray(evidence.records) ? evidence.records : [];
const rejectedEvidenceClaims = [];
const facts = records.flatMap((record) => (record.verified_claims || []).flatMap((claim) => {
  const passage = String(claim.evidence_passage || "");
  const location = claim.evidence_location;
  let publisher = "";
  try { publisher = new URL(claim.source_url || record.final_url).hostname.split(".").find((part) => !/^(?:www|com|org|net|co|uk)$/i.test(part)) || ""; } catch {}
  const mapping = verifyAtomicClaim(String(claim.atomic_claim || ""), `${publisher ? `${publisher} published this report. ` : ""}${record.page_title || ""} ${passage}`);
  if (!isMeaningfulEvidencePassage(passage) || !isUsableAtomicClaim(claim.atomic_claim) || !hasUsableEvidenceLocation(location) || !mapping.supported) {
    rejectedEvidenceClaims.push({
      atomic_claim: claim.atomic_claim,
      verification_status: "rejected_before_lock",
      failed_checks: [
        !isMeaningfulEvidencePassage(passage) ? "evidence_passage:retrieval-furniture-or-unusable-text" : "",
        !isUsableAtomicClaim(claim.atomic_claim) ? "claim:incomplete-or-publisher-furniture" : "",
        !hasUsableEvidenceLocation(location) ? "evidence_location:unavailable" : "",
        !mapping.supported ? "claim:evidence-mapping-failed" : ""
      ].filter(Boolean)
    });
    return [];
  }
  return [{
  atomic_claim: claim.atomic_claim,
  source_url: claim.source_url || record.final_url,
  exact_supporting_evidence_passage: claim.evidence_passage,
  evidence_location: claim.evidence_location,
  verification_checks_performed: claim.verification_checks,
  supported_numbers: claim.supported_numbers || [],
  supported_entities: claim.supported_entities || [],
  verification_status: claim.verification_status,
  qualification: claim.qualification || "",
  fact_type: "supported_fact"
  }];
}));
if (!facts.length || facts.some((fact) => fact.verification_status !== "verified" || !fact.exact_supporting_evidence_passage)) {
  throw new Error("Fact lock requires at least one verified atomic claim with an exact evidence passage.");
}
const interpretations = (data.sources || []).map((source, index) => ({
  source_index: index,
  text: String(source.interpretation || "").trim(),
  fact_type: "sapiver_forge_interpretation",
  required_label: "Sapiver Forge interpretation"
})).filter((item) => item.text);

const lock = {
  schema_version: 2, edition: DATE,
  production_model: "retrieved source evidence -> atomic claims -> deterministic checks -> verified locked facts -> constrained outputs -> human review",
  facts, interpretations,
  prohibited_behaviour: [
    "Do not use a number, date, entity, comparison, quotation, legal obligation, technology, survey description or methodology absent from a verified atomic claim.",
    "Do not present Sapiver Forge interpretation as a source finding.",
    "Do not use publisher metadata or a search snippet as evidence for a detailed material claim."
  ]
};
fs.writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);

const sourceMetadata = records.map((record) => `${record.page_title || ""} ${record.publication_date || ""} ${record.final_url || ""}`).join("\n");
const supportedCorpus = normalizeText(`${facts.map((fact) => `${fact.atomic_claim} ${fact.exact_supporting_evidence_passage}`).join("\n")}\n${sourceMetadata}`);
const supportingEvidenceText = facts.map((fact) => `${fact.atomic_claim}. ${fact.exact_supporting_evidence_passage}`).join("\n");
const unsupported = [...records.flatMap((record) => record.unsupported_claims || []), ...rejectedEvidenceClaims];
const unsupportedNumbers = [...new Set(unsupported.flatMap((item) => extractMaterialNumbers(item.atomic_claim)))].filter((item) => !supportedCorpus.includes(normalizeText(item)));
const comparisonPattern = /\b(?:twice|double|half|more than|less than|higher than|lower than|faster than|slower than|most|least|largest|smallest)\b/i;
const allowedEntities = new Set([
  "Sapiver Forge", "Sapiver Press", "AI", "TikTok", "YouTube", "Facebook", "Pinterest", "LinkedIn", "Gemini",
  "Opportunity Gate", "Workflow Control Gate", "Output Release Gate", "Outcome Review Gate", "Agent Connection Safety Gate"
]);
const changes = [];

function sentenceUnsafe(sentence, location) {
  if (/https:\/\/payhip\.com\/b\/pkSEY|Before you send or publish AI-assisted work, run the exact output through the Sapiver Forge AI Output Release Gate|https:\/\/sapiverforge-daily-brief\.netlify\.app\/podcast\/|Hear the full Sapiver Forge AI Briefing/i.test(sentence)) return "";
  const normalized = normalizeText(sentence);
  const unsupportedOutputNumber = extractMaterialNumbers(sentence).find((number) => !supportedCorpus.includes(normalizeText(number)));
  if (unsupportedOutputNumber) return `Output number has no verified locked-fact mapping: ${unsupportedOutputNumber}`;
  const badNumber = unsupportedNumbers.find((number) => normalized.includes(normalizeText(number)));
  if (badNumber) return `Unsupported number ${badNumber}`;
  if (comparisonPattern.test(sentence) && !verifyAtomicClaim(sentence, supportingEvidenceText).supported) return "Unsupported material comparison";
  const entity = extractEntities(sentence).find((name) => {
    const startsSentence = normalizeText(sentence).startsWith(normalizeText(name));
    const looksMaterial = name.includes(" ") || !startsSentence || /^(Slack|Shopify|Python|C2PA|OpenAI|Microsoft|Google|Amazon|Meta|Anthropic)$/i.test(name);
    return looksMaterial && !allowedEntities.has(name) && !supportedCorpus.includes(normalizeText(name));
  });
  if (entity) return `Unsupported named entity ${entity}`;
  const materialStatement = /\b(?:survey|study|sample|participants?|workers?|countries|must|required|illegal|law|regulation|caused|led to|resulted in|according to|reported|found|showed|demonstrated|proved)\b/i.test(sentence);
  const explicitlyInterpretive = /\b(?:Sapiver Forge interpretation|we interpret|suggests?|may|might|could|in our view|hypothetical|for example|imagine)\b/i.test(sentence);
  if (materialStatement && !explicitlyInterpretive && !verifyAtomicClaim(sentence, supportingEvidenceText).supported) return "Material statement has no verified locked-fact mapping";
  return "";
}

function sanitizeText(value, location) {
  let input = String(value || "");
  if (!input.trim()) return input;
  if (unsupported.length && /None — all material claims used in this edition were verified against the cited sources\./i.test(input)) {
    input = input.replace(/None — all material claims used in this edition were verified against the cited sources\./gi,
      "Unsupported proposed claim components were excluded. Retained material is listed in the verified evidence ledger for human review.");
    changes.push({ location, removed_text: "None — all material claims used in this edition were verified against the cited sources.", reason: "Replaced assumed verification status with evidence-led status" });
  }
  const output = input.split(/\r?\n/).map((line) => {
    if (!line.trim() || /^\s*(?:#|[-*]\s*$|```|Status:|https?:\/\/)/.test(line)) return line;
    return splitSentences(line).filter((sentence) => {
      const reason = sentenceUnsafe(sentence, location);
      if (!reason) return true;
      changes.push({ location, removed_text: sentence, reason });
      return false;
    }).join(" ");
  }).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return output;
}
function walk(value, location) {
  if (typeof value === "string") return sanitizeText(value, location);
  if (Array.isArray(value)) return value.map((item, index) => walk(item, `${location}[${index}]`));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, walk(item, `${location}.${key}`)]));
  return value;
}

const publicOutputFields = new Set([
  "headline", "dek", "main_article", "practical_takeaway", "what_to_test_next", "headline_options",
  "story_summaries", "social", "claims_to_verify"
]);
for (const [key, value] of Object.entries(data)) {
  if (publicOutputFields.has(key)) data[key] = walk(value, `structured_output.${key}`);
}
data.sources = (data.sources || []).map((source, index) => {
  const record = records.find((item) => item.final_url === source.url || item.requested_url === source.url || (source.acquisition_id && item.acquisition_id === source.acquisition_id))
    || records.find((item) => Number(item.source_index) === index) || records[index];
  const verifiedText = (record?.verified_claims || [])
    .filter((claim) => facts.some((fact) => fact.atomic_claim === claim.atomic_claim && fact.source_url === (claim.source_url || record?.final_url)))
    .map((claim) => claim.atomic_claim).join(" ").trim();
  return { ...source, confirmed_fact: verifiedText, verification_status: verifiedText ? "verified_from_retrieved_evidence" : "excluded_no_usable_evidence" };
}).filter((source) => source.confirmed_fact);
fs.writeFileSync(structuredPath, `${JSON.stringify(data, null, 2)}\n`);
for (const filename of ["daily_brief.md", "feature.md", "social_pack.md", "claims_to_verify.md", path.join("podcast", "COPY_PASTE_INTO_ELEVENLABS.txt")]) {
  const file = path.join(dir, filename);
  if (!fs.existsSync(file)) continue;
  fs.writeFileSync(file, `${sanitizeText(fs.readFileSync(file, "utf8"), filename)}\n`);
}
fs.writeFileSync(reportPath, `${JSON.stringify({
  schema_version: 2, edition: DATE, locked_fact_count: facts.length,
  unsupported_atomic_claim_count: unsupported.length, change_count: changes.length, changes,
  status: changes.length ? "unsupported material removed before candidate sealing" : "all scanned material remained within verified evidence"
}, null, 2)}\n`);
console.log(`Locked ${facts.length} verified atomic fact(s); removed ${changes.length} unsupported output sentence(s).`);
