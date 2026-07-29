const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";

function apiKey() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is required.");
  return key;
}

class GeminiRequestError extends Error {
  constructor(model, status, detail) {
    super(`Gemini ${model} request failed (${status}): ${detail.slice(0, 1200)}`);
    this.model = model;
    this.status = status;
  }
}

async function callGemini(model, body) {
  const response = await fetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey()
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new GeminiRequestError(model, response.status, detail);
  }
  return response.json();
}

async function callInteractions(model, body) {
  const response = await fetch(INTERACTIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey(),
      "Api-Revision": "2026-05-20"
    },
    body: JSON.stringify({ model, ...body })
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new GeminiRequestError(model, response.status, detail);
  }
  return response.json();
}

async function withModelFallback(primary, fallbacks, request) {
  const models = [...new Set([primary, ...fallbacks].filter(Boolean))];
  let lastError;
  for (const model of models) {
    try {
      return await request(model);
    } catch (error) {
      lastError = error;
      if (!(error instanceof GeminiRequestError) || error.status !== 404) throw error;
      console.warn(`Gemini model ${model} is unavailable; trying the next supported model.`);
    }
  }
  throw lastError;
}

function parts(result) {
  return result?.candidates?.[0]?.content?.parts || [];
}

export async function generateStructured({ system, prompt, schema, model = process.env.GEMINI_TEXT_MODEL || "gemini-3.1-flash-lite" }) {
  const result = await withModelFallback(model, ["gemini-3.1-flash-lite", "gemini-3.6-flash"], (selectedModel) => callGemini(selectedModel, {
    systemInstruction: { parts: [{ text: Array.isArray(system) ? system.join("\n\n") : system }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseJsonSchema: schema,
      temperature: 0.2
    }
  }));
  const text = parts(result).map((part) => part.text || "").join("").trim();
  if (!text) throw new Error(`Gemini ${model} returned no structured text.`);
  return JSON.parse(text);
}

export async function generateGroundedEvidence({ system, prompt, model = process.env.GEMINI_RESEARCH_MODEL || "gemini-3.6-flash" }) {
  const result = await withModelFallback(model, ["gemini-3.6-flash", "gemini-3.1-flash-lite"], (selectedModel) => callGemini(selectedModel, {
    systemInstruction: { parts: [{ text: Array.isArray(system) ? system.join("\n\n") : system }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
    generationConfig: { temperature: 0.1 }
  }));
  const text = parts(result).map((part) => part.text || "").join("").trim();
  if (!text) throw new Error(`Gemini ${model} returned no grounded evidence.`);
  return {
    text,
    groundingMetadata: result?.candidates?.[0]?.groundingMetadata || null
  };
}

export async function generateText({ system, prompt, model = process.env.GEMINI_TEXT_MODEL || "gemini-3.1-flash-lite" }) {
  const result = await withModelFallback(model, ["gemini-3.1-flash-lite", "gemini-3.6-flash"], (selectedModel) => callGemini(selectedModel, {
    systemInstruction: { parts: [{ text: Array.isArray(system) ? system.join("\n\n") : system }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2 }
  }));
  const text = parts(result).map((part) => part.text || "").join("").trim();
  if (!text) throw new Error(`Gemini ${model} returned no text.`);
  return text;
}

export async function generateImage(prompt, model = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image") {
  const result = await withModelFallback(model, ["gemini-3.1-flash-image", "gemini-3.1-flash-lite-image"], (selectedModel) => callInteractions(selectedModel, {
    input: prompt,
    response_format: { type: "image", mime_type: "image/jpeg", aspect_ratio: "2:3", image_size: "1K" }
  }));
  const image = result.output_image || result.outputImage ||
    result.outputs?.find((item) => item.type === "image") ||
    result.output?.find?.((item) => item.type === "image");
  if (!image?.data) throw new Error(`Gemini ${model} returned no image.`);
  return { data: image.data, mimeType: image.mime_type || image.mimeType || "image/jpeg" };
}

function wavHeader(pcmLength, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * channels * bitsPerSample / 8;
  const blockAlign = channels * bitsPerSample / 8;
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcmLength, 4);
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
  header.writeUInt32LE(pcmLength, 40);
  return header;
}

export async function generateSpeechWav(text, {
  model = process.env.GEMINI_TTS_MODEL || "gemini-3.1-flash-tts-preview",
  voice = process.env.GEMINI_TTS_VOICE || "Kore",
  style = "Speak clearly, naturally and conversationally."
} = {}) {
  const result = await withModelFallback(model, ["gemini-3.1-flash-tts-preview", "gemini-2.5-flash-preview-tts"], async (selectedModel) => {
    const request = {
      input: `${style}\n\nSPOKEN TRANSCRIPT:\n${text}`,
      response_format: { type: "audio" },
      generation_config: { speech_config: [{ voice }] }
    };
    let lastResult;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        lastResult = await callInteractions(selectedModel, request);
        const audio = lastResult.output_audio || lastResult.outputAudio ||
          lastResult.outputs?.find((item) => item.type === "audio") ||
          lastResult.output?.find?.((item) => item.type === "audio");
        if (audio?.data || attempt === 2) return lastResult;
        console.warn(`Gemini ${selectedModel} returned no audio; retrying once.`);
      } catch (error) {
        const transient = error instanceof GeminiRequestError && error.status >= 500;
        if (!transient || attempt === 2) throw error;
        console.warn(`Gemini ${selectedModel} TTS request failed transiently; retrying once.`);
      }
    }
    return lastResult;
  });
  const audio = result.output_audio || result.outputAudio ||
    result.outputs?.find((item) => item.type === "audio") ||
    result.output?.find?.((item) => item.type === "audio");
  if (!audio?.data) throw new Error(`Gemini ${model} returned no audio.`);
  const bytes = Buffer.from(audio.data, "base64");
  if ((audio.mime_type || audio.mimeType || "").includes("wav") || bytes.subarray(0, 4).toString() === "RIFF") return bytes;
  return Buffer.concat([wavHeader(bytes.length), bytes]);
}
