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

function editionSeed() {
  return [...String(DATE)].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function pick(list, index) {
  return list[(editionSeed() + index) % list.length];
}

function visualPrompt(story, index) {
  const metaphors = [
    "a practical workshop bench where index cards, brass clips, paper tags and small wooden blocks are being arranged into a clear operating system",
    "a quiet teaching-room wall with hand-drawn process diagrams, pinned source cards, string lines and simple review checkpoints",
    "an overhead editorial desk scene with printed source sheets, a pencil, folded notes, transparent overlays and a tidy decision map",
    "a compact print-room planning table with proof sheets, page grids, stamps, folders and a visible before-to-after sorting process",
    "a cartographer-style strategy board with layered paper maps, route markers, labelled tabs without readable words and controlled pathways",
    "a librarian-style research table with archive boxes, evidence slips, colour-coded dividers and a calm human review process",
    "a maker-space scene with modular trays, checklist cards, ruler marks and physical tokens showing a workflow being assembled",
    "a kitchen-table planning scene with notebooks, sticky tabs, filing wallets and simple household-object metaphors for system design",
    "a museum-display style arrangement of everyday objects representing control, judgement, automation, cost and review",
    "a classroom demonstration table with paper levers, sliders, timers and cards showing how a complex system becomes understandable"
  ];

  const compositions = [
    "clean overhead flat-lay composition",
    "three-quarter editorial photograph with shallow depth of field",
    "wide vertical still-life scene with strong foreground object",
    "documentary-style close-up of hands arranging materials, no identifiable face",
    "structured product-photography layout with strong negative space",
    "calm instructional scene with visible layers and hierarchy"
  ];

  const visualDevices = [
    "use one strong physical metaphor rather than a screen interface",
    "include three distinct object clusters so each story frame feels different",
    "show the transition from messy input to ordered output using real materials",
    "use paper, wood, fabric, card, folders and desk objects instead of neon tech graphics",
    "make it look like an editorial magazine photograph, not a SaaS advert",
    "make the scene understandable even without any text"
  ];

  const palette = [
    "warm cream, forest green, dark teal and muted brass accents",
    "cream paper, charcoal ink, deep green and soft gold accents",
    "dark teal background with warm paper objects and restrained brass highlights",
    "soft daylight, cream surfaces, green folders and muted amber shadows"
  ];

  return `${pick(metaphors, index * 3)}. ${pick(compositions, index * 5)}. ${pick(visualDevices, index * 7)}. Story context: ${story.title}. Practical angle: ${story.practical_angle}. Clearforge brand feel: human-led, practical, editorial, calm, precise. Palette: ${pick(palette, index * 11)}. Avoid generic AI imagery: no robots, no glowing brains, no hologram faces, no neon circuit boards, no floating code, no generic laptop dashboard, no stock-photo handshake, no unreadable fake UI, no logos, no brand marks, no typography, no watermarks. Portrait composition for a vertical short, visually specific, coherent with Sapiver Press but clearly Clearforge.`;
}

const stories = (data.story_summaries || []).slice(0, 3);
if (stories.length < 3) throw new Error("Need at least three story summaries for AI media generation.");

const images = [];
for (let i = 0; i < stories.length; i++) {
  const prompt = visualPrompt(stories[i], i);
  const result = await client.images.generate({
    model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
    prompt,
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
    practical_angle: stories[i].practical_angle,
    visual_prompt: prompt
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
  version: 2,
  date: DATE,
  headline: data.headline,
  dek: data.dek,
  hook: "Three AI updates that actually matter today",
  visual_system: "Clearforge physical editorial metaphor set",
  stories: images,
  narration: path.relative(ROOT, narrationFile).replaceAll("\\", "/"),
  narration_text: narrationText,
  practical_takeaway: data.practical_takeaway,
  what_to_test_next: data.what_to_test_next
};
fs.writeFileSync(path.join(outDir, "media-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`Generated AI media pack for ${DATE}`);
