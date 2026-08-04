import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import OpenAI from "./gemini-openai-compat.mjs";
import { campaignIsActive, writeCampaignRecord } from "./commercial-campaign.mjs";

const ROOT = process.cwd();
const DATE = process.env.SAPIVER_FORGE_DATE || process.env.SAPIVER_FORGE_DATE || new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());
const draftDir = path.join(ROOT, "drafts", DATE);
const structuredPath = path.join(draftDir, "structured_output.json");
const outDir = path.join(ROOT, "media", DATE);
const campaignActive = campaignIsActive(DATE);

if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required.");
if (!process.env.ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY is required for Irene social narration.");
if (!fs.existsSync(structuredPath)) throw new Error(`Missing ${structuredPath}`);

const data = JSON.parse(fs.readFileSync(structuredPath, "utf8"));
const client = new OpenAI();
fs.mkdirSync(outDir, { recursive: true });

const spokenCta = "Before you send AI-assisted work to a client, use the Sapiver Forge AI Output Release Gate through the link in our bio.";
const IRENE_VOICE_ID = "w9xM4Spfmuw28ZXAirWK";
const elevenLabsVoiceId = process.env.ELEVENLABS_VOICE_ID || IRENE_VOICE_ID;
const elevenLabsModelId = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";

if (elevenLabsVoiceId !== IRENE_VOICE_ID) {
  throw new Error("Voice substitution blocked: Sapiver Forge social narration must use Irene.");
}

async function createIreneSpeech(text, target) {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${IRENE_VOICE_ID}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg"
      },
      body: JSON.stringify({
        text,
        model_id: elevenLabsModelId,
        apply_text_normalization: "auto"
      })
    }
  );
  if (!response.ok) {
    const message = (await response.text()).slice(0, 1200);
    throw new Error(`Irene narration failed with ${response.status}: ${message}`);
  }
  const audio = Buffer.from(await response.arrayBuffer());
  const looksLikeMp3 = audio.subarray(0, 3).toString("ascii") === "ID3"
    || (audio[0] === 0xff && (audio[1] & 0xe0) === 0xe0);
  if (audio.length < 1000 || !looksLikeMp3) {
    throw new Error("Irene narration did not return a valid MP3.");
  }
  fs.writeFileSync(target, audio);
}

function probeDuration(file) {
  const result = spawnSync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=nw=1:nk=1",
    file
  ], { encoding: "utf8" });
  const duration = Number(String(result.stdout || "").trim());
  if (result.status !== 0 || !Number.isFinite(duration) || duration <= 0) {
    throw new Error(`FFprobe could not determine the duration of ${file}`);
  }
  return duration;
}

