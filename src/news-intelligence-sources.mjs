const USER_AGENT = "SapiverForge-News-Intelligence/1.1 (+https://sapiverpress.co.uk)";
const TIMEOUT_MS = 15000;

function decodeEntities(value = "") {
  const map = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " "
  };
  return String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => map[name.toLowerCase()] ?? match);
}

function stripTags(value = "") {
  return decodeEntities(String(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalUrl(value, base) {
  try {
    const url = new URL(value, base);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|ref$|ref_|source$|cmpid$|s$)/i.test(key)) url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return "";
  }
}

function titleKey(value = "") {
  return stripTags(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(the|a|an|and|or|to|of|for|in|on|with|is|are|as|by)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDateFromUrl(url) {
  const match = String(url).match(/(?:^|\/)(20\d{2})[-/](\d{2})[-/](\d{2})(?:\/|$|[?#-])/);
  if (!match) return null;
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00Z`);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

async function fetchWithTimeout(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "user-agent": USER_AGENT,
      accept: options.accept || "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.5",
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response;
}

async function fetchText(url, options = {}) {
  return (await fetchWithTimeout(url, options)).text();
}

async function fetchJson(url, options = {}) {
  return (await fetchWithTimeout(url, { ...options, accept: "application/json" })).json();
}

function extractAnchors(html, base, predicate = () => true) {
  const results = [];
  const anchorPattern = /<a\b[^>]*href=(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchorPattern.exec(html))) {
    const href = match[1] || match[2] || match[3] || "";
    const title = stripTags(match[4]);
    const url = canonicalUrl(href, base);
    if (!url || !predicate(url, href, title)) continue;
    results.push({ title, url });
  }
  return results;
}

function extractExternalLinks(html, base, blockedHosts = []) {
  const blocked = blockedHosts.map((host) => host.toLowerCase());
  return extractAnchors(html, base, (url) => {
    try {
      const host = new URL(url).hostname.toLowerCase();
      return !blocked.some((blockedHost) => host === blockedHost || host.endsWith(`.${blockedHost}`));
    } catch {
      return false;
    }
  }).map((item) => item.url);
}

function parseRssItems(xml, base, limit = 12) {
  const out = [];
  const itemPattern = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let item;
  while ((item = itemPattern.exec(xml)) && out.length < limit) {
    const body = item[1];
    const get = (tag) => {
      const match = body.match(new RegExp(`<${tag}\\b[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "i"));
      return match ? match[1].trim() : "";
    };
    const title = stripTags(get("title"));
    const url = canonicalUrl(stripTags(get("link")), base);
    const descriptionHtml = get("description");
    const description = stripTags(descriptionHtml);
    const pubDateRaw = stripTags(get("pubDate"));
    const pubDate = pubDateRaw && !Number.isNaN(new Date(pubDateRaw).valueOf()) ? new Date(pubDateRaw).toISOString() : null;
    if (title && url) out.push({ title, url, summary: description, description_html: descriptionHtml, published_at: pubDate });
  }
  return out;
}

function publisherFromTitle(title, url = "") {
  const parenthetical = String(title || "").match(/\(([^()]{2,80})\)\s*$/);
  if (parenthetical) return stripTags(parenthetical[1]);
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function collectTechmeme() {
  const feedUrl = "https://www.techmeme.com/feed.xml";
  const xml = await fetchText(feedUrl, { accept: "application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.5" });
  const items = parseRssItems(xml, "https://www.techmeme.com", 12);
  if (!items.length) throw new Error("Techmeme feed returned no usable items");
  return items.map((item, index) => {
    const discoveryUrl = item.url;
    const externalLinks = extractExternalLinks(item.description_html || "", discoveryUrl, ["techmeme.com"]);
    const originalUrl = externalLinks[0] || "";
    const publisher = publisherFromTitle(item.title, originalUrl);
    return {
      ...item,
      url: originalUrl || discoveryUrl,
      discovery_url: discoveryUrl,
      direct_source_url: originalUrl || null,
      publisher: publisher || "Techmeme",
      link_quality: originalUrl ? "original" : "aggregator_fallback",
      source: "Techmeme",
      source_home: "https://www.techmeme.com/",
      source_rank: index + 1,
      collection_mode: "rss"
    };
  });
}

function parseSitemapLocs(xml) {
  return [...String(xml).matchAll(/<loc>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/loc>/gi)]
    .map((match) => decodeEntities(match[1].trim()))
    .filter(Boolean);
}

function parseReutersNewsSitemap(xml) {
  const items = [];
  const urlPattern = /<url\b[^>]*>([\s\S]*?)<\/url>/gi;
  let match;
  while ((match = urlPattern.exec(String(xml)))) {
    const body = match[1];
    const get = (tag) => {
      const found = body.match(new RegExp(`<${tag}\\b[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "i"));
      return found ? decodeEntities(stripTags(found[1])).trim() : "";
    };
    const url = canonicalUrl(get("loc"), "https://www.reuters.com/");
    const title = get("news:title") || get("title");
    const publishedRaw = get("news:publication_date") || get("lastmod");
    const publishedAt = publishedRaw && !Number.isNaN(new Date(publishedRaw).valueOf()) ? new Date(publishedRaw).toISOString() : parseDateFromUrl(url);
    if (url && title) items.push({ title, url, summary: "", published_at: publishedAt });
  }
  return items;
}

function isReutersTechRelevant(item) {
  let pathname = "";
  try { pathname = new URL(item.url).pathname.toLowerCase(); } catch {}
  if (pathname.startsWith("/technology/")) return true;
  const text = `${item.title || ""} ${pathname}`.toLowerCase();
  return /\b(ai|artificial intelligence|technology|tech|chip|semiconductor|software|cyber|cloud|robot|startup|social media|data center|data centre|nvidia|openai|anthropic|google|meta|microsoft|apple|amazon)\b/.test(text);
}

async function collectReutersFromSitemaps() {
  const indexes = [
    "https://www.reuters.com/arc/outboundfeeds/news-sitemap-index/?outputType=xml",
    "https://www.reuters.com/arc/outboundfeeds/sitemap-index/?outputType=xml"
  ];
  let lastError;
  for (const indexUrl of indexes) {
    try {
      const indexXml = await fetchText(indexUrl, { accept: "application/xml,text/xml;q=0.9,*/*;q=0.5" });
      const locs = [...new Set(parseSitemapLocs(indexXml))].sort((a, b) => b.localeCompare(a));
      if (!locs.length) throw new Error("Reuters sitemap index returned no child sitemaps");
      const selected = [...new Set([...locs.slice(0, 6), ...locs.slice(-3)])];
      const collected = [];
      const seen = new Set();
      for (const sitemapUrl of selected) {
        let sitemapXml;
        try {
          sitemapXml = await fetchText(sitemapUrl, { accept: "application/xml,text/xml;q=0.9,*/*;q=0.5" });
        } catch {
          continue;
        }
        for (const item of parseReutersNewsSitemap(sitemapXml)) {
          if (!isReutersTechRelevant(item) || seen.has(item.url)) continue;
          seen.add(item.url);
          collected.push(item);
          if (collected.length >= 12) break;
        }
        if (collected.length >= 12) break;
      }
      if (collected.length) return collected;
      throw new Error("Reuters sitemaps returned no recent technology-relevant stories");
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Reuters sitemap collection failed");
}

async function collectReuters() {
  const items = await collectReutersFromSitemaps();
  return items.slice(0, 12).map((item, index) => ({
    ...item,
    source: "Reuters",
    publisher: "Reuters",
    source_home: "https://www.reuters.com/technology/",
    source_rank: index + 1,
    direct_source_url: item.url,
    discovery_url: item.url,
    link_quality: "original",
    collection_mode: "sitemap"
  }));
}

async function collectHackerNews() {
  const api = "https://hacker-news.firebaseio.com/v0";
  const ids = await fetchJson(`${api}/topstories.json`);
  if (!Array.isArray(ids) || !ids.length) throw new Error("Hacker News topstories returned no ids");
  const details = await Promise.all(ids.slice(0, 35).map(async (id) => {
    try { return await fetchJson(`${api}/item/${id}.json`); } catch { return null; }
  }));
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  const stories = details
    .filter((item) => item && item.type === "story" && item.title && Number(item.time || 0) * 1000 >= cutoff)
    .sort((a, b) => (Number(b.score || 0) + Number(b.descendants || 0) * 0.3) - (Number(a.score || 0) + Number(a.descendants || 0) * 0.3))
    .slice(0, 10);
  if (!stories.length) throw new Error("Hacker News returned no recent usable stories");
  return stories.map((item, index) => {
    const url = canonicalUrl(item.url || `https://news.ycombinator.com/item?id=${item.id}`, "https://news.ycombinator.com/");
    return {
      source: "Hacker News",
      publisher: publisherFromTitle(item.title, url) || "Hacker News",
      source_home: "https://news.ycombinator.com/",
      source_rank: index + 1,
      title: stripTags(item.title),
      url,
      direct_source_url: item.url ? url : null,
      discovery_url: `https://news.ycombinator.com/item?id=${item.id}`,
      link_quality: item.url ? "original" : "discussion_fallback",
      discussion_url: `https://news.ycombinator.com/item?id=${item.id}`,
      summary: item.text ? stripTags(item.text).slice(0, 500) : "",
      published_at: new Date(Number(item.time) * 1000).toISOString(),
      engagement: { score: Number(item.score || 0), comments: Number(item.descendants || 0) },
      collection_mode: "api"
    };
  });
}

async function collectHuggingFace() {
  const endpoint = "https://huggingface.co/api/daily_papers";
  const data = await fetchJson(endpoint);
  if (!Array.isArray(data) || !data.length) throw new Error("Hugging Face daily papers returned no items");
  const items = data.slice(0, 12).map((entry, index) => {
    const paper = entry.paper || entry;
    const id = paper.id || entry.id;
    const url = id ? `https://huggingface.co/papers/${encodeURIComponent(id)}` : "https://huggingface.co/papers";
    return {
      source: "Hugging Face",
      publisher: "Hugging Face",
      source_home: "https://huggingface.co/papers",
      source_rank: index + 1,
      title: stripTags(entry.title || paper.title || ""),
      url,
      direct_source_url: url,
      discovery_url: url,
      link_quality: "original",
      summary: stripTags(entry.summary || paper.ai_summary || paper.summary || "").slice(0, 1200),
      published_at: entry.publishedAt || paper.publishedAt || paper.submittedOnDailyAt || null,
      engagement: { upvotes: Number(paper.upvotes || entry.upvotes || 0) },
      collection_mode: "api"
    };
  }).filter((item) => item.title && item.url);
  if (!items.length) throw new Error("Hugging Face daily papers returned no usable papers");
  return items;
}

async function collectSifted() {
  const pages = ["https://sifted.eu/", "https://sifted.eu/articles"];
  let lastError;
  for (const sourceUrl of pages) {
    try {
      const html = await fetchText(sourceUrl);
      const anchors = extractAnchors(html, sourceUrl, (url, _href, title) => {
        const parsed = new URL(url);
        return title.length >= 12 && parsed.hostname.endsWith("sifted.eu") && /^\/articles\/.+/.test(parsed.pathname);
      });
      const seen = new Set();
      const items = [];
      for (const item of anchors) {
        if (seen.has(item.url)) continue;
        seen.add(item.url);
        items.push({ ...item, published_at: parseDateFromUrl(item.url), summary: "" });
        if (items.length >= 12) break;
      }
      if (!items.length) throw new Error("no usable article links");
      return items.map((item, index) => ({
        ...item,
        source: "Sifted",
        publisher: "Sifted",
        source_home: "https://sifted.eu/",
        source_rank: index + 1,
        direct_source_url: item.url,
        discovery_url: item.url,
        link_quality: "original",
        collection_mode: "html"
      }));
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Sifted returned no usable articles: ${lastError?.message || "unknown error"}`);
}

const COLLECTORS = [
  ["Techmeme", collectTechmeme],
  ["Reuters", collectReuters],
  ["Hacker News", collectHackerNews],
  ["Hugging Face", collectHuggingFace],
  ["Sifted", collectSifted]
];

const SOURCE_WEIGHT = {
  Reuters: 5.0,
  Techmeme: 4.7,
  Sifted: 4.4,
  "Hacker News": 4.1,
  "Hugging Face": 4.0
};

function scoreCandidate(item) {
  let score = SOURCE_WEIGHT[item.source] || 3;
  score += Math.max(0, 1.3 - (Math.max(1, item.source_rank) - 1) * 0.08);
  if (item.published_at) {
    const ageHours = Math.max(0, (Date.now() - new Date(item.published_at).valueOf()) / 3_600_000);
    if (Number.isFinite(ageHours)) score += Math.max(0, 1.5 - ageHours / 24);
  }
  if (item.engagement?.score) score += Math.min(1.2, Math.log10(item.engagement.score + 1) / 2);
  if (item.engagement?.comments) score += Math.min(0.5, Math.log10(item.engagement.comments + 1) / 4);
  if (item.engagement?.upvotes) score += Math.min(0.8, Math.log10(item.engagement.upvotes + 1) / 2);
  if (item.summary?.length > 80) score += 0.35;
  if (item.link_quality === "original") score += 0.25;
  return Number(score.toFixed(3));
}

function dedupeCandidates(items) {
  const byUrl = new Set();
  const byTitle = new Set();
  const result = [];
  for (const item of items) {
    const url = canonicalUrl(item.url, item.source_home);
    const key = titleKey(item.title);
    if (!url || !key || byUrl.has(url) || byTitle.has(key)) continue;
    byUrl.add(url);
    byTitle.add(key);
    result.push({ ...item, url, title: stripTags(item.title), summary: stripTags(item.summary || ""), score: scoreCandidate(item) });
  }
  return result;
}

export async function collectNewsSources() {
  const settled = await Promise.all(COLLECTORS.map(async ([name, collector]) => {
    const started = Date.now();
    try {
      const items = await collector();
      return {
        name,
        ok: true,
        item_count: items.length,
        elapsed_ms: Date.now() - started,
        collection_mode: items[0]?.collection_mode || "direct",
        original_link_count: items.filter((item) => item.link_quality === "original").length,
        items
      };
    } catch (error) {
      return { name, ok: false, item_count: 0, elapsed_ms: Date.now() - started, error: String(error?.message || error), items: [] };
    }
  }));

  const status = settled.map(({ items, ...entry }) => entry);
  const all = dedupeCandidates(settled.flatMap((entry) => entry.items));

  // Keep representation broad before overall ranking so one noisy source cannot crowd out the rest.
  const perSource = [];
  for (const [source] of COLLECTORS) {
    perSource.push(...all.filter((item) => item.source === source).sort((a, b) => b.score - a.score).slice(0, 8));
  }
  const candidates = dedupeCandidates(perSource).sort((a, b) => b.score - a.score).slice(0, 30);
  return {
    collected_at: new Date().toISOString(),
    expected_sources: COLLECTORS.map(([name]) => name),
    healthy_source_count: status.filter((entry) => entry.ok).length,
    source_status: status,
    candidates
  };
}

export const __test = {
  stripTags,
  canonicalUrl,
  parseRssItems,
  extractAnchors,
  extractExternalLinks,
  parseSitemapLocs,
  parseReutersNewsSitemap,
  publisherFromTitle,
  titleKey,
  dedupeCandidates,
  scoreCandidate
};
