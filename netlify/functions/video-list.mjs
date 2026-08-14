import { getStore } from "@netlify/blobs";

export default async () => {
  const store = getStore({ name: "daily-brief-videos", consistency: "strong" });
  const { blobs } = await store.list({ prefix: "videos/" });
  const cutoff = Date.now() - 90 * 86400_000;
  const items = [];
  for (const blob of blobs) {
    const item = await store.get(blob.key, { type: "json" });
    if (!item) continue;
    if (new Date(item.publishedAt || item.uploadedAt).valueOf() < cutoff) {
      await store.delete(blob.key);
      if (item.fileKey) await store.delete(item.fileKey);
      if (item.id) await store.delete(`uploads/${item.id}`);
      continue;
    }
    if (item.status === "awaiting-upload") continue;
    items.push(item);
  }
  items.sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
  return new Response(JSON.stringify({ retentionDays: 90, items }), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=60" }
  });
};

export const config = { path: "/api/daily-video/list" };