function editionSeed() {
  return [...String(DATE)].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function pick(list, index) {
  return list[(editionSeed() + index) % list.length];
}

function visualPrompt(story, index) {
  if (campaignActive) {
    return `A realistic vertical editorial photograph of a freelancer at a calm desk reviewing the exact AI-assisted client deliverable before sending it. Show one clearly identified final file, printed source notes, a human review checklist, recipient and destination checks, and restrained privacy and rights reminder symbols. Story context: ${story.title}. Practical release problem: ${story.practical_angle}. Sapiver Forge feel: human-led, precise, useful, calm and professional. Deep navy, clean white, cool blue and soft mint palette. Leave clean space for later text overlay. Do not render readable text, logos or watermarks. Avoid robots, glowing brains, generic dashboards, cyberpunk imagery, random code, approval guarantees or autonomous-system imagery. Portrait composition for a short-form video, realistic materials and coherent perspective.`;
  }
  const aiBriefingScenes = [
    "a dark navy AI briefing studio desk with a professional podcast microphone, source notes, a small audio waveform display, subtle circuit-board lines in the background and one practical notebook open on the desk",
    "an editorial AI news analysis desk with printed source cards, model comparison sheets, a compact microphone arm, blue data-light accents and a calm control-room atmosphere",
    "a practical creator workflow table showing verified source notes, timeline cards, a muted blue AI signal pattern, a microphone, headphones and a structured review checklist",
    "a high-end technology briefing set with a dark blue wall, subtle circuit traces, a clean desk, paper research packs, audio waveforms and one human-operated control surface",
    "a weekly AI briefing workspace with layered research cards, calendar markers, a studio microphone, restrained blue interface glow and visible human review materials",
    "a podcast-ready AI learning desk with a microphone in the foreground, tidy source folders, simple model cards, a soft waveform motif and a dark professional newsroom mood",
    "a practical AI systems review scene with a microphone, pinned evidence cards, process arrows, muted blue signal lines and a clear before-to-after analysis structure",
    "a modern audio briefing desk where AI developments are represented by physical cards, circuit-like connection lines, a restrained waveform panel and careful human notes"
  ];

  const compositions = [
    "premium podcast-cover composition with strong negative space for later text overlay",
    "cinematic three-quarter studio photograph with shallow depth of field",
    "vertical social-video still with a strong microphone foreground and clear desk detail",
    "clean editorial technology-magazine composition, practical rather than sci-fi",
    "wide briefing-room still life cropped for vertical short-form video",
    "dark professional podcast artwork composition with source materials visible"
  ];

  const aiSignals = [
    "make the AI element clear through subtle circuit traces, waveform graphics, model cards and data-routing lines, not robots",
    "show AI as a system being reviewed by a person through notes, checks, source cards and controlled audio tools",
    "use restrained blue technology accents to signal AI without making the image look like generic AI stock art",
    "combine physical human-review materials with light digital signal motifs so it feels human-led and AI-empowered",
    "make it instantly understandable as an AI briefing or AI podcast image, but grounded in real studio objects"
  ];

  const variationDevices = [
    "change the hero object placement so this frame does not resemble the previous edition",
    "include a different arrangement of source cards, notebook, microphone angle and background signal pattern",
    "vary camera distance, desk depth and object hierarchy while keeping the same Sapiver Forge identity",
    "use a different AI signal motif: waveform, routing lines, model cards, calendar markers or evidence board",
    "make the story context visible through objects and composition rather than readable text"
  ];

  const palette = [
    "deep navy, near-black blue, clean white, cool electric blue and soft mint accents",
    "dark blue studio background, graphite desk, white paper, blue highlights and restrained green accents",
    "midnight navy, charcoal, soft white, clear blue and muted brass details",
    "professional dark newsroom blue with pale paper, steel microphone tones and subtle cyan signal light"
  ];

  return `${pick(aiBriefingScenes, index * 3)}. ${pick(compositions, index * 5)}. ${pick(aiSignals, index * 7)}. ${pick(variationDevices, index * 11)}. Story context: ${story.title}. Practical angle: ${story.practical_angle}. Sapiver Forge brand feel: AI briefing podcast, human-led, practical, educational, precise, calm, professional, premium, not hyped. Palette: ${pick(palette, index * 13)}. The image must clearly belong to an AI news and learning project, but it must not look like a generic AI-generated stock image. Avoid: robots, android faces, glowing brains, hologram faces, random floating code, excessive neon, cyberpunk cityscapes, stock-photo handshakes, fake readable UI text, fake logos, misspelled words, watermarks, cluttered dashboards, medical/legal/financial symbolism. Do not include Sapiver Press, unrelated logos, or any other brand. Do not render readable typography; leave clean space for the video renderer to add text. Portrait composition for a vertical short. High-quality studio lighting, crisp objects, realistic materials, coherent perspective.`;
}

const tiktokNarrationText = String(data.social?.tiktok_script || "").replace(/\s+/g, " ").trim();
const overlapScore = (left, right) => {
  const tokens = (value) => new Set(String(value || "").toLowerCase().match(/[a-z0-9]{3,}/g) || []);
  const a = tokens(left);
  const b = tokens(right);
  return a.size ? [...a].filter((token) => b.has(token)).length / a.size : 0;
};
const allStories = data.story_summaries || [];
const matchedTikTokStoryIndex = allStories
  .map((story, index) => ({ index, score: overlapScore(tiktokNarrationText, `${story.title || ""} ${story.summary || ""}`) }))
  .sort((a, b) => b.score - a.score)[0]?.index || 0;
const stories = campaignActive ? [allStories[matchedTikTokStoryIndex]].filter(Boolean) : allStories.slice(0, 3);
if (stories.length < (campaignActive ? 1 : 3)) throw new Error(`Need at least ${campaignActive ? 1 : 3} story summaries for AI media generation.`);

const images = [];
for (let i = 0; i < stories.length; i++) {
  const prompt = visualPrompt(stories[i], i);
  const result = await client.images.generate({
    model: process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image",
    prompt,
    size: "1024x1536",
    quality: "standard"
  });
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new Error(`No image returned for story ${i + 1}`);
  const jpegFile = path.join(outDir, `story-${i + 1}.jpg`);
  const file = path.join(outDir, `story-${i + 1}.png`);
  fs.writeFileSync(jpegFile, Buffer.from(b64, "base64"));
  const convertedImage = spawnSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", jpegFile,
    "-frames:v", "1",
    file
  ], { stdio: "inherit" });
  fs.unlinkSync(jpegFile);
  if (convertedImage.status !== 0 || !fs.existsSync(file)) {
    throw new Error(`FFmpeg could not convert Gemini JPEG for story ${i + 1}`);
  }
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

