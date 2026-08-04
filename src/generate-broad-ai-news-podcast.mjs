import fs from "node:fs";
import path from "node:path";
import OpenAI from "./gemini-openai-compat.mjs";

const ROOT = process.cwd();
const DATE = process.env.SAPIVER_FORGE_DATE || process.env.SAPIVER_FORGE_DATE || new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());
const draftDir = path.join(ROOT, "drafts", DATE);
const structuredPath = path.join(draftDir, "structured_output.json");
const sourceReportPath = path.join(draftDir, "source-integrity-report.json");
const lockedFactsPath = path.join(draftDir, "locked-facts.json");
const podcastDir = path.join(draftDir, "podcast");

if (!fs.existsSync(structuredPath)) throw new Error(`Missing ${structuredPath}`);
if (!fs.existsSync(sourceReportPath)) throw new Error("Podcast generation is blocked until source integrity has passed.");
if (!fs.existsSync(lockedFactsPath)) throw new Error("Podcast generation is blocked until verified facts have been locked.");
const sourceReport = JSON.parse(fs.readFileSync(sourceReportPath, "utf8"));
if (sourceReport.passed !== true) throw new Error("Podcast generation is blocked because source integrity failed.");
const data = JSON.parse(fs.readFileSync(structuredPath, "utf8"));
const lock = JSON.parse(fs.readFileSync(lockedFactsPath, "utf8"));
const sourceRecords = Array.isArray(data.sources) ? data.sources : [];
const lockedFacts = Array.isArray(lock.facts) ? lock.facts.filter((fact) => fact.verification_status === "verified" && fact.fact_type === "supported_fact") : [];
const sources = lockedFacts.map((fact) => {
  const source = sourceRecords.find((item) => item.url === fact.source_url) || {};
  return {
    source_name: source.source_name || new URL(fact.source_url).hostname,
    title: source.title || "Verified AI development",
    url: fact.source_url,
    published_date: source.published_date || DATE,
    confirmed_fact: fact.atomic_claim,
    exact_evidence: fact.exact_supporting_evidence_passage,
    interpretation: "Any analysis beyond this confirmed fact must be explicitly introduced as Sapiver Forge interpretation."
  };
});
const stories = sources.map((source) => ({
  title: source.title,
  summary: source.confirmed_fact,
  why_it_matters: source.interpretation,
  claim_to_verify: "NONE — verified from locked source evidence."
}));

const verifiedCount = Math.min(stories.length, sources.length);
if (verifiedCount < 1) throw new Error("Podcast requires at least one verified story.");
const requiredStoryCount = Math.min(3, verifiedCount);
// Keep the requested depth proportional to the amount of verified material. Inflating a
// small evidence set to a long fixed runtime encourages filler or unsupported claims.
const targetWords = verifiedCount === 1 ? { min: 300, max: 650 } : verifiedCount === 2 ? { min: 350, max: 800 } : { min: 400, max: 1000 };
const formatName = verifiedCount >= 3 ? "broad AI news briefing" : verifiedCount === 2 ? "two-story AI briefing" : "verified AI deep dive";

if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required for podcast generation.");
const schema = {
  type: "object", additionalProperties: false,
  required: ["episode_title", "story_order", "selection_reason", "spoken_script", "human_review_checks", "production_notes"],
  properties: {
    episode_title: { type: "string" },
    story_order: { type: "array", minItems: requiredStoryCount, maxItems: Math.min(5, verifiedCount), items: { type: "integer", minimum: 0, maximum: Math.max(0, verifiedCount - 1) } },
    selection_reason: { type: "string" },
    spoken_script: { type: "string" },
    human_review_checks: { type: "array", minItems: 6, items: { type: "string" } },
    production_notes: { type: "array", items: { type: "string" } }
  }
};

