import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";

const ROOT = process.cwd();
const DATE = process.env.CLEARFORGE_DATE || new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());
const draftDir = path.join(ROOT, "drafts", DATE);
const structuredPath = path.join(draftDir, "structured_output.json");
const outDir = path.join(ROOT, "media", DATE);

if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required.");
if (!fs.existsSync(structuredPath)) throw new Error(`Missing ${structuredPath}`);

const data = JSON.parse(fs.readFileSync(structuredPath, "utf8"));
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
fs.mkdirSync(outDir, { recursive: true });

function visualPrompt(story, index) {
  const styles = [
    "cinematic near-future editorial image, human speaking naturally with a responsive AI voice interface represented by elegant translucent audio forms and contextual panels",
    "cinematic editorial scene of real workplace knowledge becoming organized by AI into structured timelines, summaries and evidence trails, sophisticated modern office, no readable text",
    "cinematic editorial visualization of frontier AI governance and safety, luminous layered control systems, risk thresholds, review gates and human oversight, no readable text"
  ];
  return `${styles[index] || styles[0]}. Story context: ${story.title}. Practical angle: ${story.practical_angle}. Premium technology journalism aesthetic, realistic lighting, dramatic depth, teal and warm gold accents, visually specific, sophisticated, no logos, no brand marks, no typography, no watermarks, portrait composition for a vertical short.`;
}

const stories = (data.story_summaries || []).slice(0, 3);
if (stories.length < 3) throw new Error("Need at least three story summaries for AI media generation.");

const images = [];
for (let i = 0; i < stories.length; i++) {
  const result = await client.images.generate({
    model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
    prompt: visualPrompt(stories[i], i),
    size: "1024x1536",
    quality: process.env.OPENAI_IMAGE_QUALITY || "low"
  });
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new Error(`No image returned for story ${i + 1}`);
  const file = path.join(outDir, `story-${i + 1}.png`);
  fs.writeFileSync(file, Buffer.from(b64, "base64"));
  images.push({
    file: path.relative(ROOT, file).replaceAll("\\", "/"),
    title: stories[i].title,
    source_name: data.sources?.[i]?.source_name || "Source",
    source_url: data.sources?.[i]?.url || "",
    summary: stories[i].summary,
    why_it_matters: stories[i].why_it_matters,
    practical_angle: stories[i].practical_angle
  });
}

const narrationText = data.social?.youtube_shorts_script || [
  `Here are three AI updates that matter today.`,
  ...stories.map((s) => `${s.title}. ${s.why_it_matters}`),
  data.practical_takeaway || "Focus on what changes your workflow, not what creates the most hype."
].join(" ");

const speech = await client.audio.speech.create({
  model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
  voice: process.env.OPENAI_TTS_VOICE || "coral",
  input: narrationText,
  instructions: "Speak like a sharp British technology news presenter. Natural, confident, energetic but not overhyped. Use clear pacing and slight emphasis on the practical takeaway."
});
const narrationFile = path.join(outDir, "narration.mp3");
fs.writeFileSync(narrationFile, Buffer.from(await speech.arrayBuffer()));

const manifest = {
  version: 1,
  date: DATE,
  headline: data.headline,
  dek: data.dek,
  hook: "Three AI updates that actually matter today",
  stories: images,
  narration: path.relative(ROOT, narrationFile).replaceAll("\\", "/"),
  narration_text: narrationText,
  practical_takeaway: data.practical_takeaway,
  what_to_test_next: data.what_to_test_next
};
fs.writeFileSync(path.join(outDir, "media-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`Generated AI media pack for ${DATE}`);