const baseNarration = data.social?.youtube_shorts_script || [
  "Here are three AI updates that matter today.",
  ...stories.map((s) => `${s.title}. ${s.why_it_matters}`),
  data.practical_takeaway || "Focus on what changes your workflow, not what creates the most hype."
].join(" ");
const narrationText = `${String(baseNarration).trim()} ${spokenCta}`;

const narrationFile = path.join(outDir, "narration.mp3");
if (!campaignActive) await createIreneSpeech(narrationText, narrationFile);

const tiktokSelection = data.audience_fit?.platform_selections?.tiktok || {};
const tiktokStoryIndex = campaignActive ? 0 : Number.isInteger(tiktokSelection.story_index) && tiktokSelection.story_index >= 0 && tiktokSelection.story_index < stories.length
  ? tiktokSelection.story_index
  : 0;
const tiktokWords = tiktokNarrationText.split(/\s+/).filter(Boolean);
const tiktokSentences = tiktokNarrationText.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((part) => part.trim()).filter(Boolean) || [];
if (!tiktokNarrationText) {
  throw new Error("TikTok script is required.");
}
if (tiktokWords.length < 18 || tiktokWords.length > 60) {
  console.warn(`TikTok script is outside the preferred 18–60-word range (${tiktokWords.length} words). The video will match the rendered narration instead of discarding the media pack.`);
}
if (/three ai updates|today in ai|latest ai news|sapiver forge/i.test(tiktokSentences[0] || "")) {
  throw new Error("TikTok opening repeats the failed generic briefing format.");
}
const tiktokHook = tiktokSentences[0];
const tiktokResponsePrompt = String(data.social?.tiktok_caption_prompt || "Where would this make the biggest difference for you?").trim();
const tiktokPayoff = tiktokSentences.slice(1).join(" ") || stories[tiktokStoryIndex].practical_angle;

const tiktokNarrationFile = path.join(outDir, "tiktok-narration.mp3");
await createIreneSpeech(tiktokNarrationText, tiktokNarrationFile);
const tiktokNarrationDuration = probeDuration(tiktokNarrationFile);

const manifest = {
  version: 5,
  date: DATE,
  headline: data.headline,
  dek: data.dek,
  hook: tiktokHook,
  spoken_cta: spokenCta,
  visual_system: "Sapiver Forge AI briefing podcast studio system",
  social_voice: {
    name: "Irene",
    provider: "ElevenLabs",
    voice_id: IRENE_VOICE_ID,
    model: elevenLabsModelId
  },
  visual_style_rules: {
    include: [
      "dark navy AI briefing or podcast studio atmosphere",
      "microphone or audio-briefing cues where appropriate",
      "subtle circuit traces, waveform motifs, model cards or data-routing lines",
      "physical source notes, checklists and human-review materials",
      "premium editorial technology-magazine lighting"
    ],
    avoid: [
      "robots",
      "glowing brains",
      "hologram faces",
      "generic dashboards",
      "random floating code",
      "excessive neon",
      "fake readable text",
      "Sapiver Press or unrelated branding"
    ]
  },
  stories: images,
  narration: path.relative(ROOT, campaignActive ? tiktokNarrationFile : narrationFile).replaceAll("\\", "/"),
  narration_text: campaignActive ? tiktokNarrationText : narrationText,
  tiktok: {
    story_index: tiktokStoryIndex,
    hook: tiktokHook,
    payoff: tiktokPayoff,
    response_prompt: tiktokResponsePrompt,
    narration: path.relative(ROOT, tiktokNarrationFile).replaceAll("\\", "/"),
    narration_text: tiktokNarrationText,
    narration_duration_seconds: Number(tiktokNarrationDuration.toFixed(3)),
    target_duration_seconds: Number((tiktokNarrationDuration + 0.35).toFixed(3)),
    format: "single_discovery_micro_explainer"
  },
  practical_takeaway: data.practical_takeaway,
  what_to_test_next: data.what_to_test_next
};
fs.writeFileSync(path.join(outDir, "media-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
if (campaignActive) writeCampaignRecord(draftDir, { media: { vertical_images: images.length, tiktok_narration: true, general_social_narration: false }, api_activity_media: { gemini_image_calls: images.length, elevenlabs_calls: 1 } });
console.log(`Generated AI media pack for ${DATE} with link-free Sapiver Forge CTA`);
