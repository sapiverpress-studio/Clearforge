import fs from "node:fs";
import path from "node:path";
import OpenAI from "./gemini-openai-compat.mjs";

const ROOT = process.cwd();
const DATE = process.env.CLEARFORGE_DATE || new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const dir = path.join(ROOT, "drafts", DATE);
const structuredPath = path.join(dir, "structured_output.json");
const pruneStatePath = path.join(dir, "source-prune-state.json");
if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required for precise source resolution.");
if (!fs.existsSync(structuredPath)) throw new Error(`Missing ${structuredPath}`);

const data = JSON.parse(fs.readFileSync(structuredPath, "utf8"));
const originalSources = Array.isArray(data.sources) ? data.sources : [];
const originalStories = Array.isArray(data.story_summaries) ? data.story_summaries : [];
if (originalSources.length < 3 || originalSources.length > 5) throw new Error("Source resolution requires between three and five source candidates.");
if (originalStories.length !== originalSources.length) throw new Error("Source and story candidate arrays must have the same length and order.");

const normaliseUrl = (value) => {
  const url = new URL(String(value));
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) if (/^(utm_|gclid|fbclid)/i.test(key)) url.searchParams.delete(key);
  return url.toString().replace(/\/$/, "");
};
const normaliseText = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const titleTokens = (value) => new Set(normaliseText(value).split(" ").filter((x) => x.length > 2 && !["the","and","for","with","from","into","your","about"].includes(x)));
const titleSimilarity = (a, b) => {
  const A = titleTokens(a);
  const B = titleTokens(b);
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const x of A) if (B.has(x)) n += 1;
  return n / Math.min(A.size, B.size);
};
const titlesCompatible = (a, b) => {
  const left = normaliseText(a);
  const right = normaliseText(b);
  if (!left || !right) return true;
  if (left.includes(right) || right.includes(left)) return true;
  return titleSimilarity(left, right) >= 0.22;
};
function collectSearchEvidence(value, out = []) {
  if (!value || typeof value !== "object") return out;
  if (value.type === "message") return out;
  if (typeof value.url === "string" && /^https:\/\//i.test(value.url)) out.push({ url: value.url, title: String(value.title || value.name || "") });
  if (Array.isArray(value)) value.forEach((item) => collectSearchEvidence(item, out));
  else Object.values(value).forEach((item) => collectSearchEvidence(item, out));
  return out;
}
function selectGroundedEvidence(resolved, source, evidence, evidenceByUrl) {
  let key;
  try { key = normaliseUrl(resolved.url); } catch { return null; }
  const exact = evidenceByUrl.get(key);
  if (exact) return { item: exact, match_type: "exact_url" };

  const ranked = evidence
    .map((item) => ({
      item,
      score: Math.max(titleSimilarity(resolved.title, item.title), titleSimilarity(source.title, item.title))
    }))
    .filter(({ item, score }) => score >= 0.35 || titlesCompatible(resolved.title, item.title) || titlesCompatible(source.title, item.title))
    .sort((a, b) => b.score - a.score);

  if (!ranked.length) return null;
  if (ranked.length > 1 && ranked[0].score === ranked[1].score && ranked[0].item.url !== ranked[1].item.url) return null;
  return { item: ranked[0].item, match_type: "grounded_title_to_redirect" };
}

const itemSchema = { type: "object", additionalProperties: false, required: ["source_index", "source_name", "title", "url", "published_date", "resolution_basis"], properties: {
  source_index: { type: "integer", minimum: 0, maximum: originalSources.length - 1 }, source_name: { type: "string" }, title: { type: "string" }, url: { type: "string" }, published_date: { type: "string" }, resolution_basis: { type: "string" }
}};
const schema = { type: "object", additionalProperties: false, required: ["resolved_sources"], properties: { resolved_sources: { type: "array", minItems: originalSources.length, maxItems: originalSources.length, items: itemSchema } } };

const client = new OpenAI();
const response = await client.responses.create({
  model: process.env.GEMINI_RESEARCH_MODEL || "gemini-3.6-flash",
  reasoning: { effort: "high" },
  tools: [{ type: "web_search", user_location: { type: "approximate", country: "GB", city: "London" } }],
  include: ["web_search_call.action.sources"],
  input: [
    { role: "system", content: "Resolve citations only. Search for an exact real page supporting each confirmed fact. Select only a page returned by the search tool. Prefer primary sources, otherwise exact reputable reporting. Return one attempted resolution for every supplied candidate. Do not stop because one candidate is weak; the pipeline will discard failed candidates independently." },
    { role: "user", content: `EDITION: ${DATE}\nSOURCE RECORDS:\n${JSON.stringify(originalSources, null, 2)}\nReturn one record per zero-based source_index.` }
  ],
  text: { format: { type: "json_schema", name: "sapiver_forge_resolved_sources", strict: true, schema } }
});
if (!response.output_text) throw new Error("Source resolver returned no output.");
const evidence = collectSearchEvidence(response.output || []);
const evidenceByUrl = new Map();
for (const item of evidence) {
  try { evidenceByUrl.set(normaliseUrl(item.url), item); } catch {}
}
if (!evidenceByUrl.size) throw new Error("Search tool returned no bindable source URLs.");

const result = JSON.parse(response.output_text);
const byIndex = new Map(result.resolved_sources.map((item) => [item.source_index, item]));
const survivors = [];
const dropped = [];
const replacements = [];

for (let index = 0; index < originalSources.length; index += 1) {
  const source = originalSources[index];
  const story = originalStories[index];
  const resolved = byIndex.get(index);
  if (!resolved) {
    dropped.push({ original_index: index, title: source.title || story.title || "", reason: "Resolver returned no record for this candidate." });
    continue;
  }
  const grounded = selectGroundedEvidence(resolved, source, evidence, evidenceByUrl);
  if (!grounded) {
    dropped.push({ original_index: index, title: source.title || story.title || "", proposed_url: resolved.url || "", reason: "Could not match the candidate uniquely to grounded search evidence." });
    continue;
  }

  const evidenceItem = grounded.item;
  const canonicalTitle = String(evidenceItem.title || resolved.title || source.title || "").trim();
  if (!canonicalTitle) {
    dropped.push({ original_index: index, title: source.title || story.title || "", reason: "No grounded title was available." });
    continue;
  }

  const resolvedSource = {
    ...source,
    source_name: resolved.source_name,
    title: canonicalTitle,
    url: evidenceItem.url,
    proposed_canonical_url: resolved.url,
    published_date: resolved.published_date,
    evidence_basis: `${source.evidence_basis || ""} Exact source resolution: ${resolved.resolution_basis}`.trim()
  };
  survivors.push({ original_index: index, source: resolvedSource, story });
  replacements.push({
    original_index: index,
    old_url: source.url || "",
    new_url: evidenceItem.url,
    proposed_canonical_url: resolved.url,
    old_title: source.title || "",
    new_title: canonicalTitle,
    evidence_url: evidenceItem.url,
    evidence_title: evidenceItem.title,
    evidence_grounded: true,
    match_type: grounded.match_type
  });
}

if (survivors.length < 3) {
  fs.writeFileSync(path.join(dir, "source-resolution-report.json"), `${JSON.stringify({ edition: DATE, generated_at: new Date().toISOString(), initial_count: originalSources.length, survivor_count: survivors.length, dropped, replacements }, null, 2)}\n`);
  throw new Error(`Only ${survivors.length} of ${originalSources.length} source candidates survived resolution; at least three are required.`);
}

data.sources = survivors.map((item) => item.source);
data.story_summaries = survivors.map((item) => item.story);
fs.writeFileSync(structuredPath, `${JSON.stringify(data, null, 2)}\n`);
fs.writeFileSync(path.join(dir, "sources.json"), `${JSON.stringify(data.sources, null, 2)}\n`);
fs.writeFileSync(path.join(dir, "source-resolution-report.json"), `${JSON.stringify({ edition: DATE, generated_at: new Date().toISOString(), initial_count: originalSources.length, survivor_count: survivors.length, dropped_count: dropped.length, dropped, replacements }, null, 2)}\n`);
fs.writeFileSync(pruneStatePath, `${JSON.stringify({ edition: DATE, initial_count: originalSources.length, survivor_count: survivors.length, dropped, rebuilt_at: null }, null, 2)}\n`);
console.log(`Source resolution retained ${survivors.length} of ${originalSources.length} candidates and discarded ${dropped.length}.`);
