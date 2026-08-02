import fs from "node:fs";
import path from "node:path";
import OpenAI from "./gemini-openai-compat.mjs";

const ROOT = process.cwd();
const DATE = process.env.CLEARFORGE_DATE || new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const dir = path.join(ROOT, "drafts", DATE);
const structuredPath = path.join(dir, "structured_output.json");
const pruneStatePath = path.join(dir, "source-prune-state.json");

if (!fs.existsSync(pruneStatePath)) {
  console.log("No pruned stories; edition rebuild not required.");
  process.exit(0);
}
const state = JSON.parse(fs.readFileSync(pruneStatePath, "utf8"));
if (!Array.isArray(state.dropped) || state.dropped.length === 0 || state.rebuilt_at) {
  console.log("No pending pruned-story rebuild.");
  process.exit(0);
}
if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required to rebuild a pruned edition.");
const data = JSON.parse(fs.readFileSync(structuredPath, "utf8"));
if (!Array.isArray(data.sources) || data.sources.length < 1) throw new Error("At least one surviving source is required.");

const schema = {
  type: "object", additionalProperties: false,
  required: ["headline", "dek", "main_article", "practical_takeaway", "what_to_test_next", "claims_to_verify", "social", "headline_options"],
  properties: {
    headline: { type: "string" }, dek: { type: "string" }, main_article: { type: "string" }, practical_takeaway: { type: "string" }, what_to_test_next: { type: "string" },
    claims_to_verify: { type: "array", items: { type: "string" } },
    social: { type: "object", additionalProperties: false, required: ["tiktok_script", "youtube_shorts_script", "facebook_post", "pinterest_title", "pinterest_description", "linkedin_post", "quote_card_lines"], properties: {
      tiktok_script: { type: "string" }, youtube_shorts_script: { type: "string" }, facebook_post: { type: "string" }, pinterest_title: { type: "string" }, pinterest_description: { type: "string" }, linkedin_post: { type: "string" }, quote_card_lines: { type: "array", minItems: 5, maxItems: 5, items: { type: "string" } }
    } },
    headline_options: { type: "array", minItems: 5, maxItems: 5, items: { type: "string" } }
  }
};

const survivorCount = data.sources.length;
const formatInstruction = survivorCount === 1
  ? "Create a detailed single-story report. Go deeper on what happened, what is confirmed, what remains uncertain, who is affected, the practical consequence, and what a creator or small business should test next. Do not pad it with unrelated news."
  : survivorCount === 2
    ? "Create a detailed two-story report with a clear shared angle. Give each verified story substantial treatment and do not mention discarded stories."
    : "Create the normal multi-story Sapiver Forge edition using only the surviving stories.";

const client = new OpenAI();
const response = await client.responses.create({
  model: process.env.GEMINI_TEXT_MODEL || "gemini-3.1-flash-lite",
  input: [
    { role: "system", content: `Rewrite an existing Sapiver Forge edition using only the surviving verified sources and story summaries supplied. Do not mention or infer discarded stories. Preserve all material qualifications. ${formatInstruction} The main article must contain at least 700 words. Generate the complete social pack every time. Return empty claims_to_verify only when every material claim is directly supported by the supplied source records.` },
    { role: "user", content: `EDITION: ${DATE}\nSURVIVING SOURCES:\n${JSON.stringify(data.sources, null, 2)}\nSURVIVING STORY SUMMARIES:\n${JSON.stringify(data.story_summaries, null, 2)}` }
  ],
  text: { format: { type: "json_schema", name: "sapiver_forge_pruned_rebuild", strict: true, schema } }
});
if (!response.output_text) throw new Error("Pruned edition rebuild returned no output.");
const rebuilt = JSON.parse(response.output_text);
Object.assign(data, rebuilt);
fs.writeFileSync(structuredPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");

const sourceLines = data.sources.map((s, i) => `${i + 1}. [${s.title}](${s.url}) — ${s.source_name} (${s.published_date})\n   - Confirmed: ${s.confirmed_fact}\n   - Interpretation: ${s.interpretation}`).join("\n\n");
const summaries = data.story_summaries.map((s) => `### ${s.title}\n\n${s.summary}\n\n**Why it matters:** ${s.why_it_matters}\n\n**Practical angle:** ${s.practical_angle}`).join("\n\n");
fs.writeFileSync(path.join(dir, "daily_brief.md"), `# ${data.headline}\n\nStatus: Draft — automatic validation pending\n\n${data.dek}\n\n## Source List\n\n${sourceLines}\n\n## Story Summaries\n\n${summaries}\n\n## Main Article\n\n${data.main_article}\n\n## Practical Takeaway\n\n${data.practical_takeaway}\n\n## What To Test Next\n\n${data.what_to_test_next}\n\n## Claims To Verify Before Publishing\n\n${data.claims_to_verify.length ? data.claims_to_verify.map((x) => `- ${x}`).join("\n") : "None — all material claims used in this edition were verified against the cited sources."}\n`, "utf8");
fs.writeFileSync(path.join(dir, "social_pack.md"), `# Sapiver Forge Social Repurpose Pack — ${DATE}\n\n## TikTok Script\n\n${data.social.tiktok_script}\n\n## YouTube Shorts Script\n\n${data.social.youtube_shorts_script}\n\n## Facebook Post\n\n${data.social.facebook_post}\n\n## Pinterest Pin\n\n**Title:** ${data.social.pinterest_title}\n\n**Description:** ${data.social.pinterest_description}\n\n## LinkedIn-Style Post\n\n${data.social.linkedin_post}\n\n## 5 Short Quote/Card Lines\n\n${data.social.quote_card_lines.map((x) => `- ${x}`).join("\n")}\n`, "utf8");
fs.writeFileSync(pruneStatePath, `${JSON.stringify({ ...state, survivor_count: data.sources.length, rebuilt_at: new Date().toISOString() }, null, 2)}\n`, "utf8");
console.log(`Rebuilt detailed edition and full social pack from ${data.sources.length} verified surviving ${data.sources.length === 1 ? "story" : "stories"}.`);
