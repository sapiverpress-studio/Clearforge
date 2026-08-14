import { getStore } from "@netlify/blobs";

export default async (request, context) => {
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed.", { status: 405 });
  const id = String(context.params.id || "");
  if (!/^[a-f0-9-]{36}$/.test(id)) return new Response("Not found.", { status: 404 });
  const store = getStore({ name: "daily-brief-videos" });
  const data = await store.get(`files/${id}.mp4`, { type: "stream" });
  if (!data) return new Response("Not found.", { status: 404 });
  return new Response(request.method === "HEAD" ? null : data, {
    headers: {
      "content-type": "video/mp4",
      "cache-control": "public, max-age=3600",
      "content-disposition": `inline; filename="sapiver-forge-${id}.mp4"`,
      "accept-ranges": "none"
    }
  });
};

export const config = { path: "/api/daily-video/file/:id" };
