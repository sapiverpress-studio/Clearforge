import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { generateSpeechWav } from "../src/gemini-provider.mjs";

const inputPath = process.env.INPUT_PATH;
const outputPath = process.env.OUTPUT_PATH;
const model = process.env.GEMINI_TTS_MODEL || "gemini-3.1-flash-tts-preview";
const voice = process.env.GEMINI_TTS_VOICE || "Kore";
const maxChunkCharacters = Number(process.env.MAX_CHUNK_CHARACTERS || 1600);

if (!inputPath || !outputPath) throw new Error("INPUT_PATH and OUTPUT_PATH are required.");
if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required.");
if (!fs.existsSync(inputPath)) throw new Error(`Approved narration file not found: ${inputPath}`);

const text = fs.readFileSync(inputPath, "utf8").trim();
if (!text) throw new Error("Approved narration file is empty.");
if (/https?:\/\//i.test(text)) throw new Error("Narration contains a raw URL.");
if (/^\s*(TITLE|SUBTITLE|EPISODE|CHAPTER|OPEN|CLOSE|PAUSE|NARRATOR|VOICE ID|SOURCE|PRODUCTION|PRONUNCIATION|FORMAT|DELIVERY|FINAL QA)\b/im.test(text)) {
  throw new Error("Narration contains a non-spoken production label.");
}
if (/\[[^\]]+\]/.test(text)) throw new Error("Narration contains bracketed stage directions.");

function splitNarration(value, limit) {
  const paragraphs = value.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  const chunks = [];
  let current = "";
  for (const paragraph of paragraphs) {
    const sentences = paragraph.match(/[^.!?]+[.!?]+(?:["']|\s|$)|[^.!?]+$/g) || [paragraph];
    for (const rawSentence of sentences) {
      const sentence = rawSentence.trim();
      if (!sentence) continue;
      if (current && current.length + sentence.length + 1 > limit) {
        chunks.push(current);
        current = "";
      }
      if (sentence.length > limit) throw new Error("A narration sentence exceeds the safe Gemini chunk size.");
      current += `${current ? " " : ""}${sentence}`;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function createWav(pcm, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * channels * bitsPerSample / 8;
  const blockAlign = channels * bitsPerSample / 8;
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

const chunks = splitNarration(text, maxChunkCharacters);
if (!chunks.length) throw new Error("No narration chunks were produced.");

const pcmParts = [];
for (let index = 0; index < chunks.length; index += 1) {
  const prompt = [
    "Synthesize speech for the exact transcript below.",
    "Use a calm, intelligent British podcast delivery in plain English.",
    "Sound practical and measured, never theatrical, sales-heavy or breathless.",
    "Do not read these directions aloud. Do not add, remove, paraphrase or repeat words.",
    "SPOKEN TRANSCRIPT:",
    chunks[index]
  ].join("\n");

  const audio = await generateSpeechWav(chunks[index], {
    model,
    voice,
    style: prompt.slice(0, prompt.lastIndexOf("SPOKEN TRANSCRIPT:"))
  });
  if (audio.length < 1000) throw new Error(`Gemini TTS chunk ${index + 1} returned unexpectedly small audio.`);

  if (audio.subarray(0, 4).toString() === "RIFF") {
    pcmParts.push(audio.subarray(44));
  } else {
    pcmParts.push(audio);
  }
  console.log(`Generated Gemini voice-test chunk ${index + 1}/${chunks.length}.`);
}

const pcm = Buffer.concat(pcmParts);
const wav = createWav(pcm);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, wav);

const metadata = {
  source: inputPath,
  sourceSha256: crypto.createHash("sha256").update(text, "utf8").digest("hex"),
  model,
  voice,
  chunks: chunks.length,
  characters: text.length,
  generatedAt: new Date().toISOString(),
  status: "VOICE TEST ONLY — NOT APPROVED FOR PUBLICATION"
};
fs.writeFileSync(`${outputPath}.json`, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
console.log(`Saved non-publishing Gemini voice test to ${outputPath}.`);
