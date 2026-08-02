import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATE = process.env.CLEARFORGE_DATE || new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(new Date());
const draftDir = path.join(ROOT, "drafts", DATE);
const structuredPath = path.join(draftDir, "structured_output.json");
const reportPath = path.join(draftDir, "source-integrity-report.json");

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&[a-z0-9#]+;/g, " ")
    .replace(/[^a-z0-9%]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value) {
  return new Set(normalize(value).split(" ").filter((token) => token.length > 2));
}

function similarity(a, b) {
  const left = tokens(a);
  const right = tokens(b);
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const token of left) if (right.has(token)) overlap += 1;
  return overlap / Math.min(left.size, right.size);
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function extractMeta(html, property) {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`, "i")
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return decodeEntities(match[1]).trim();
  }
  return "";
}

function extractTitle(html) {
  return extractMeta(html, "og:title") ||
    extractMeta(html, "twitter:title") ||
    decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/\s+/g, " ").trim();
}

function extractCanonical(html) {
  const match = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) ||
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
  return match?.[1] || "";
}

function visibleText(html) {
  return decodeEntities(String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function materialNumbers(value) {
  return [...new Set(String(value || "").match(/\b\d+(?:\.\d+)?(?:%|B|M|K|bn|million|billion)?\b/gi) || [])]
    .filter((item) => !/^20\d{2}$/.test(item));
}

function importantTerms(source) {
  const candidates = `${source.title || ""} ${source.confirmed_fact || ""}`
    .match(/\b[A-Z][A-Za-z0-9.-]{2,}(?:\s+[A-Z][A-Za-z0-9.-]{2,}){0,3}\b/g) || [];
  return [...new Set(candidates.map((value) => normalize(value)).filter((value) => value.length > 3))].slice(0, 8);
}

async function fetchPage(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(process.env.SOURCE_FETCH_TIMEOUT_MS || 15000));
  try {
    return await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; SapiverForgeSourceVerifier/1.0; +https://sapiverforge-daily-brief.netlify.app)",
        accept: "text/html,application/xhtml+xml"
      }
    });
  } finally {
    clearTimeout(timer);
  }
}

if (!fs.existsSync(structuredPath)) throw new Error(`Missing ${structuredPath}`);
const structured = JSON.parse(fs.readFileSync(structuredPath, "utf8"));
const sources = Array.isArray(structured.sources) ? structured.sources : [];
if (sources.length < 3) throw new Error("Source integrity requires at least three sources.");

const results = [];
for (let index = 0; index < sources.length; index += 1) {
  const source = sources[index];
  const failures = [];
  let requestedUrl = String(source.url || "").trim();
  let finalUrl = "";
  let canonicalUrl = "";
  let pageTitle = "";
  let status = 0;
  let body = "";

  try {
    const parsed = new URL(requestedUrl);
    if (parsed.protocol !== "https:") failures.push("Source URL must use HTTPS.");
    if (!parsed.hostname.includes(".")) failures.push("Source URL has no valid hostname.");
  } catch {
    failures.push("Source URL is not a valid absolute URL.");
  }

  if (!failures.length) {
    try {
      const response = await fetchPage(requestedUrl);
      status = response.status;
      finalUrl = response.url;
      if (!response.ok) failures.push(`Source returned HTTP ${response.status}.`);
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/html")) failures.push(`Source returned unsupported content type: ${contentType || "unknown"}.`);
      body = await response.text();
      pageTitle = extractTitle(body);
      canonicalUrl = extractCanonical(body);
      if (!pageTitle) failures.push("No page title could be read from the resolved source.");
    } catch (error) {
      failures.push(`Source could not be opened: ${error?.message || error}`);
    }
  }

  const pageText = visibleText(body);
  const titleScore = pageTitle ? similarity(source.title, pageTitle) : 0;
  if (pageTitle && titleScore < 0.45) {
    failures.push(`Recorded title does not match resolved page title (similarity ${titleScore.toFixed(2)}).`);
  }

  const missingNumbers = materialNumbers(source.confirmed_fact).filter((number) => !normalize(pageText).includes(normalize(number)));
  if (missingNumbers.length) failures.push(`Confirmed-fact numbers not found on source page: ${missingNumbers.join(", ")}.`);

  const terms = importantTerms(source);
  const matchedTerms = terms.filter((term) => normalize(pageText).includes(term));
  if (terms.length >= 2 && matchedTerms.length === 0) failures.push("Central named entities were not found on the resolved page.");

  results.push({
    index: index + 1,
    source_name: source.source_name || "",
    recorded_title: source.title || "",
    requested_url: requestedUrl,
    final_url: finalUrl,
    canonical_url: canonicalUrl,
    resolved_title: pageTitle,
    http_status: status,
    title_similarity: Number(titleScore.toFixed(3)),
    checked_numbers: materialNumbers(source.confirmed_fact),
    matched_named_terms: matchedTerms,
    passed: failures.length === 0,
    failures
  });
}

const failed = results.filter((item) => !item.passed);
const report = {
  schema_version: 1,
  edition: DATE,
  generated_at: new Date().toISOString(),
  passed: failed.length === 0,
  source_count: results.length,
  failed_source_count: failed.length,
  policy: "Fail closed: every recorded source URL must resolve, match its recorded title and contain the material numeric/entity evidence used by the draft.",
  results
};
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

if (failed.length) {
  for (const item of failed) {
    console.error(`SOURCE BLOCK ${item.index}: ${item.recorded_title}`);
    for (const failure of item.failures) console.error(`  - ${failure}`);
  }
  throw new Error(`${failed.length} of ${results.length} sources failed integrity validation. Candidate generation is blocked.`);
}

console.log(`All ${results.length} source URLs resolved and matched their recorded evidence.`);
