import fs from "node:fs";
import path from "node:path";
import OpenAI from "./gemini-openai-compat.mjs";

const ROOT = process.cwd();
const DATE = process.env.SAPIVER_FORGE_DATE || process.env.SAPIVER_FORGE_DATE;
const dir = path.join(ROOT, "drafts", DATE);
const structuredPath = path.join(dir, "structured_output.json");
const podcastPath = path.join(dir, "podcast", "COPY_PASTE_INTO_ELEVENLABS.txt");
if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required for podcast-derived socials.");
if (!fs.existsSync(structuredPath)) throw new Error("Podcast-derived socials require structured_output.json.");
const data = JSON.parse(fs.readFileSync(structuredPath, "utf8"));
const podcast = fs.existsSync(podcastPath) ? fs.readFileSync(podcastPath, "utf8") : "";

const socialSchema = {
  type: "object", additionalProperties: false,
  required: ["tiktok_script", "tiktok_caption_prompt", "youtube_shorts_script", "facebook_post", "pinterest_title", "pinterest_description", "linkedin_post", "quote_card_lines"],
  properties: {
    tiktok_script: { type: "string" }, tiktok_caption_prompt: { type: "string" }, youtube_shorts_script: { type: "string" },
    facebook_post: { type: "string" }, pinterest_title: { type: "string" }, pinterest_description: { type: "string" }, linkedin_post: { type: "string" },
    quote_card_lines: { type: "array", minItems: 5, maxItems: 5, items: { type: "string" } }
  }
};
const client = new OpenAI();
const response = await client.responses.create({
  model: process.env.GEMINI_TEXT_MODEL || "gemini-3.1-flash-lite",
  reasoning: { effort: "medium" },
  input: [
    { role: "system", content: "Create platform-specific social assets from a verified Sapiver Forge broad AI podcast. Do not advertise the Output Release Gate or force a product connection. Use only facts in the supplied verified research and podcast. Choose the strongest single podcast moment for each platform. TikTok must be 18–30 spoken words, question-first and useful without a presenter. The caption and written posts may invite people to hear the full Sapiver Forge AI Briefing. Never invent urgency, popularity, quotations, statistics or outcomes." },
    { role: "user", content: `EDITION: ${DATE}\n\nVERIFIED RESEARCH:\n${JSON.stringify({ sources: data.sources, story_summaries: data.story_summaries }, null, 2)}\n\nVERIFIED PODCAST SCRIPT:\n${podcast}\n\nReturn complete TikTok, YouTube Shorts, Facebook, Pinterest and LinkedIn assets plus five useful quote-card lines.` }
  ],
  text: { format: { type: "json_schema", name: "sapiver_forge_podcast_socials", strict: true, schema: socialSchema } }
});
if (!response.output_text) throw new Error("Gemini returned no podcast-derived social output.");
const social = JSON.parse(response.output_text);
data.social = social;
data.social_mode = "podcast_general";
data.social_source = "verified_broad_ai_podcast";
fs.writeFileSync(structuredPath, `${JSON.stringify(data, null, 2)}\n`);
fs.writeFileSync(path.join(dir, "social_pack.md"), `# Sapiver Forge Podcast-Derived Social Pack — ${DATE}\n\nStatus: Draft — human approval required\n\n## TikTok Script\n\n${social.tiktok_script}\n\n## TikTok Caption\n\n${social.tiktok_caption_prompt}\n\n## YouTube Shorts Script\n\n${social.youtube_shorts_script}\n\n## Facebook Post\n\n${social.facebook_post}\n\n## Pinterest Pin\n\n**Title:** ${social.pinterest_title}\n\n**Description:** ${social.pinterest_description}\n\n## LinkedIn-Style Post\n\n${social.linkedin_post}\n\n## Quote Cards\n\n${social.quote_card_lines.map((line) => `- ${line}`).join("\n")}\n`);
console.log(`Generated general social assets from the verified broad AI podcast for ${DATE}.`);
