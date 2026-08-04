import fs from "node:fs";
import path from "node:path";
import { buildVerifiedClaims, extractMaterialNumbers, isUsableAtomicClaim, normalizeText, splitSentences, verifyAtomicClaim } from "./evidence-verification.mjs";

const ROOT = process.cwd();
const DATE = process.env.SAPIVER_FORGE_DATE || new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const dir = path.join(ROOT, "drafts", DATE);
const acquisitionPath = path.join(dir, "source-acquisition.json");
const structuredPath = path.join(dir, "structured_output.json");
const pruneStatePath = path.join(dir, "source-prune-state.json");

const words = (value) => String(value || "").trim().split(/\s+/).filter(Boolean).length;
const tokens = (value) => new Set(normalizeText(value).split(" ").filter((token) => token.length > 3));
const overlap = (left, right) => {
  const a = tokens(left), b = tokens(right);
  if (!a.size || !b.size) return 0;
  return [...a].filter((token) => b.has(token)).length / Math.min(a.size, b.size);
};
function hostname(url) { try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; } }
function authorityScore(candidate) {
  const host = hostname(candidate.final_url || candidate.requested_url);
  if (/\.gov(?:\.|$)|\.gov\.uk$|\.europa\.eu$|\.ac\.uk$|\.edu$/.test(host)) return 45;
  if (/(?:microsoft\.com|research\.google|openai\.com|anthropic\.com|engineering\.fb\.com|hiringlab\.org|brookings\.edu|brookings\.org|par\.nsf\.gov)$/.test(host)) return 42;
  if (/(?:nature\.com|science\.org|arxiv\.org|acm\.org|ieee\.org|cureusjournals\.com)$/.test(host)) return 38;
  if (/(?:reuters\.com|apnews\.com|bbc\.|ft\.com|theguardian\.com|technologyreview\.com)$/.test(host)) return 34;
  if (/(?:prnewswire\.com|dev\.to|medium\.com|substack\.com)$/.test(host)) return 8;
  if (/(?:review|gadget|techmitra|phadera)/.test(host)) return 5;
  return 20;
}
function evidenceSentences(candidate) {
  const passages = Array.isArray(candidate.evidence_passages) ? candidate.evidence_passages : [];
  const corpus = [...passages, String(candidate.usable_source_text || "").slice(0, 14000)].join(" ");
  return [...new Set(splitSentences(corpus))]
    .map((sentence) => sentence.replace(/^[-•]\s*/, "").trim())
    .filter((sentence) => words(sentence) >= 8 && words(sentence) <= 75 && isUsableAtomicClaim(sentence));
}
function chooseEvidenceClaim(candidate, proposedFact = "", context = "") {
  const corpus = [candidate.usable_source_text, ...(candidate.evidence_passages || [])].filter(Boolean).join(" ");
  const proposed = buildVerifiedClaims(proposedFact, corpus, context).verified[0];
  if (proposed?.supported && proposed.evidence?.start >= 0) return proposed.claim;
  const ranked = evidenceSentences(candidate).map((sentence) => {
    const verified = verifyAtomicClaim(sentence, corpus);
    const numberBonus = Math.min(12, extractMaterialNumbers(sentence).length * 4);
    const contextBonus = Math.round(overlap(sentence, `${candidate.page_title} ${context}`) * 24);
    const lengthBonus = words(sentence) >= 12 && words(sentence) <= 45 ? 8 : 0;
    return { sentence, verified, score: numberBonus + contextBonus + lengthBonus };
  }).filter((item) => item.verified.supported && item.verified.evidence?.start >= 0)
    .sort((a, b) => b.score - a.score || words(a.sentence) - words(b.sentence));
  return ranked[0]?.sentence || "";
}
function inferLane(candidate) {
  const text = `${candidate.page_title} ${(candidate.evidence_passages || []).join(" ")}`;
  return /worker|employment|job|creative|meaning|anxiety|student|survey|people|freelancer/i.test(text) ? "human_impact" : "confirmed_development";
}
function inferCategory(candidate) {
  const text = `${candidate.page_title} ${(candidate.evidence_passages || []).join(" ")}`.toLowerCase();
  if (/job|worker|employment|education|student|creative work|labour/.test(text)) return "education_employment_and_society";
  if (/security|safety|compliance|regulation|autonomous driving/.test(text)) return "policy_safety_and_security";
  if (/research|framework|model|training|benchmark|memory/.test(text)) return "research_and_science";
  if (/developer|coding|software|agentic|framework/.test(text)) return "coding_and_building";
  if (/video|voice|image|design|media|creator/.test(text)) return "creator_tools_and_media";
  return "workplace_and_business";
}
function candidateScore(candidate, context) {
  const sentences = evidenceSentences(candidate);
  const evidence = Math.min(30, sentences.length * 2);
  const quantified = Math.min(16, sentences.reduce((sum, sentence) => sum + extractMaterialNumbers(sentence).length, 0) * 2);
  const relevance = Math.round(overlap(`${candidate.page_title} ${(candidate.evidence_passages || []).join(" ")}`, context) * 18);
  const freshness = String(candidate.publication_date || "").startsWith(DATE) ? 8 : 4;
  return authorityScore(candidate) + evidence + quantified + relevance + freshness;
}

