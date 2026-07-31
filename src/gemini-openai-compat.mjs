import fs from "node:fs";
import path from "node:path";
import { generateGroundedEvidence, generateImage, generateSpeechWav, generateStructured } from "./gemini-provider.mjs";

const ROOT = process.cwd();
const FALLBACK_ART_BASE64_PATH = process.env.CLEARFORGE_FALLBACK_ART_BASE64_PATH
  ? path.resolve(ROOT, process.env.CLEARFORGE_FALLBACK_ART_BASE64_PATH)
  : path.join(ROOT, "assets", "clearforge-fallback-art.jpg.base64");

function fallbackArtworkBase64() {
  if (!fs.existsSync(FALLBACK_ART_BASE64_PATH)) {
    throw new Error(`Gemini image generation failed and fallback artwork is missing at ${FALLBACK_ART_BASE64_PATH}`);
  }
  const data = fs.readFileSync(FALLBACK_ART_BASE64_PATH, "utf8").replace(/\s+/g, "").trim();
  if (!data) throw new Error(`Fallback artwork is empty at ${FALLBACK_ART_BASE64_PATH}`);
  return data;
}

function splitInput(input = []) {
  const system = input.filter((item) => item.role === "system").map((item) => item.content);
  const prompt = input.filter((item) => item.role !== "system").map((item) => item.content).join("\n\n");
  return { system, prompt };
}

export default class GeminiClient {
  constructor() {
    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required.");
    let groundedEvidence = null;
    this.responses = {
      create: async (request) => {
        const { system, prompt } = splitInput(request.input);
        const schema = request.text?.format?.schema;
        if (!schema) throw new Error("A JSON response schema is required.");
        let groundedPrompt = prompt;
        if (request.tools?.length) {
          if (!groundedEvidence) {
            groundedEvidence = await generateGroundedEvidence({
              system,
              prompt: `${prompt}\n\nReturn a broad evidence dossier with more viable candidates than the final edition needs. Include publication dates, availability qualifications, exact survey wording, original source URLs, and a clear separation of verified facts, vendor claims and interpretation.`,
              model: process.env.GEMINI_RESEARCH_MODEL || "gemini-3.6-flash"
            });
          }
          groundedPrompt = `${prompt}\n\nGEMINI GOOGLE-SEARCH EVIDENCE DOSSIER:\n${groundedEvidence.text}\n\nUse only claims supported by this dossier. Preserve material qualifications. If a prior selection failed, choose different candidates from the dossier rather than performing another paid search.`;
        }
        const result = await generateStructured({
          system,
          prompt: groundedPrompt,
          schema,
          model: process.env.GEMINI_TEXT_MODEL || "gemini-3.1-flash-lite"
        });
        return { output_text: JSON.stringify(result) };
      }
    };
    this.images = {
      generate: async ({ prompt }) => {
        try {
          const image = await generateImage(prompt);
          return { data: [{ b64_json: image.data, artwork_source: "gemini" }] };
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          console.warn(`Gemini image generation failed; using Sapiver Forge fallback artwork. ${reason}`);
          return {
            data: [{
              b64_json: fallbackArtworkBase64(),
              artwork_source: "fallback",
              fallback_reason: reason
            }]
          };
        }
      }
    };
    this.audio = {
      speech: {
        create: async ({ input, instructions }) => {
          const wav = await generateSpeechWav(input, { style: instructions });
          return { arrayBuffer: async () => wav.buffer.slice(wav.byteOffset, wav.byteOffset + wav.byteLength) };
        }
      }
    };
  }
}
