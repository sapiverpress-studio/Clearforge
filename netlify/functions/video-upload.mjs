import { getStore } from "@netlify/blobs";
import { distributeUpload, SITE_BASE } from "./_social-distribute.mjs";

const MAX_VIDEO_BYTES = 20_000_000;
const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});
const authorised = (request) => {
  const password = Netlify.env.get("VIDEO_UPLOAD_PASSWORD");
  return Boolean(password) && request.headers.get("authorization") === `Bearer ${password}`;
};

export default async (request, context) => {
  if (!authorised(request)) return json({ error: "Incorrect publisher password." }, 401);
  const id = String(context.params.id || "");
  if (!/^[a-f0-9-]{36}$/.test(id)) return json({ error: "Invalid upload ID." }, 400);
  if (request.method !== "PUT") return json({ error: "Method not allowed." }, 405);
  const declared = Number(request.headers.get("content-length") || 0);
  if (!Number.isSafeInteger(declared) || declared < 1 || declared > MAX_VIDEO_BYTES) {
    return json({ error: "Choose an MP4 smaller than 20 MB." }, 413);
  }
  if (!/^video\/mp4(?:;|$)/i.test(request.headers.get("content-type") || "")) {
    return json({ error: "Only MP4 video files are accepted." }, 415);
  }

  const store = getStore({ name: "daily-brief-videos", consistency: "strong" });
  const indexKey = `uploads/${id}`;
  const recordKey = await store.get(indexKey);
  if (!recordKey) return json({ error: "This upload has expired. Start again." }, 404);
  const item = await store.get(recordKey, { type: "json" });
  if (!item || item.status !== "awaiting-upload") return json({ error: "This upload cannot be reused." }, 409);

  const bytes = await request.arrayBuffer();
  if (bytes.byteLength !== declared || bytes.byteLength > MAX_VIDEO_BYTES) {
    return json({ error: "The uploaded file was incomplete or too large." }, 400);
  }
  const fileKey = `files/${id}.mp4`;
  await store.set(fileKey, bytes, { metadata: { contentType: "video/mp4", uploadedAt: item.uploadedAt } });

  const archiveUrl = `${SITE_BASE}/daily-brief/videos/`;
  const distribution = await distributeUpload({
    kind: "video",
    title: item.title,
    description: item.description,
    itemUrl: archiveUrl
  });

  const saved = {
    ...item,
    status: "published-manual",
    fileKey,
    fileUrl: `/api/daily-video/file/${id}`,
    youtubeManual: true,
    distribution
  };
  await store.setJSON(recordKey, saved, { metadata: { publishedAt: saved.publishedAt, status: saved.status } });
  return json({ ok: true, item: saved, distribution });
};

export const config = { path: "/api/daily-video/upload/:id" };
