import fs from "node:fs";
import path from "node:path";
import { buildVerifiedClaims, decodeEntities, evidenceLocation, extractUsableText, normalizeText } from "./evidence-verification.mjs";

const ROOT = process.cwd();
const DATE = process.env.SAPIVER_FORGE_DATE || process.env.CLEARFORGE_DATE || new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());
const draftDir = path.join(ROOT, "drafts", DATE);
const structuredPath = path.join(draftDir, "structured_output.json");
const reportPath = path.join(draftDir, "source-integrity-report.json");
const evidencePath = path.join(draftDir, "source-evidence.json");
const pruneStatePath = path.join(draftDir, "source-prune-state.json");
const fixtureDir = process.env.SAPIVER_FORGE_ALLOW_SOURCE_FIXTURES === "1" ? String(process.env.SOURCE_FIXTURE_DIR || "").trim() : "";

function extractMeta(html, key) {
  for (const pattern of [
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`, "i")
  ]) { const match = String(html).match(pattern); if (match) return decodeEntities(match[1]).trim(); }
  return "";
}
function extractTitle(html) {
  return extractMeta(html, "og:title") || extractMeta(html, "twitter:title")
    || decodeEntities(String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/\s+/g, " ").trim();
}
function extractPublicationDate(html) {
  return extractMeta(html, "article:published_time") || extractMeta(html, "datePublished")
    || String(html).match(/"datePublished"\s*:\s*"([^"]+)"/i)?.[1] || "";
}
function extractCanonical(html) {
  return String(html).match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1]
    || String(html).match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i)?.[1] || "";
}
function titleSimilarity(a, b) {
  const left = new Set(normalizeText(a).split(" ").filter((item) => item.length > 2));
  const right = new Set(normalizeText(b).split(" ").filter((item) => item.length > 2));
  if (!left.size || !right.size) return 0;
  return [...left].filter((item) => right.has(item)).length / Math.min(left.size, right.size);
}
async function fetchPage(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(process.env.SOURCE_FETCH_TIMEOUT_MS || 15000));
  try {
    return await fetch(url, { redirect: "follow", signal: controller.signal, headers: {
      "user-agent": "Mozilla/5.0 (compatible; SapiverForgeSourceVerifier/2.0; +https://sapiverforge-daily-brief.netlify.app)",
      accept: "text/html,application/xhtml+xml"
    } });
  } finally { clearTimeout(timer); }
}

if (!fs.existsSync(structuredPath)) throw new Error(`Missing ${structuredPath}`);
const structured = JSON.parse(fs.readFileSync(structuredPath, "utf8"));
const sources = Array.isArray(structured.sources) ? structured.sources : [];
const stories = Array.isArray(structured.story_summaries) ? structured.story_summaries : [];
if (!sources.length) throw new Error("Source integrity requires at least one source.");
if (stories.length !== sources.length) throw new Error("Source and story arrays must remain aligned.");

const results = [];
const records = [];
for (let index = 0; index < sources.length; index += 1) {
  const source = sources[index];
  const requestedUrl = String(source.url || "").trim();
  const failures = [], warnings = [];
  let response, html = "", finalUrl = "", status = 0, retrievalStatus = "not_attempted";
  try {
    const parsed = new URL(requestedUrl);
    if (parsed.protocol !== "https:") failures.push("Source URL must use HTTPS.");
  } catch { failures.push("Source URL is not a valid absolute URL."); }
  if (!failures.length) {
    try {
      const fixturePath = fixtureDir ? path.join(fixtureDir, `source-${index + 1}.html`) : "";
      if (fixturePath && fs.existsSync(fixturePath)) {
        html = fs.readFileSync(fixturePath, "utf8");
        const fixtureMetaPath = path.join(fixtureDir, `source-${index + 1}.json`);
        const fixtureMeta = fs.existsSync(fixtureMetaPath) ? JSON.parse(fs.readFileSync(fixtureMetaPath, "utf8")) : {};
        status = Number(fixtureMeta.status || 200);
        finalUrl = String(fixtureMeta.final_url || requestedUrl);
        retrievalStatus = String(fixtureMeta.retrieval_status || (status === 200 ? "retrieved_fixture" : "http_error"));
        if (status !== 200) failures.push(`Source fixture returned HTTP ${status}.`);
      } else {
        response = await fetchPage(requestedUrl); status = response.status; finalUrl = response.url;
      }
      if (fixturePath && fs.existsSync(fixturePath)) {
        // The replay fixture is already loaded above; skip the network response branches.
      } else if ([401, 403, 429].includes(status)) {
        retrievalStatus = "publisher_blocked";
        failures.push(`Publisher blocked evidence retrieval with HTTP ${status}; detailed claims cannot be verified.`);
      } else if (!response.ok) {
        retrievalStatus = "http_error"; failures.push(`Source returned HTTP ${status}.`);
      } else if (!(response.headers.get("content-type") || "").includes("text/html")) {
        retrievalStatus = "unsupported_content_type"; failures.push("Source did not return usable HTML body text.");
      } else {
        html = await response.text(); retrievalStatus = "retrieved";
      }
    } catch (error) {
      retrievalStatus = "retrieval_error"; failures.push(`Source could not be opened: ${error?.message || error}`);
    }
  }
  const sourceText = extractUsableText(html);
  if (["retrieved", "retrieved_fixture"].includes(retrievalStatus) && sourceText.length < 120) {
    retrievalStatus = "no_usable_body"; failures.push("Source returned no usable body text for claim verification.");
  }
  const proposedFact = String(source.confirmed_fact || "").trim();
  const fallbackContext = [source.title, stories[index]?.title, stories[index]?.summary, stories[index]?.why_it_matters].filter(Boolean);
  const verification = failures.length ? { atomic: [], verified: [] } : buildVerifiedClaims(proposedFact, sourceText, fallbackContext);
  const unsupported = verification.atomic.filter((item) => !item.supported);
  if (unsupported.length) warnings.push(`${unsupported.length} proposed atomic claim(s) lacked source evidence and were excluded.`);
  if (!verification.verified.length) failures.push("No meaningful factual core could be verified from the retrieved source text.");
  const pageTitle = extractTitle(html);
  const recordedDate = String(source.published_date || "").trim();
  const pageDate = extractPublicationDate(html);
  if (pageTitle && titleSimilarity(source.title, pageTitle) < 0.35) warnings.push("Recorded and retrieved titles differ materially.");
  if (recordedDate && pageDate && !normalizeText(pageDate).includes(normalizeText(recordedDate))) warnings.push("Recorded publication date differs from retrieved metadata.");
  const verifiedClaims = verification.verified.map((item, claimIndex) => ({
    id: `source-${index + 1}-claim-${claimIndex + 1}`,
    atomic_claim: item.claim,
    source_url: finalUrl || requestedUrl,
    evidence_passage: item.evidence.passage,
    evidence_location: evidenceLocation(item.evidence),
    verification_checks: item.checks,
    supported_numbers: (item.checks.numbers || []).filter((check) => check.supported).map((check) => check.value),
    supported_entities: (item.checks.entities || []).filter((check) => check.supported).map((check) => check.value),
    verification_status: "verified",
    qualification: item.qualification || "",
    fact_type: "supported_fact"
  }));
  const unsupportedClaims = verification.atomic.filter((item) => !item.supported).map((item) => ({
    atomic_claim: item.claim, verification_status: "unsupported", failed_checks: item.failed_checks
  }));
  const passed = failures.length === 0;
  records.push({
    source_index: index, requested_url: requestedUrl, final_url: finalUrl || requestedUrl,
    canonical_url: extractCanonical(html), page_title: pageTitle, publication_date: pageDate || recordedDate,
    usable_source_text: sourceText, retrieval_status: retrievalStatus, retrieval_timestamp: new Date().toISOString(),
    verified_claims: verifiedClaims, unsupported_claims: unsupportedClaims
  });
  results.push({ index: index + 1, original_index: index, recorded_title: source.title || "", requested_url: requestedUrl,
    final_url: finalUrl, http_status: status, retrieval_status: retrievalStatus,
    verified_claim_count: verifiedClaims.length, unsupported_claim_count: unsupportedClaims.length,
    passed, warnings, failures });
}

const passedIndexes = results.filter((item) => item.passed).map((item) => item.original_index);
const report = { schema_version: 6, edition: DATE, generated_at: new Date().toISOString(),
  passed: passedIndexes.length >= 1, degraded: passedIndexes.length < results.length && passedIndexes.length >= 1,
  source_count: results.length, survivor_count: passedIndexes.length,
  policy: "A source survives only when usable body text supports at least one atomic material claim. Missing numbers, entities, dates and comparisons are blocking for those claim components.", results };
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(evidencePath, `${JSON.stringify({ schema_version: 1, edition: DATE, records }, null, 2)}\n`);

for (const item of results) {
  console[item.passed ? "log" : "error"](`${item.passed ? "SOURCE KEEP" : "SOURCE BLOCK"} ${item.index}: ${item.recorded_title}`);
  item.warnings.forEach((warning) => console.warn(`  - WARNING: ${warning}`));
  item.failures.forEach((failure) => console.error(`  - ${failure}`));
}
if (!passedIndexes.length) throw new Error("No source candidates retained a usable verified factual core.");

if (passedIndexes.length !== sources.length) {
  const dropped = results.filter((item) => !item.passed).map((item) => ({ title: item.recorded_title, url: item.requested_url, reason: item.failures.join(" ") }));
  structured.sources = passedIndexes.map((index) => sources[index]);
  structured.story_summaries = passedIndexes.map((index) => stories[index]);
  const survivorRecords = passedIndexes.map((index) => records[index]);
  fs.writeFileSync(structuredPath, `${JSON.stringify(structured, null, 2)}\n`);
  fs.writeFileSync(path.join(draftDir, "sources.json"), `${JSON.stringify(structured.sources, null, 2)}\n`);
  fs.writeFileSync(evidencePath, `${JSON.stringify({ schema_version: 1, edition: DATE, records: survivorRecords }, null, 2)}\n`);
  fs.writeFileSync(pruneStatePath, `${JSON.stringify({ edition: DATE, initial_count: sources.length, survivor_count: passedIndexes.length, dropped, rebuilt_at: null }, null, 2)}\n`);
}
