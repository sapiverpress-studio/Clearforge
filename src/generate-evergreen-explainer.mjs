import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";

const ROOT = process.cwd();
const DRAFTS = path.join(ROOT, "drafts");
const EXPLAINERS = path.join(ROOT, "explainers");
const REGISTRY = path.join(EXPLAINERS, "registry.json");
const today = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());

if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required.");

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function readJson(file, fallback = null) { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; } }
function write(file, content) { ensureDir(path.dirname(file)); fs.writeFileSync(file, content.endsWith("\n") ? content : `${content}\n`, "utf8"); }
function slugify(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}
function datePart(value) { return String(value || "").match(/^\d{4}-\d{2}-\d{2}/)?.[0] || today; }

function collectApprovedResearch() {
  if (!fs.existsSync(DRAFTS)) return [];
  return fs.readdirSync(DRAFTS)
    .filter((name) => /^\d{4}-\d{2}-\d{2}/.test(name))
    .sort().reverse().slice(0, 30)
    .flatMap((edition) => {
      const dir = path.join(DRAFTS, edition);
      const approval = readJson(path.join(dir, "approval.json"));
      const structured = readJson(path.join(dir, "structured_output.json"));
      if (!approval || !structured || approval.article_approved !== true) return [];
      const unresolved = readJson(path.join(dir, "verification-report.json"), {});
      if (unresolved.material_claims_unresolved === true || unresolved.passed === false) return [];
      return [{
        edition,
        date: datePart(edition),
        headline: structured.headline,
        dek: structured.dek,
        stories: structured.story_summaries || [],
        sources: structured.sources || [],
        practical_takeaway: structured.practical_takeaway || "",
        claims_to_verify: structured.claims_to_verify || []
      }];
    });
}

const packs = collectApprovedResearch();
if (packs.length < 2) throw new Error("At least two approved research packs are required for an evergreen explainer.");

ensureDir(EXPLAINERS);
const registry = readJson(REGISTRY, { version: 1, explainers: [] });
const existingSummaries = (registry.explainers || []).map((item) => ({
  slug: item.slug,
  title: item.title,
  description: item.description,
  last_updated: item.last_updated,
  source_dates: item.source_dates || []
}));

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["action", "slug", "title", "description", "search_question", "guide_markdown", "topic_slugs", "source_editions", "source_urls", "change_summary"],
  properties: {
    action: { type: "string", enum: ["create", "update"] },
    slug: { type: "string" },
    title: { type: "string" },
    description: { type: "string" },
    search_question: { type: "string" },
    guide_markdown: { type: "string" },
    topic_slugs: { type: "array", minItems: 1, maxItems: 3, items: { type: "string", enum: ["ai-adoption", "ai-inside-products", "creators-small-business", "systems-automation", "models-research", "safety-accountability"] } },
    source_editions: { type: "array", minItems: 2, items: { type: "string" } },
    source_urls: { type: "array", minItems: 2, items: { type: "string" } },
    change_summary: { type: "string" }
  }
};

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const model = process.env.OPENAI_MODEL || "gpt-5.4-mini";
const response = await client.responses.create({
  model,
  reasoning: { effort: "medium" },
  input: [
    {
      role: "system",
      content: "You are the Clearforge evergreen learning editor. Build durable, search-led explainers from approved Clearforge research only. Never invent facts, never turn a temporary announcement into a timeless claim, and clearly distinguish established facts, current examples, uncertainty and practical interpretation. Prefer updating an existing guide when new evidence improves the same question."
    },
    {
      role: "user",
      content: `TODAY: ${today}\n\nEXISTING GUIDES:\n${JSON.stringify(existingSummaries)}\n\nAPPROVED RESEARCH PACKS:\n${JSON.stringify(packs)}\n\nChoose one durable question normal creators, employees, managers, practical AI learners or small businesses may search for months from now. Create a new guide only when it is genuinely distinct; otherwise update the closest existing guide. The guide must be 1,200-2,000 words and use this structure:\n# Title\nShort direct answer\n## What it means\n## How it works in practice\n## Why organisations are adopting it\n## What changes for people and workflows\n## Limits, risks and what remains uncertain\n## Practical questions to ask before using it\n## Current examples\n## Sources and further reading\n\nRequirements:\n- Use only facts and URLs present in the approved research packs.\n- Include at least two different source editions and two source URLs.\n- State when rollout scale, timing or outcomes are not disclosed.\n- Separate projected benefits from measured outcomes.\n- Do not write a news recap or include date-sensitive wording in the title.\n- Use a stable lowercase hyphenated slug.\n- If action is update, the slug must exactly match an existing guide.\n- Do not claim independent reporting.\n- Keep the tone calm, plain-English and practical.`
    }
  ],
  text: { format: { type: "json_schema", name: "clearforge_evergreen_explainer", strict: true, schema } }
});