if (!fs.existsSync(acquisitionPath) || !fs.existsSync(structuredPath)) throw new Error("Evidence-bound preparation requires source-acquisition.json and structured_output.json.");
const acquisition = JSON.parse(fs.readFileSync(acquisitionPath, "utf8"));
const data = JSON.parse(fs.readFileSync(structuredPath, "utf8"));
const candidates = Array.isArray(acquisition.candidates) ? acquisition.candidates : [];
if (!candidates.length) throw new Error("No acquired source candidates are available for evidence-bound preparation.");
const originalSources = Array.isArray(data.sources) ? data.sources : [];
const originalById = new Map(originalSources.map((source) => [String(source.acquisition_id || ""), source]));
const context = [data.headline, ...(data.story_summaries || []).flatMap((story) => [story.title, story.summary])].filter(Boolean).join(" ");

const ranked = candidates.map((candidate) => {
  const original = originalById.get(String(candidate.acquisition_id || ""));
  const claim = chooseEvidenceClaim(candidate, original?.confirmed_fact || "", context);
  return { candidate, claim, score: candidateScore(candidate, context) };
}).filter((item) => item.claim)
  .sort((a, b) => b.score - a.score);

const chosen = [];
const hosts = new Set();
const categories = new Set();
for (const item of ranked) {
  const host = hostname(item.candidate.final_url || item.candidate.requested_url);
  const category = inferCategory(item.candidate);
  if (hosts.has(host)) continue;
  const diversityBonus = categories.has(category) ? 0 : 1;
  if (chosen.length < 3 || (chosen.length < 5 && diversityBonus && item.score >= 55)) {
    chosen.push({ ...item, category }); hosts.add(host); categories.add(category);
  }
  if (chosen.length >= 5) break;
}
if (!chosen.length) throw new Error("No acquired candidate contained a stable evidence-bound factual claim.");

const selectedIds = new Set(chosen.map((item) => String(item.candidate.acquisition_id || "")));
data.sources = chosen.map(({ candidate, claim, category }) => ({
  acquisition_id: String(candidate.acquisition_id || ""),
  source_name: candidate.publisher_domain || hostname(candidate.final_url),
  title: candidate.page_title,
  url: candidate.final_url,
  published_date: String(candidate.publication_date || "").slice(0, 10),
  coverage_lane: inferLane(candidate),
  topic_category: category,
  evidence_basis: "Factual core selected deterministically from the sealed source evidence acquired before generation.",
  confirmed_fact: claim,
  interpretation: "Sapiver Forge interpretation: this source was retained because its factual core maps directly to sealed evidence; implications still require human editorial judgement."
}));
data.story_summaries = data.sources.map((source) => ({
  title: source.title,
  coverage_lane: source.coverage_lane,
  topic_category: source.topic_category,
  summary: source.confirmed_fact,
  why_it_matters: "Sapiver Forge interpretation: this verified development may affect how creators, workers or small organisations evaluate practical AI adoption.",
  practical_angle: "Read the cited evidence, separate the confirmed result from interpretation, and test only the narrowest relevant use case before changing a live workflow.",
  claim_to_verify: "NONE — verified from cited sources."
}));
data.claims_to_verify = [];
data.evidence_bound_preparation = {
  prepared_at: new Date().toISOString(), candidate_count: candidates.length,
  selected_count: data.sources.length, selected_acquisition_ids: [...selectedIds],
  policy: "Source ranking and factual cores are deterministic and evidence-bound before source-integrity validation."
};
fs.writeFileSync(structuredPath, `${JSON.stringify(data, null, 2)}\n`);
fs.writeFileSync(path.join(dir, "sources.json"), `${JSON.stringify(data.sources, null, 2)}\n`);
const dropped = originalSources.filter((source) => !selectedIds.has(String(source.acquisition_id || "")))
  .map((source) => ({ title: source.title, url: source.url, reason: "Replaced by deterministic authority and evidence-quality ranking before validation." }));
if (!dropped.length) dropped.push({ title: "Initial model-authored edition", url: "", reason: "Forced evidence-bound depth rebuild after deterministic factual-core preparation." });
fs.writeFileSync(pruneStatePath, `${JSON.stringify({ edition: DATE, initial_count: originalSources.length, survivor_count: data.sources.length, dropped, rebuilt_at: null, preparation: "evidence_bound" }, null, 2)}\n`);
console.log(`Prepared ${data.sources.length} evidence-bound sources from ${candidates.length} acquired candidates; a depth-first rebuild is mandatory after validation.`);
