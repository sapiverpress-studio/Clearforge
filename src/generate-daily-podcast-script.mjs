import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";

const ROOT = process.cwd();
const DATE = process.env.CLEARFORGE_DATE || new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(new Date());

const draftDir = path.join(ROOT, "drafts", DATE);
const structuredPath = path.join(draftDir, "structured_output.json");
const podcastDir = path.join(draftDir, "podcast");

if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required for podcast script generation.");
if (!fs.existsSync(structuredPath)) throw new Error(`Missing ${structuredPath}`);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function write(file, content) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, content.endsWith("\n") ? content : `${content}\n`, "utf8");
}

function wordCount(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length;
}

function spokenLineCheck(script) {
  const lines = String(script || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const firstLine = lines[0] || "";
  const finalLine = lines.at(-1) || "";
  const forbiddenPatterns = [
    /^#/,
    /^title\s*:/i,
    /^subtitle\s*:/i,
    /^narrator\s*:/i,
    /^voice\s*id\s*:/i,
    /^open\s*:/i,
    /^close\s*:/i,
    /^chapter\s*\d*/i,
    /^section\s*\d*/i,
    /\[[^\]]+\]/,
    /\([^)]*(pause|music|emphasis|direction|pronunciation|beat|breathe)[^)]*\)/i,
    /https?:\/\//i,
    /Sapiver/i
  ];
  const offenders = [];
  for (const [index, line] of lines.entries()) {
    if (forbiddenPatterns.some((pattern) => pattern.test(line))) offenders.push({ line: index + 1, text: line });
  }
  return { firstLine, finalLine, offenders };
}

const data = JSON.parse(fs.readFileSync(structuredPath, "utf8"));
const stories = data.story_summaries || [];
const sources = data.sources || [];
if (stories.length < 1) throw new Error("Need at least one story summary for podcast script generation.");

const schema = {
  type: "object",
  additionalProperties: false,
  required: [
    "episode_title",
    "selected_story_index",
    "selected_story_title",
    "selection_reason",
    "spoken_script",
    "plain_english_terms",
    "human_review_checks",
    "chapter_timing_plan",
    "production_notes"
  ],
  properties: {
    episode_title: { type: "string" },
    selected_story_index: { type: "integer", minimum: 0, maximum: Math.max(0, stories.length - 1) },
    selected_story_title: { type: "string" },
    selection_reason: { type: "string" },
    spoken_script: { type: "string" },
    plain_english_terms: { type: "array", items: { type: "string" } },
    human_review_checks: { type: "array", minItems: 5, items: { type: "string" } },
    chapter_timing_plan: {
      type: "array",
      minItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["section", "approx_minutes", "purpose"],
        properties: {
          section: { type: "string" },
          approx_minutes: { type: "string" },
          purpose: { type: "string" }
        }
      }
    },
    production_notes: { type: "array", items: { type: "string" } }
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
      content: "You are the Clearforge daily podcast editor. Write practical, careful AI briefing scripts for one permanent narrator. Clearforge is separate from Sapiver Press: never mention Sapiver, Sapiver Press, Sapiver products, Sapiver websites, shops, logos or branding. Do not give medical, legal or financial advice. Do not say AI replaces human accountability. Use only the supplied facts and sources. Distinguish confirmed facts, vendor claims, independent reporting and unknowns."
    },
    {
      role: "user",
      content: `EDITION ID: ${DATE}\nHEADLINE: ${data.headline}\nDEK: ${data.dek}\nPRACTICAL TAKEAWAY: ${data.practical_takeaway}\nWHAT TO TEST NEXT: ${data.what_to_test_next}\n\nSTORIES:\n${JSON.stringify(stories, null, 2)}\n\nSOURCES:\n${JSON.stringify(sources, null, 2)}\n\nTask:\nChoose the single biggest story of this edition and write a detailed daily Clearforge podcast script about it.\n\nTarget length:\n- Approximately 10 minutes spoken.\n- Aim for 1,350 to 1,650 spoken words.\n\nSpoken script requirements:\n- The spoken_script field must contain only the exact words the narrator should speak.\n- No headings, titles, narrator labels, timestamps, bracketed directions, parenthesised production notes, source URLs or markdown.\n- Use punctuation and paragraph breaks for pacing.\n- Narrator voice: calm, intelligent, practical, conversational, professional and non-hyped.\n- Audience: mixed beginner and intermediate AI learners, creators and small businesses.\n- Explain what happened, what the tool or concept is, what changed, why it matters, who should care, a practical example, one useful experiment, risks and human-review checks, and what to watch next.\n- Include a Clearforge-style verdict in natural speech: use now, test carefully, watch, or skip for now.\n- Be careful with claims. Say when information is unknown or access is limited.\n- Do not read the article verbatim. Make it sound like a standalone spoken briefing.\n\nMetadata requirements:\n- selected_story_index is zero-based from the supplied story list.\n- Keep sources and production notes outside the spoken_script field.`
    }
  ],
  text: { format: { type: "json_schema", name: "clearforge_daily_podcast_script", strict: true, schema } }
});