if (!response.output_text) throw new Error("OpenAI returned no evergreen explainer output.");
const result = JSON.parse(response.output_text);
const approvedEditions = new Set(packs.map((pack) => pack.edition));
const approvedUrls = new Set(packs.flatMap((pack) => pack.sources.map((source) => source.url).filter(Boolean)));
if (!result.source_editions.every((edition) => approvedEditions.has(edition))) throw new Error("Explainer referenced an unapproved source edition.");
if (!result.source_urls.every((url) => approvedUrls.has(url))) throw new Error("Explainer referenced a URL outside approved research.");

const slug = slugify(result.slug);
if (!slug || slug !== result.slug) throw new Error(`Unsafe or unstable explainer slug: ${result.slug}`);
const existing = (registry.explainers || []).find((item) => item.slug === slug);
if (result.action === "update" && !existing) throw new Error(`Update requested for unknown explainer: ${slug}`);
if (result.action === "create" && existing) throw new Error(`Create requested for existing explainer: ${slug}`);

const dir = path.join(EXPLAINERS, slug);
const previousMeta = readJson(path.join(dir, "metadata.json"), {});
const created = previousMeta.created || today;
const revisions = [...(previousMeta.revisions || []), { date: today, summary: result.change_summary, source_editions: result.source_editions }];
const metadata = {
  version: 1,
  slug,
  title: result.title,
  description: result.description,
  search_question: result.search_question,
  topic_slugs: result.topic_slugs,
  created,
  last_updated: today,
  source_editions: [...new Set([...(previousMeta.source_editions || []), ...result.source_editions])].sort(),
  source_urls: [...new Set([...(previousMeta.source_urls || []), ...result.source_urls])],
  revisions,
  approved_for_publication: true,
  editorial_basis: "Generated only from Clearforge research packs that had already passed publication approval and material-claim verification."
};

write(path.join(dir, "guide.md"), result.guide_markdown.trim());
write(path.join(dir, "metadata.json"), JSON.stringify(metadata, null, 2));
write(path.join(dir, "source-notes.md"), `# Source notes — ${result.title}\n\nLast checked: ${today}\n\n${metadata.source_urls.map((url) => `- ${url}`).join("\n")}\n\n## Revision history\n\n${revisions.map((revision) => `- ${revision.date}: ${revision.summary}`).join("\n")}\n`);

const registryEntry = { slug, title: result.title, description: result.description, search_question: result.search_question, topic_slugs: result.topic_slugs, created, last_updated: today, source_dates: metadata.source_editions.map(datePart), approved_for_publication: true };
registry.explainers = [registryEntry, ...(registry.explainers || []).filter((item) => item.slug !== slug)].sort((a, b) => b.last_updated.localeCompare(a.last_updated));
write(REGISTRY, JSON.stringify(registry, null, 2));
console.log(`${result.action === "update" ? "Updated" : "Created"} evergreen explainer: ${slug}`);
