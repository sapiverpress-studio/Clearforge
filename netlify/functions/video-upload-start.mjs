import { getStore } from "@netlify/blobs";

const MAX_VIDEO_BYTES = 20_000_000;
const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

export default async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const password = Netlify.env.get("VIDEO_UPLOAD_PASSWORD");
  if (!password || request.headers.get("authorization") !== `Bearer ${password}`) return json({ error: "Incorrect publisher password." }, 401);
  const input = await request.json().catch(() => ({}));
  const fileSize = Number(input.fileSize || 0);
  const title = String(input.title || "").trim().slice(0, 100);
  if (!title) return json({ error: "A video title is required." }, 400);
  if (!Number.isSafeInteger(fileSize) || fileSize < 1 || fileSize > MAX_VIDEO_BYTES) return json({ error: "Choose an MP4 smaller than 20 MB." }, 400);

  const now = new Date();
  const uploadedAt = now.toISOString();
  const date = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const id = crypto.randomUUID();
  const recordKey = `videos/${date}/${id}`;
  const item = {
    id, title, description: String(input.description || "").trim().slice(0, 5000),
    privacyStatus: ["public", "unlisted", "private"].includes(input.privacyStatus) ? input.privacyStatus : "public",
    tiktokUrl: /^https:\/\/(?:www\.|vm\.)?tiktok\.com\//i.test(String(input.tiktokUrl || "")) ? String(input.tiktokUrl) : "",
    uploadedAt, publishedAt: uploadedAt, date, status: "awaiting-upload"
  };
  const store = getStore({ name: "daily-brief-videos", consistency: "strong" });
  await store.setJSON(recordKey, item, { metadata: { publishedAt: uploadedAt, status: item.status } });
  await store.set(`uploads/${id}`, recordKey);
  return json({ id, uploadUrl: `/api/daily-video/upload/${id}` });
};

export const config = { path: "/api/daily-video/start-upload" };
