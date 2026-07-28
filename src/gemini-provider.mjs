const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function apiKey() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is required.");
  return key;
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
    throw new Error(`Gemini ${model} request failed (${response.status}): ${detail.slice(0, 1200)}`);
  }
  return response.json();
}

function parts(result) {
  return result?.candidates?.[0]?.content?.parts || [];
}

export async function generateStructured({ system, prompt, schema, model = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash" }) {
  const result = await callGemini(model, {
    systemInstruction: { parts: [{ text: Array.isArray(system) ? system.join("\n\n") : system }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseJsonSchema: schema,
      temperature: 0.2
    }
  });
  const text = parts(result).map((part) => part.text || "").join("").trim();
  if (!text) throw new Error(`Gemini ${model} returned no structured text.`);
  return JSON.parse(text);
}

export async function generateGroundedEvidence({ system, prompt, model = process.env.GEMINI_RESEARCH_MODEL || "gemini-2.5-flash" }) {
  const result = await callGemini(model, {
    systemInstruction: { parts: [{ text: Array.isArray(system) ? system.join("\n\n") : system }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    tools: [{ googleSearch: {} }],
    generationConfig: { temperature: 0.1 }
  });
  const text = parts(result).map((part) => part.text || "").join("").trim();
  if (!text) throw new Error(`Gemini ${model} returned no grounded evidence.`);
  return {
    text,
    groundingMetadata: result?.candidates?.[0]?.groundingMetadata || null
  };
}

export async function generateImage(prompt, model = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image") {
  const result = await callGemini(model, {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ["TEXT", "IMAGE"] }
  });
  const image = parts(result).find((part) => part.inlineData?.data);
  if (!image) throw new Error(`Gemini ${model} returned no image.`);
  return { data: image.inlineData.data, mimeType: image.inlineData.mimeType || "image/png" };
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
  model = process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts",
  voice = process.env.GEMINI_TTS_VOICE || "Kore",
  style = "Speak clearly, naturally and conversationally."
} = {}) {
  const result = await callGemini(model, {
    contents: [{ role: "user", parts: [{ text: `${style}\n\n${text}` }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } }
    }
  });
  const audio = parts(result).find((part) => part.inlineData?.data);
  if (!audio) throw new Error(`Gemini ${model} returned no audio.`);
  const bytes = Buffer.from(audio.inlineData.data, "base64");
  if ((audio.inlineData.mimeType || "").includes("wav") || bytes.subarray(0, 4).toString() === "RIFF") return bytes;
  return Buffer.concat([wavHeader(bytes.length), bytes]);
}
