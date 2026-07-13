import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const inputPath = process.env.INPUT_PATH;
const outputPath = process.env.OUTPUT_PATH;
const apiKey = process.env.ELEVENLABS_API_KEY;
const voiceId = process.env.ELEVENLABS_VOICE_ID || "w9xM4Spfmuw28ZXAirWK";
const modelId = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";
const maxChunkCharacters = Number(process.env.MAX_CHUNK_CHARACTERS || 9000);

if (!inputPath || !outputPath) {
  throw new Error("INPUT_PATH and OUTPUT_PATH are required.");
}
if (!apiKey) {
  throw new Error("No ElevenLabs API key was provided.");
}
if (voiceId !== "w9xM4Spfmuw28ZXAirWK") {
  throw new Error("Voice substitution blocked: Clearforge must use Irene.");
}
if (!fs.existsSync(inputPath)) {
  throw new Error(`Narration file not found: ${inputPath}`);
}

const text = fs.readFileSync(inputPath, "utf8").trim();
if (!text) {
  throw new Error("Narration file is empty.");
}
if (/https?:\/\//i.test(text)) {
  throw new Error("Narration contains a raw URL. Clean the ElevenLabs copy-paste file first.");
}
if (/^\s*(TITLE|SUBTITLE|EPISODE|CHAPTER|OPEN|CLOSE|PAUSE|NARRATOR|VOICE ID|SOURCE|PRODUCTION|PRONUNCIATION|FORMAT|DELIVERY|FINAL QA)\b/im.test(text)) {
  throw new Error("Narration contains a non-spoken production label.");
}
if (/\[[^\]]+\]/.test(text)) {
  throw new Error("Narration contains bracketed stage directions.");
}

const inputHash = crypto.createHash("sha256").update(text, "utf8").digest("hex");
const hashPath = `${outputPath}.source-sha256`;
if (fs.existsSync(outputPath) && fs.existsSync(hashPath)) {
  const previousHash = fs.readFileSync(hashPath, "utf8").trim();
  if (previousHash === inputHash) {
    console.log(`MP3 is already current for ${inputPath}; no ElevenLabs credits used.`);
    process.exit(0);
  }
}

function splitNarration(value, limit) {
  const paragraphs = value.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  const chunks = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (paragraph.length > limit) {
      const sentences = paragraph.match(/[^.!?]+[.!?]+(?:["']|\s|$)|[^.!?]+$/g) || [paragraph];
      for (const sentenceValue of sentences) {
        const sentence = sentenceValue.trim();
        if (!sentence) continue;
        if (current && current.length + sentence.length + 1 > limit) {
          chunks.push(current.trim());
          current = "";
        }
        if (sentence.length > limit) {
          for (let index = 0; index < sentence.length; index += limit) {
            if (current) {
              chunks.push(current.trim());
              current = "";
            }
            chunks.push(sentence.slice(index, index + limit).trim());
          }
        } else {
          current += (current ? " " : "") + sentence;
        }
      }
      continue;
    }

    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length > limit) {
      chunks.push(current.trim());
      current = paragraph;
    } else {
      current = candidate;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

const chunks = splitNarration(text, maxChunkCharacters);
if (!chunks.length) throw new Error("No narration chunks were produced.");

const audioParts = [];
for (let index = 0; index < chunks.length; index += 1) {
  const body = {
    text: chunks[index],
    model_id: modelId,
    previous_text: index > 0 ? chunks[index - 1].slice(-1000) : undefined,
    next_text: index < chunks.length - 1 ? chunks[index + 1].slice(0, 1000) : undefined,
    apply_text_normalization: "auto"
  };

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg"
      },
      body: JSON.stringify(body)
    }
  );

  if (!response.ok) {
    const message = (await response.text()).slice(0, 1200);
    throw new Error(`ElevenLabs request ${index + 1}/${chunks.length} failed with ${response.status}: ${message}`);
  }

  const part = Buffer.from(await response.arrayBuffer());
  if (part.length < 1000) {
    throw new Error(`ElevenLabs returned an unexpectedly small audio part for chunk ${index + 1}.`);
  }
  audioParts.push(part);
  console.log(`Generated chunk ${index + 1}/${chunks.length}.`);
}

const audio = Buffer.concat(audioParts);
const looksLikeMp3 =
  audio.subarray(0, 3).toString("ascii") === "ID3" ||
  (audio[0] === 0xff && (audio[1] & 0xe0) === 0xe0);
if (!looksLikeMp3) {
  throw new Error("Generated output did not pass the MP3 header check.");
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, audio);
fs.writeFileSync(hashPath, `${inputHash}\n`, "utf8");
console.log(`Saved ${outputPath} (${audio.length} bytes) using Irene, ${voiceId}.`);
