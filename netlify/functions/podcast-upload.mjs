import { getStore } from "@netlify/blobs";

const MAX_AUDIO_BYTES = 5_500_000;
const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

function authorised(request) {
  const password = Netlify.env.get("VIDEO_UPLOAD_PASSWORD");
  return Boolean(password) && request.headers.get("authorization") === `Bearer ${password}`;
}

export default async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (!authorised(request)) return json({ error: "Incorrect publisher password." }, 401);

  const type = String(request.headers.get("content-type") || "");
  if (!/^audio\/(?:mpeg|mp3)(?:;|$)/i.test(type)) return json({ error: "Only MP3 audio files are accepted." }, 415);

  const declared = Number(request.headers.get("content-length") || 0);
  if (!Number.isSafeInteger(declared) || declared < 1 || declared > MAX_AUDIO_BYTES) {
    return json({ error: "Choose an MP3 smaller than 5.5 MB." }, 413);
  }

  const title = decodeURIComponent(request.headers.get("x-podcast-title") || "").trim().slice(0, 140);
  const description = decodeURIComponent(request.headers.get("x-podcast-description") || "").trim().slice(0, 4000);
  const duration = decodeURIComponent(request.headers.get("x-podcast-duration") || "").trim().slice(0, 16);
  if (!title) return json({ error: "An episode title is required." }, 400);

  const bytes = await request.arrayBuffer();
  if (bytes.byteLength !== declared || bytes.byteLength > MAX_AUDIO_BYTES) {
    return json({ error: "The uploaded MP3 was incomplete or too large." }, 400);
  }

  const now = new Date();
  const id = crypto.randomUUID();
  const uploadedAt = now.toISOString();
  const date = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(now);
  const recordKey = `episodes/${uploadedAt.slice(0, 10)}/${id}`;
  const fileKey = `files/${id}.mp3`;
  const item = {
    id, title, description, duration, date, uploadedAt, publishedAt: uploadedAt,
    bytes: bytes.byteLength,
    fileKey,
    fileUrl: `/api/podcast/file/${id}`,
    status: "published-manual"
  };

  const store = getStore({ name: "manual-podcast-episodes", consistency: "strong" });
  await store.set(fileKey, bytes, { metadata: { contentType: "audio/mpeg", uploadedAt } });
  await store.setJSON(recordKey, item, { metadata: { publishedAt: uploadedAt, status: item.status } });
  await store.set(`index/${id}`, recordKey);

  return json({ ok: true, item, feedUrl: "/podcast/feed.xml" });
};

export const config = { path: "/api/podcast/upload" };