if (!response.output_text) throw new Error("OpenAI returned no podcast script output.");
const podcast = JSON.parse(response.output_text);
const script = String(podcast.spoken_script || "").trim();
const words = wordCount(script);
const lineCheck = spokenLineCheck(script);
const warnings = [];

if (words < 1200) warnings.push(`Script is shorter than target: ${words} words.`);
if (words > 1900) warnings.push(`Script is longer than target: ${words} words.`);
if (lineCheck.offenders.length) warnings.push(`Spoken script contains ${lineCheck.offenders.length} possible non-spoken instruction line(s).`);

ensureDir(podcastDir);
write(path.join(podcastDir, "COPY_PASTE_INTO_ELEVENLABS.txt"), script);
write(path.join(podcastDir, "podcast-script.md"), `# ${podcast.episode_title}\n\nDate: ${DATE}\nNarrator: Irene\nVoice ID: w9xM4Spfmuw28ZXAirWK\nHuman review required: yes\nEstimated duration: ${(words / 145).toFixed(1)} minutes\nWord count: ${words}\nSelected story: ${podcast.selected_story_title}\nSelection reason: ${podcast.selection_reason}\n\n## Spoken script\n\n${script}\n\n## Plain-English terms\n\n${podcast.plain_english_terms.map((item) => `- ${item}`).join("\n")}\n\n## Human-review checks\n\n${podcast.human_review_checks.map((item) => `- [ ] ${item}`).join("\n")}\n\n## Chapter timing plan\n\n${podcast.chapter_timing_plan.map((item) => `- ${item.approx_minutes} — ${item.section}: ${item.purpose}`).join("\n")}\n\n## Production notes\n\n${podcast.production_notes.map((item) => `- ${item}`).join("\n")}\n\n## Validation warnings\n\n${warnings.length ? warnings.map((item) => `- ${item}`).join("\n") : "- None"}\n`);
write(path.join(podcastDir, "source-notes.md"), `# Source notes — ${DATE}\n\nPodcast focused on: ${podcast.selected_story_title}\n\n## Sources supplied to the script generator\n\n${sources.map((source, index) => `- ${index + 1}. ${source.source_name || "Source"}: ${source.title || "Untitled"}\n  - URL: ${source.url || ""}\n  - Published/date field: ${source.published_date || "unknown"}\n  - Confirmed fact: ${source.confirmed_fact || ""}\n  - Interpretation: ${source.interpretation || ""}`).join("\n")}\n`);
write(path.join(podcastDir, "episode-metadata.json"), JSON.stringify({
  version: 1,
  date: DATE,
  brand: "Clearforge",
  type: "clearforge_daily_biggest_story_podcast_script",
  human_review_required: true,
  narrator: "Irene",
  elevenlabs_voice_id: "w9xM4Spfmuw28ZXAirWK",
  episode_title: podcast.episode_title,
  selected_story_index: podcast.selected_story_index,
  selected_story_title: podcast.selected_story_title,
  selection_reason: podcast.selection_reason,
  word_count: words,
  estimated_duration_minutes: Number((words / 145).toFixed(1)),
  copy_paste_file: "COPY_PASTE_INTO_ELEVENLABS.txt",
  source_notes: "source-notes.md",
  first_spoken_line: lineCheck.firstLine,
  final_spoken_line: lineCheck.finalLine,
  validation_warnings: warnings,
  non_spoken_instruction_candidates: lineCheck.offenders
}, null, 2));

console.log(`Generated Clearforge daily podcast script for ${DATE}: ${words} words, ${warnings.length} warning(s).`);
