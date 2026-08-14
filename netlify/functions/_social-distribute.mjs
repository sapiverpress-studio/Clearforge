const SITE_BASE = "https://sapiverforge-daily-brief.netlify.app";
const PIN_IMAGE = `${SITE_BASE}/podcast/sapiver-forge-ai-briefing-cover-v1.png`;

function firstEnv(...names) {
  for (const name of names) {
    const value = String(Netlify.env.get(name) || "").trim();
    if (value) return value;
  }
  return "";
}

async function jsonFetch(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${JSON.stringify(data).slice(0, 1200)}`);
  return data;
}

async function postFacebook({ message, link }) {
  const token = firstEnv("FB_PAGE_TOKEN", "FACEBOOK_PAGE_ACCESS_TOKEN");
  const pageId = firstEnv("FB_PAGE_ID", "FACEBOOK_PAGE_ID");
  if (!token || !pageId) return { skipped: true, reason: "missing_netlify_facebook_credentials" };
  const body = new URLSearchParams();
  body.set("message", message);
  body.set("link", link);
  body.set("access_token", token);
  const data = await jsonFetch(`https://graph.facebook.com/v20.0/${encodeURIComponent(pageId)}/feed`, { method: "POST", body });
  return { ok: true, id: data.id || null };
}

async function postPinterest({ title, description, link }) {
  const token = firstEnv("PINTEREST_ACCESS_TOKEN", "PINTEREST_TOKEN", "PINTEREST_API_TOKEN", "PINTEREST_OAUTH_TOKEN");
  const boardId = firstEnv("PINTEREST_BOARD_ID");
  if (!token || !boardId) return { skipped: true, reason: "missing_netlify_pinterest_credentials" };
  const data = await jsonFetch("https://api.pinterest.com/v5/pins", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      board_id: boardId,
      title: String(title || "Sapiver Forge").slice(0, 100),
      description: String(description || "").slice(0, 800),
      link,
      media_source: { source_type: "image_url", url: PIN_IMAGE, is_standard: true }
    })
  });
  return { ok: true, id: data.id || null };
}

async function safe(fn) {
  try { return await fn(); }
  catch (error) { return { failed: true, error: String(error?.message || error).slice(0, 1000) }; }
}

export async function distributeUpload({ kind, title, description, itemUrl }) {
  const label = kind === "podcast" ? "New Sapiver Forge podcast" : "New Sapiver Forge video";
  const message = `${label}: ${title}${description ? `\n\n${String(description).slice(0, 700)}` : ""}\n\n${itemUrl}`;
  const pinterestDescription = description || (kind === "podcast" ? "Listen to the latest Sapiver Forge podcast episode." : "Watch the latest Sapiver Forge video.");
  const [facebook, pinterest] = await Promise.all([
    safe(() => postFacebook({ message, link: itemUrl })),
    safe(() => postPinterest({ title, description: pinterestDescription, link: itemUrl }))
  ]);
  return { attemptedAt: new Date().toISOString(), facebook, pinterest, youtube: { manual: true } };
}

export { SITE_BASE };
