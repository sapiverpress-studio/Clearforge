import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";

const ROOT = process.cwd();
const DATE = process.env.CLEARFORGE_DATE || new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());
const dir = path.join(ROOT, "drafts", DATE);
const verificationPath = path.join(dir, "claim-verification-initial.json");
if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required for factual repair.");
if (!fs.existsSync(verificationPath)) throw new Error("Initial claim-verification report is missing.");

const read = (file) => fs.readFileSync(path.join(dir, file), "utf8");
const structured = JSON.parse(read("structured_output.json"));
const verification = JSON.parse(fs.readFileSync(verificationPath, "utf8"));
if (verification.passed === true) {
  fs.copyFileSync(verificationPath, path.join(dir, "claim-verification.json"));
  console.log("No factual repair required.");
  process.exit(0);
}

const files = {
  structured_output_json: JSON.stringify(structured),
  daily_article: read("daily_brief.md"),
  full_feature: read("feature.md"),
  podcast_script: read(path.join("podcast", "COPY_PASTE_INTO_ELEVENLABS.txt"))
};
const schema = {
  type: "object", additionalProperties: false,
  required: ["structured_output_json", "daily_article", "full_feature", "podcast_script", "corrections_applied"],
  properties: {
    structured_output_json: { type: "string" },
    daily_article: { type: "string" },
    full_feature: { type: "string" },
    podcast_script: { type: "string" },
    corrections_applied: { type: "array", items: { type: "string" } }
  }
};
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const response = await client.responses.create({
  model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
  reasoning: { effort: "high" },
  input: [{
    role: "system",
    content: `You are Clearforge's factual correction editor. Apply every blocking claim finding and every failed numeric, availability/access and inference audit across every occurrence in all supplied outputs. Preserve all material eligibility, programme, account, region, preview, rollout and self-service restrictions from the cited source. Replace unsupported comparative or universal conclusions with explicit, proportionate Clearforge interpretation. Preserve structure, length, voice, source URLs, relevant product CTA and the internal Clearforge AI-assistance/human-approval disclosure. Make only necessary factual corrections. Do not introduce new claims. The returned structured_output_json must parse as JSON and preserve its complete schema.`
  }, {
    role: "user",
    content: `EDITION: ${DATE}\n\nVERIFICATION REPORT:\n${JSON.stringify(verification)}\n\nFILES:\n${JSON.stringify(files)}`
  }],
  text: { format: { type: "json_schema", name: "clearforge_factual_repair", strict: true, schema } }
});
if (!response.output_text) throw new Error("Factual repair returned no result.");
const repaired = JSON.parse(response.output_text);
const repairedStructured = JSON.parse(repaired.structured_output_json);
fs.writeFileSync(path.join(dir, "structured_output.json"), JSON.stringify(repairedStructured, null, 2) + "\n");
fs.writeFileSync(path.join(dir, "daily_brief.md"), repaired.daily_article.trim() + "\n");
fs.writeFileSync(path.join(dir, "feature.md"), repaired.full_feature.trim() + "\n");
fs.writeFileSync(path.join(dir, "podcast", "COPY_PASTE_INTO_ELEVENLABS.txt"), repaired.podcast_script.trim() + "\n");
fs.writeFileSync(path.join(dir, "factual-repair.json"), JSON.stringify({
  edition: DATE, corrections_applied: repaired.corrections_applied
}, null, 2) + "\n");

const social = repairedStructured.social || {};
fs.writeFileSync(path.join(dir, "social_pack.md"), `# Clearforge Social Repurpose Pack — ${DATE}

Status: Draft — corrected; final independent claim verification pending

## TikTok Script

${social.tiktok_script || ""}

## YouTube Shorts Script

${social.youtube_shorts_script || ""}

## Facebook Post

${social.facebook_post || ""}

## Pinterest Pin

**Title:** ${social.pinterest_title || ""}

**Description:** ${social.pinterest_description || ""}

## LinkedIn-Style Post

${social.linkedin_post || ""}
`);
console.log(`Applied ${repaired.corrections_applied.length} factual correction(s).`);
