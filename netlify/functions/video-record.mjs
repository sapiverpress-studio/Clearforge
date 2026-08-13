import { getStore } from "@netlify/blobs";

const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

export default async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const password = Netlify.env.get("VIDEO_UPLOAD_PASSWORD");
  if (!password || request.headers.get("authorization") !== `Bearer ${password}`) return json({ error: "Incorrect publisher password." }, 401);
  const input = await request.json().catch(() => ({}));
  const videoId = String(input.videoId || "");
  if (!/^[A-Za-z0-9_-]{6,20}$/.test(videoId)) return json({ error: "YouTube returned an invalid video ID." }, 400);
  const publishedAt = new Date().toISOString();
  const date = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const item = {
    videoId,
    title: String(input.title || "Sapiver Forge daily video").trim().slice(0, 100),
    publishedAt,
    date,
    youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
    tiktokUrl: /^https:\/\/(www\.)?tiktok\.com\//i.test(String(input.tiktokUrl || "")) ? String(input.tiktokUrl) : ""
  };
  const store = getStore({ name: "daily-brief-videos", consistency: "strong" });
  await store.setJSON(`videos/${publishedAt.slice(0, 10)}/${videoId}`, item, { metadata: { publishedAt } });
  return json({ ok: true, item });
};

export const config = { path: "/api/daily-video/record" };
