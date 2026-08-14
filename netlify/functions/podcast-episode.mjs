import { getStore } from "@netlify/blobs";

const esc = (value) => String(value || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export default async (_request, context) => {
  const id = String(context.params.id || "");
  if (!/^[a-f0-9-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  const store = getStore({ name: "manual-podcast-episodes", consistency: "strong" });
  const recordKey = await store.get(`index/${id}`);
  if (!recordKey) return new Response("Not found", { status: 404 });
  const item = await store.get(recordKey, { type: "json" });
  if (!item) return new Response("Not found", { status: 404 });
  const title = esc(item.title);
  const description = esc(item.description);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — Sapiver Forge</title><meta name="description" content="${description.slice(0,160)}"><style>body{font-family:system-ui,sans-serif;max-width:760px;margin:0 auto;padding:32px 20px;line-height:1.55;background:#0f1115;color:#f4f4f4}a{color:#ffb36a}audio{width:100%;margin:20px 0}.card{padding:24px;border:1px solid #333;border-radius:16px;background:#171a20}</style></head><body><p><a href="/podcast/">← Sapiver Forge podcast</a></p><main class="card"><p>Sapiver Forge AI Briefing</p><h1>${title}</h1>${description ? `<p>${description}</p>` : ""}<audio controls preload="metadata" src="/api/podcast/file/${id}"></audio><p>${esc(item.date)}</p></main></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" } });
};

export const config = { path: "/podcast/manual/:id" };
