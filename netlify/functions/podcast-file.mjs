import { getStore } from "@netlify/blobs";

const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

export default async (request, context) => {
  if (request.method !== "GET" && request.method !== "HEAD") return json({ error: "Method not allowed." }, 405);
  const id = String(context.params.id || "");
  if (!/^[a-f0-9-]{36}$/.test(id)) return json({ error: "Invalid episode ID." }, 400);

  const store = getStore({ name: "manual-podcast-episodes", consistency: "strong" });
  const recordKey = await store.get(`index/${id}`);
  if (!recordKey) return json({ error: "Episode not found." }, 404);
  const item = await store.get(recordKey, { type: "json" });
  if (!item?.fileKey) return json({ error: "Episode audio is unavailable." }, 404);
  const audio = await store.get(item.fileKey, { type: "arrayBuffer" });
  if (!audio) return json({ error: "Episode audio is unavailable." }, 404);

  return new Response(request.method === "HEAD" ? null : audio, {
    headers: {
      "content-type": "audio/mpeg",
      "content-length": String(item.bytes || audio.byteLength),
      "cache-control": "public, max-age=3600",
      "accept-ranges": "bytes",
      "content-disposition": `inline; filename="sapiver-forge-${item.date || id}.mp3"`
    }
  });
};

export const config = { path: "/api/podcast/file/:id" };
