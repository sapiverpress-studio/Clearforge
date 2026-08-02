import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATE = process.env.CLEARFORGE_DATE || new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const draftDir = path.join(ROOT, "drafts", DATE);
const structuredPath = path.join(draftDir, "structured_output.json");
const reportPath = path.join(draftDir, "source-integrity-report.json");
const resolutionPath = path.join(draftDir, "source-resolution-report.json");
const pruneStatePath = path.join(draftDir, "source-prune-state.json");

const normalize = (value) => String(value || "").toLowerCase().replace(/&[a-z0-9#]+;/g, " ").replace(/[^a-z0-9%]+/g, " ").replace(/\s+/g, " ").trim();
const tokenSet = (value) => new Set(normalize(value).split(" ").filter((token) => token.length > 2));
function similarity(a, b) { const A = tokenSet(a), B = tokenSet(b); if (!A.size || !B.size) return 0; let n = 0; for (const x of A) if (B.has(x)) n += 1; return n / Math.min(A.size, B.size); }
function decodeEntities(value) { return String(value || "").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">"); }
function extractMeta(html, key) { for (const pattern of [new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`, "i"), new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`, "i")]) { const m = html.match(pattern); if (m) return decodeEntities(m[1]).trim(); } return ""; }
function extractTitle(html) { return extractMeta(html, "og:title") || extractMeta(html, "twitter:title") || decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/\s+/g, " ").trim(); }
function extractCanonical(html) { return html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i)?.[1] || ""; }
function visibleText(html) { return decodeEntities(String(html || "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim(); }
function materialNumbers(value) { return [...new Set(String(value || "").match(/\b\d+(?:[,.]\d+)*(?:%|B|M|K|bn|million|billion)?\b/gi) || [])].filter((item) => !/^20\d{2}$/.test(item)); }
function importantTerms(source) { const found = `${source.title || ""} ${source.confirmed_fact || ""}`.match(/\b[A-Z][A-Za-z0-9.-]{2,}(?:\s+[A-Z][A-Za-z0-9.-]{2,}){0,3}\b/g) || []; return [...new Set(found.map(normalize).filter((x) => x.length > 3))].slice(0, 8); }
async function fetchPage(url) { const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), Number(process.env.SOURCE_FETCH_TIMEOUT_MS || 15000)); try { return await fetch(url, { redirect: "follow", signal: controller.signal, headers: { "user-agent": "Mozilla/5.0 (compatible; SapiverForgeSourceVerifier/1.0; +https://sapiverforge-daily-brief.netlify.app)", accept: "text/html,application/xhtml+xml" } }); } finally { clearTimeout(timer); } }

if (!fs.existsSync(structuredPath)) throw new Error(`Missing ${structuredPath}`);
const structured = JSON.parse(fs.readFileSync(structuredPath, "utf8"));
const sources = Array.isArray(structured.sources) ? structured.sources : [];
const stories = Array.isArray(structured.story_summaries) ? structured.story_summaries : [];
if (sources.length < 3) throw new Error("Source integrity requires at least three sources.");
if (stories.length !== sources.length) throw new Error("Source and story arrays must remain aligned.");
const resolution = fs.existsSync(resolutionPath) ? JSON.parse(fs.readFileSync(resolutionPath, "utf8")) : { replacements: [] };
const grounded = new Map((resolution.replacements || []).filter((x) => x.evidence_grounded).map((x) => [x.new_url, x]));

const results = [];
for (let index = 0; index < sources.length; index += 1) {
  const source = sources[index], failures = [], warnings = [];
  const requestedUrl = String(source.url || "").trim();
  const groundedEvidence = grounded.get(requestedUrl);
  let finalUrl = "", canonicalUrl = "", pageTitle = "", body = "", status = 0, publisherBlocked = false;
  try { const parsed = new URL(requestedUrl); if (parsed.protocol !== "https:") failures.push("Source URL must use HTTPS."); if (!parsed.hostname.includes(".")) failures.push("Source URL has no valid hostname."); } catch { failures.push("Source URL is not a valid absolute URL."); }
  if (!failures.length) {
    try {
      const response = await fetchPage(requestedUrl); status = response.status; finalUrl = response.url;
      publisherBlocked = [401, 403, 429].includes(response.status) && Boolean(groundedEvidence);
      if (!response.ok && !publisherBlocked) failures.push(`Source returned HTTP ${response.status}.`);
      if (publisherBlocked) warnings.push(`Publisher blocked direct fetch with HTTP ${response.status}; grounded evidence retained.`);
      const contentType = response.headers.get("content-type") || "";
      if (response.ok && !contentType.includes("text/html")) failures.push(`Source returned unsupported content type: ${contentType || "unknown"}.`);
      if (response.ok) { body = await response.text(); pageTitle = extractTitle(body); canonicalUrl = extractCanonical(body); if (!pageTitle) failures.push("No page title could be read from the resolved source."); }
    } catch (error) { failures.push(`Source could not be opened: ${error?.message || error}`); }
  }
  const pageText = visibleText(body);
  const evidenceTitle = groundedEvidence?.evidence_title || "";
  const titleScore = pageTitle ? similarity(source.title, pageTitle) : similarity(source.title, evidenceTitle);
  if ((pageTitle || evidenceTitle) && titleScore < 0.35) failures.push(`Recorded title does not match resolved/search-evidence title (similarity ${titleScore.toFixed(2)}).`);
  const missingNumbers = publisherBlocked ? [] : materialNumbers(source.confirmed_fact).filter((number) => !normalize(pageText).includes(normalize(number)));
  if (missingNumbers.length) failures.push(`Confirmed-fact numbers not found on source page: ${missingNumbers.join(", ")}.`);
  const terms = importantTerms(source); const matchedTerms = publisherBlocked ? [] : terms.filter((term) => normalize(pageText).includes(term));
  if (!publisherBlocked && terms.length >= 2 && matchedTerms.length === 0) failures.push("Central named entities were not found on the resolved page.");
  results.push({ index: index + 1, original_index: index, source_name: source.source_name || "", recorded_title: source.title || "", requested_url: requestedUrl, final_url: finalUrl, canonical_url: canonicalUrl, resolved_title: pageTitle || evidenceTitle, http_status: status, publisher_blocked: publisherBlocked, search_evidence_grounded: Boolean(groundedEvidence), title_similarity: Number(titleScore.toFixed(3)), checked_numbers: materialNumbers(source.confirmed_fact), matched_named_terms: matchedTerms, passed: failures.length === 0, warnings, failures });
}

const passedIndexes = results.filter((item) => item.passed).map((item) => item.original_index);
const failed = results.filter((item) => !item.passed);
const enoughSurvivors = passedIndexes.length >= 3;
const report = { schema_version: 3, edition: DATE, generated_at: new Date().toISOString(), passed: enoughSurvivors, degraded: failed.length > 0 && enoughSurvivors, source_count: results.length, survivor_count: passedIndexes.length, failed_source_count: failed.length, policy: "Validate candidates independently. Discard up to two failures and continue when at least three verified stories survive.", results };
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

if (!enoughSurvivors) {
  for (const item of failed) { console.error(`SOURCE BLOCK ${item.index}: ${item.recorded_title}`); for (const failure of item.failures) console.error(`  - ${failure}`); }
  throw new Error(`Only ${passedIndexes.length} source candidates passed integrity validation; at least three are required.`);
}

if (failed.length) {
  const previousState = fs.existsSync(pruneStatePath) ? JSON.parse(fs.readFileSync(pruneStatePath, "utf8")) : { edition: DATE, initial_count: sources.length, dropped: [] };
  const droppedNow = failed.map((item) => ({ title: item.recorded_title, url: item.requested_url, reason: item.failures.join(" ") }));
  structured.sources = passedIndexes.map((index) => sources[index]);
  structured.story_summaries = passedIndexes.map((index) => stories[index]);
  fs.writeFileSync(structuredPath, `${JSON.stringify(structured, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(draftDir, "sources.json"), `${JSON.stringify(structured.sources, null, 2)}\n`, "utf8");
  fs.writeFileSync(pruneStatePath, `${JSON.stringify({ ...previousState, survivor_count: structured.sources.length, dropped: [...(previousState.dropped || []), ...droppedNow], rebuilt_at: null }, null, 2)}\n`, "utf8");
  console.log(`Integrity validation discarded ${failed.length} candidate(s) and retained ${structured.sources.length}.`);
} else {
  console.log(`All ${sources.length} source records passed integrity validation.`);
}
