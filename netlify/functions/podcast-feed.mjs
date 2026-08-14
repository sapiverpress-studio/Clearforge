import { getStore } from "@netlify/blobs";

const BASE_FEED = "https://raw.githubusercontent.com/sapiverpress-studio/SapiverForge/main/public/podcast/feed.xml";
const esc = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

export default async (request) => {
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });

  const baseResponse = await fetch(BASE_FEED, { headers: { "user-agent": "Sapiver-Forge-Podcast-Feed" } });
  if (!baseResponse.ok) return new Response("Podcast feed temporarily unavailable", { status: 503 });
  let feed = await baseResponse.text();

  const store = getStore({ name: "manual-podcast-episodes", consistency: "strong" });
  const { blobs } = await store.list({ prefix: "episodes/" });
  const episodes = [];
  for (const blob of blobs) {
    const item = await store.get(blob.key, { type: "json" });
    if (item?.status === "published-manual" && item?.fileUrl) episodes.push(item);
  }
  episodes.sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));

  const items = episodes.map((item) => {
    const audioUrl = new URL(item.fileUrl, request.url).toString();
    const duration = item.duration ? `\n      <itunes:duration>${esc(item.duration)}</itunes:duration>` : "";
    return `    <item>\n      <title>${esc(item.title)}</title>\n      <description>${esc(item.description || "Sapiver Forge audio briefing.")}</description>\n      <link>${esc(audioUrl)}</link>\n      <guid isPermaLink="false">sapiver-forge:manual:${esc(item.id)}</guid>\n      <pubDate>${new Date(item.publishedAt).toUTCString()}</pubDate>\n      <enclosure url="${esc(audioUrl)}" length="${Number(item.bytes || 0)}" type="audio/mpeg"/>\n      <itunes:author>Sapiver Forge</itunes:author>\n      <itunes:episodeType>full</itunes:episodeType>\n      <itunes:explicit>false</itunes:explicit>${duration}\n    </item>`;
  }).join("\n");

  feed = feed.replace(/<lastBuildDate>[^<]*<\/lastBuildDate>/, `<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`);
  if (items) {
    if (feed.includes("    <item>")) feed = feed.replace("    <item>", `${items}\n    <item>`);
    else feed = feed.replace("  </channel>", `${items}\n  </channel>`);
  }

  return new Response(request.method === "HEAD" ? null : feed, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=60"
    }
  });
};

export const config = { path: "/podcast/feed.xml" };
