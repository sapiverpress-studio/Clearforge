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
const preferredWords = survivorCount === 1 ? 900 : survivorCount === 2 ? 850 : 800;
const formatInstruction = survivorCount === 1
  ? "Create the strongest useful single-story report the verified evidence supports. Prefer depth, but do not pad, repeat or invent material merely to reach a fixed length."
  : survivorCount === 2
    ? "Create the strongest useful two-story report the verified evidence supports, using a shared angle only when the evidence genuinely supports one."
    : "Create a useful depth-first multi-story report led by the strongest verified development rather than a thin roundup.";

const client = new OpenAI();
async function generateDepthReport(extraInstruction = "") {
  const response = await client.responses.create({
    model: process.env.GEMINI_TEXT_MODEL || "gemini-3.1-flash-lite",
    input: [
      { role: "system", content: `Rewrite the Sapiver Forge edition using only the surviving verified sources and story summaries. Do not mention or infer discarded stories. Preserve all qualifications. ${formatInstruction} Cover what happened, what is confirmed, how it works, who is affected, current availability or rollout stage, measured versus projected outcomes, limitations, risks, unresolved questions, clearly labelled Sapiver Forge interpretation and one practical action. Generate the complete social pack every time from the strongest surviving story. The social assets must contain useful explanatory substance while retaining the existing Sapiver Forge narration and branded visual format; do not require a presenter. Return empty claims_to_verify only when every material claim is directly supported. ${extraInstruction}` },
      { role: "user", content: `EDITION: ${DATE}\nSURVIVING SOURCES:\n${JSON.stringify(data.sources, null, 2)}\nSURVIVING STORY SUMMARIES:\n${JSON.stringify(data.story_summaries, null, 2)}` }
    ],
    text: { format: { type: "json_schema", name: "sapiver_forge_depth_first_rebuild", strict: true, schema } }
  });
  if (!response.output_text) throw new Error("Pruned edition rebuild returned no output.");
  return JSON.parse(response.output_text);
}

let rebuilt = await generateDepthReport(`Aim for about ${preferredWords} words when the evidence supports it, but return a shorter complete report rather than padding or omitting output.`);
let articleWords = String(rebuilt.main_article || "").trim().split(/\s+/).filter(Boolean).length;

if (articleWords > 0 && articleWords < Math.min(preferredWords, 700)) {
  console.warn(`Initial depth-first report was ${articleWords} words; attempting one evidence-bound expansion without making length a release gate.`);
  try {
    const expanded = await generateDepthReport(`The previous draft was ${articleWords} words. Expand only where the supplied evidence supports more explanation. Do not invent facts, repeat paragraphs or pad. A short complete report is acceptable.`);
    const expandedWords = String(expanded.main_article || "").trim().split(/\s+/).filter(Boolean).length;
    if (expandedWords > articleWords) {
      rebuilt = expanded;
      articleWords = expandedWords;
    }
  } catch (error) {
    console.warn(`Optional report expansion failed; retaining the original verified report: ${error?.message || error}`);
  }
}

if (!String(rebuilt.main_article || "").trim()) {
  throw new Error("Depth-first rebuild returned no article text.");
}
if (articleWords < preferredWords) {
  console.warn(`Retaining a shorter verified report of ${articleWords} words so socials and review output are still produced.`);
}

Object.assign(data, rebuilt);
data.edition_depth_mode = survivorCount === 1 ? "single_story_report" : survivorCount === 2 ? "two_story_report" : "multi_story_depth_first";
data.verified_story_count = survivorCount;
fs.writeFileSync(structuredPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");

const sourceLines = data.sources.map((s, i) => `${i + 1}. [${s.title}](${s.url}) — ${s.source_name} (${s.published_date})\n   - Confirmed: ${s.confirmed_fact}\n   - Interpretation: ${s.interpretation}`).join("\n\n");
const summaries = data.story_summaries.map((s) => `### ${s.title}\n\n${s.summary}\n\n**Why it matters:** ${s.why_it_matters}\n\n**Practical angle:** ${s.practical_angle}`).join("\n\n");
fs.writeFileSync(path.join(dir, "daily_brief.md"), `# ${data.headline}\n\nStatus: Draft — automatic validation pending\n\nFormat: ${data.edition_depth_mode}\n\n${data.dek}\n\n## Source List\n\n${sourceLines}\n\n## Story Summaries\n\n${summaries}\n\n## Main Article\n\n${data.main_article}\n\n## Practical Takeaway\n\n${data.practical_takeaway}\n\n## What To Test Next\n\n${data.what_to_test_next}\n\n## Claims To Verify Before Publishing\n\n${data.claims_to_verify.length ? data.claims_to_verify.map((x) => `- ${x}`).join("\n") : "None — all material claims used in this edition were verified against the cited sources."}\n`, "utf8");
fs.writeFileSync(path.join(dir, "social_pack.md"), `# Sapiver Forge Social Repurpose Pack — ${DATE}\n\nSource format: ${data.edition_depth_mode}\n\n## TikTok Script\n\n${data.social.tiktok_script}\n\n## YouTube Shorts Script\n\n${data.social.youtube_shorts_script}\n\n## Facebook Post\n\n${data.social.facebook_post}\n\n## Pinterest Pin\n\n**Title:** ${data.social.pinterest_title}\n\n**Description:** ${data.social.pinterest_description}\n\n## LinkedIn-Style Post\n\n${data.social.linkedin_post}\n\n## 5 Short Quote/Card Lines\n\n${data.social.quote_card_lines.map((x) => `- ${x}`).join("\n")}\n`, "utf8");
fs.writeFileSync(pruneStatePath, `${JSON.stringify({ ...state, survivor_count: survivorCount, rebuilt_at: new Date().toISOString(), depth_mode: data.edition_depth_mode, article_words: articleWords }, null, 2)}\n`, "utf8");
console.log(`Rebuilt ${data.edition_depth_mode} edition from ${survivorCount} verified ${survivorCount === 1 ? "story" : "stories"}: ${articleWords} words plus full socials.`);