const client = new OpenAI();
const response = await client.responses.create({
  model: process.env.GEMINI_TEXT_MODEL || "gemini-3.1-flash-lite",
  reasoning: { effort: "high" },
  input: [
    {
      role: "system",
      content: `You are the Sapiver Forge broad AI news podcast editor. This podcast is separate from the practical social pipeline. Cover the most important verified developments across the whole AI landscape: frontier models, research, coding and agents, creator tools, image/video/audio, open source, chips and infrastructure, robotics, science, regulation, safety, investment, business adoption, employment and social impact. Use only the supplied verified source records. Do not search again, invent URLs, add facts, reconstruct titles or turn interpretation into fact. Preserve every material qualification about dates, access, preview status, sample size, benchmark scope and uncertainty. Prefer a varied set of stories over several versions of the same topic. Explain why each story matters to a mixed audience without forcing a Sapiver Forge product connection.`
    },
    {
      role: "user",
      content: `EDITION: ${DATE}\n\nVERIFIED STORIES:\n${JSON.stringify(stories, null, 2)}\n\nVERIFIED SOURCES:\n${JSON.stringify(sources, null, 2)}\n\nWrite one engaging ${formatName} covering ${requiredStoryCount === 1 ? "the supplied verified story in useful depth" : `at least ${requiredStoryCount} supplied stories`}. Open with a concise overview, then move through stories in descending importance. For each story: state only the confirmed facts, label interpretation, explain the practical consequence, and state what remains unknown. End with a short watchlist for the next few days. Aim for ${targetWords.min.toLocaleString("en-GB")}-${targetWords.max.toLocaleString("en-GB")} spoken words. The spoken_script must contain only words to be spoken: no headings, markdown, URLs, stage directions or sales pitch. Use calm, precise, non-hyped language. Avoid generic filler and repeated phrasing.`
    }
  ],
  text: { format: { type: "json_schema", name: "sapiver_forge_broad_ai_news_podcast", strict: true, schema } }
});

if (!response.output_text) throw new Error("Gemini returned no broad podcast output.");
const podcast = JSON.parse(response.output_text);
const uniqueOrder = [...new Set(podcast.story_order)];
if (uniqueOrder.length < requiredStoryCount || uniqueOrder.some((index) => index < 0 || index >= stories.length)) throw new Error(`Podcast did not select ${requiredStoryCount} valid distinct verified ${requiredStoryCount === 1 ? "story" : "stories"}.`);
const script = String(podcast.spoken_script || "").trim();
const words = script.split(/\s+/).filter(Boolean).length;
if (words < 200 || words > Math.ceil(targetWords.max * 1.12)) throw new Error(`Podcast length out of bounds for ${verifiedCount} verified ${verifiedCount === 1 ? "story" : "stories"}: ${words} words.`);
if (/https?:\/\/|^#|\[[^\]]+\]/m.test(script)) throw new Error("Podcast script contains non-spoken material.");

fs.mkdirSync(podcastDir, { recursive: true });
const write = (name, content) => fs.writeFileSync(path.join(podcastDir, name), content.endsWith("\n") ? content : `${content}\n`, "utf8");
write("PODCAST_NARRATION_SCRIPT.txt", script);
write("COPY_PASTE_INTO_ELEVENLABS.txt", script);
write("podcast-script.md", `# ${podcast.episode_title}\n\nDate: ${DATE}\nFormat: ${formatName}\nNarrator: Kore\nVoice provider: Gemini\nHuman review required: yes\nWord count: ${words}\n\n## Stories covered\n\n${uniqueOrder.map((index) => `- ${stories[index].title}`).join("\n")}\n\n## Spoken script\n\n${script}\n\n## Human-review checks\n\n${podcast.human_review_checks.map((item) => `- [ ] ${item}`).join("\n")}\n`);
write("source-notes.md", `# Verified source notes — ${DATE}\n\n${sources.map((source, index) => `## ${index + 1}. ${source.title}\n\n- Publisher: ${source.source_name}\n- URL: ${source.url}\n- Published: ${source.published_date}\n- Confirmed fact: ${source.confirmed_fact}\n- Interpretation: ${source.interpretation}\n`).join("\n")}`);
write("episode-metadata.json", JSON.stringify({
  version: 2,
  date: DATE,
  brand: "Sapiver Forge",
  type: "sapiver_forge_broad_ai_news_podcast",
  human_review_required: true,
  narrator: "Kore",
  voice_provider: "Gemini",
  episode_title: podcast.episode_title,
  story_order: uniqueOrder,
  stories_covered: uniqueOrder.map((index) => stories[index].title),
  selection_reason: podcast.selection_reason,
  word_count: words,
  estimated_duration_minutes: Number((words / 145).toFixed(1)),
  narration_file: "PODCAST_NARRATION_SCRIPT.txt",
  legacy_tts_input_alias: "COPY_PASTE_INTO_ELEVENLABS.txt",
  source_notes: "source-notes.md",
  validation_warnings: []
}, null, 2));
console.log(`Generated broad AI news podcast for ${DATE}: ${uniqueOrder.length} stories, ${words} words.`);
