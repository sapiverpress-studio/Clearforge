import fs from "node:fs";
import path from "node:path";
import OpenAI from "./gemini-openai-compat.mjs";

const ROOT = process.cwd();
const DATE = process.env.CLEARFORGE_DATE || new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const dir = path.join(ROOT, "drafts", DATE);
const structuredPath = path.join(dir, "structured_output.json");
if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required for precise source resolution.");
if (!fs.existsSync(structuredPath)) throw new Error(`Missing ${structuredPath}`);

const data = JSON.parse(fs.readFileSync(structuredPath, "utf8"));
const original = Array.isArray(data.sources) ? data.sources : [];
if (original.length < 3) throw new Error("At least three source records are required.");

const itemSchema = {
  type: "object", additionalProperties: false,
  required: ["source_index", "source_name", "title", "url", "published_date", "resolution_basis"],
  properties: {
    source_index: { type: "integer", minimum: 0, maximum: original.length - 1 },
    source_name: { type: "string" }, title: { type: "string" }, url: { type: "string" },
    published_date: { type: "string" }, resolution_basis: { type: "string" }
  }
};
const schema = { type: "object", additionalProperties: false, required: ["resolved_sources"], properties: { resolved_sources: { type: "array", minItems: original.length, maxItems: original.length, items: itemSchema } } };

const client = new OpenAI();
const response = await client.responses.create({
  model: process.env.GEMINI_RESEARCH_MODEL || "gemini-3.6-flash",
  reasoning: { effort: "high" },
  tools: [{ type: "web_search", user_location: { type: "approximate", country: "GB", city: "London" } }],
  input: [
    { role: "system", content: "You resolve citations, not write articles. For each supplied source record, search for the exact real page supporting its confirmed fact. Return only a URL that appeared in the search evidence or an authoritative primary-source URL you opened. Never construct, guess, shorten or rewrite a URL slug. Prefer the primary source; otherwise use the exact reputable reporting page. The page title, publisher and date must match the returned URL. If the proposed story cannot be cleanly sourced, replace it with a closely related, current, independently verifiable story that preserves the same coverage lane and topic category. Do not invent a source." },
    { role: "user", content: `EDITION: ${DATE}\nSOURCE RECORDS:\n${JSON.stringify(original, null, 2)}\n\nReturn one resolved record for each zero-based source_index. The URL must be exact and directly reopenable. resolution_basis must briefly state what exact claim the page supports.` }
  ],
  text: { format: { type: "json_schema", name: "sapiver_forge_resolved_sources", strict: true, schema } }
});
if (!response.output_text) throw new Error("Source resolver returned no output.");
const result = JSON.parse(response.output_text);
const byIndex = new Map(result.resolved_sources.map((item) => [item.source_index, item]));
if (byIndex.size !== original.length) throw new Error("Source resolver did not return exactly one unique record per source.");

const replacements = [];
data.sources = original.map((source, index) => {
  const resolved = byIndex.get(index);
  if (!resolved) throw new Error(`Missing resolved source ${index}`);
  try { const u = new URL(resolved.url); if (u.protocol !== "https:") throw new Error(); } catch { throw new Error(`Resolver returned invalid URL for source ${index + 1}`); }
  replacements.push({ old_url: source.url || "", new_url: resolved.url, old_title: source.title || "", new_title: resolved.title });
  return { ...source, source_name: resolved.source_name, title: resolved.title, url: resolved.url, published_date: resolved.published_date, evidence_basis: `${source.evidence_basis || ""} Exact source resolution: ${resolved.resolution_basis}`.trim() };
});

fs.writeFileSync(structuredPath, `${JSON.stringify(data, null, 2)}\n`);
fs.writeFileSync(path.join(dir, "sources.json"), `${JSON.stringify(data.sources, null, 2)}\n`);
for (const filename of ["daily_brief.md", "social_pack.md"]) {
  const file = path.join(dir, filename);
  if (!fs.existsSync(file)) continue;
  let text = fs.readFileSync(file, "utf8");
  for (const r of replacements) {
    if (r.old_url) text = text.split(r.old_url).join(r.new_url);
    if (r.old_title) text = text.split(r.old_title).join(r.new_title);
  }
  fs.writeFileSync(file, text);
}
fs.writeFileSync(path.join(dir, "source-resolution-report.json"), `${JSON.stringify({ edition: DATE, generated_at: new Date().toISOString(), replacements }, null, 2)}\n`);
console.log(`Resolved ${data.sources.length} exact source records before validation.`);
