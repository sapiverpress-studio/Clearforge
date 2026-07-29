import assert from "node:assert/strict";
const { generateImage, generateSpeechWav, generateStructured } =
  await import(process.env.GEMINI_PROVIDER_MODULE || "../src/gemini-provider.mjs");

process.env.GEMINI_API_KEY = "test-key";

const calls = [];
let audioAttempts = 0;
global.fetch = async (url, options) => {
  const body = JSON.parse(options.body);
  calls.push({ url: String(url), body });

  if (calls.length === 1) {
    return new Response(JSON.stringify({ error: { message: "retired" } }), { status: 404 });
  }
  if (String(url).includes(":generateContent")) {
    return Response.json({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ ok: true }) }] } }]
    });
  }
  if (body.response_format?.type === "image") {
    return Response.json({ output_image: { type: "image", mime_type: "image/jpeg", data: Buffer.from("image").toString("base64") } });
  }
  if (body.response_format?.type === "audio") {
    audioAttempts += 1;
    if (audioAttempts === 1) return Response.json({ output_text: "No audio generated." });
    return Response.json({ output_audio: { type: "audio", mime_type: "audio/L16;rate=24000", data: Buffer.alloc(1200, 1).toString("base64") } });
  }
  return new Response("unexpected request", { status: 500 });
};

const structured = await generateStructured({
  system: "test",
  prompt: "test",
  model: "retired-model",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["ok"],
    properties: { ok: { type: "boolean" } }
  }
});
assert.deepEqual(structured, { ok: true });
assert.match(calls[1].url, /gemini-3\.1-flash-lite/);

const image = await generateImage("test image");
assert.equal(Buffer.from(image.data, "base64").toString(), "image");
assert.equal(calls.at(-1).body.model, "gemini-3.1-flash-image");
assert.equal(calls.at(-1).body.response_format.aspect_ratio, "2:3");
assert.equal(calls.at(-1).body.response_format.mime_type, "image/jpeg");

const audio = await generateSpeechWav("test audio");
assert.equal(audio.subarray(0, 4).toString(), "RIFF");
assert.equal(calls.at(-1).body.model, "gemini-3.1-flash-tts-preview");
assert.equal(calls.at(-1).body.generation_config.speech_config[0].voice, "Kore");
assert.match(calls.at(-1).body.input, /SPOKEN TRANSCRIPT:\ntest audio/);
assert.equal(audioAttempts, 2);

console.log("Gemini provider contract tests passed.");
