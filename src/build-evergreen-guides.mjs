import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, "explainers");
const PUBLIC = path.join(ROOT, "public");
const GUIDES = path.join(PUBLIC, "guides");
const BASE = String(process.env.BLOG_BASE_URL || "https://clearforge-daily-brief.netlify.app").replace(/\/$/, "");

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function readJson(file, fallback = null) { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; } }
function write(file, content) { ensureDir(path.dirname(file)); fs.writeFileSync(file, content, "utf8"); }
function esc(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function inline(value) {
  return esc(value).replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>').replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\*([^*]+)\*/g, "<em>$1</em>");
}
function markdownToHtml(markdown) {
  const out = []; let list = false;
  for (const line of String(markdown || "").split(/\r?\n/)) {
    if (line.startsWith("# ")) { if (list) { out.push("</ul>"); list = false; } out.push(`<h1>${inline(line.slice(2))}</h1>`); }
    else if (line.startsWith("## ")) { if (list) { out.push("</ul>"); list = false; } out.push(`<h2>${inline(line.slice(3))}</h2>`); }
    else if (line.startsWith("### ")) { if (list) { out.push("</ul>"); list = false; } out.push(`<h3>${inline(line.slice(4))}</h3>`); }
    else if (line.startsWith("- ")) { if (!list) { out.push("<ul>"); list = true; } out.push(`<li>${inline(line.slice(2))}</li>`); }
    else if (!line.trim()) { if (list) { out.push("</ul>"); list = false; } }
    else { if (list) { out.push("</ul>"); list = false; } out.push(`<p>${inline(line)}</p>`); }
  }
  if (list) out.push("</ul>");
  return out.join("\n");
}
function canonical(pathname) { return `${BASE}${pathname}`; }
function page(title, description, pathname, body, structured) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | Clearforge</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${esc(canonical(pathname))}"><meta property="og:type" content="article"><meta property="og:site_name" content="Clearforge"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(canonical(pathname))}"><meta property="og:image" content="${esc(canonical("/podcast/cover.png"))}"><meta name="twitter:card" content="summary_large_image"><link rel="stylesheet" href="/styles.css"><link rel="alternate" type="application/rss+xml" title="Clearforge Features" href="/features.xml"><link rel="alternate" type="application/rss+xml" title="Clearforge AI Briefing Podcast" href="/podcast/feed.xml"><script type="application/ld+json">${JSON.stringify(structured).replace(/</g, "\\u003c")}</script></head><body><header class="site-header"><a class="brand" href="/">Clearforge</a><p>Human-led. AI-empowered.</p><nav aria-label="Site links"><a href="/guides/">Guides</a><a href="/topics/">Topics</a><a href="/reports/">Reports</a><a href="/podcast/">Podcast</a><a href="/newsletter/">Weekly digest</a></nav></header><main class="content">${body}</main><footer class="site-footer"><p>Turning human input into clear, usable systems.</p><p><a href="/guides/">Evergreen guides</a> · <a href="/topics/">Topics</a> · <a href="/podcast/">Podcast</a> · <a href="/newsletter/">Weekly digest</a></p></footer></body></html>`;
}
function newsletter() { return `<section class="newsletter-callout"><h2>Get the weekly Clearforge digest</h2><p>One calm email covering what changed, why it matters and what is worth testing.</p><p><a class="button" href="/newsletter/">Join the weekly digest</a></p></section>`; }

ensureDir(GUIDES);
const registry = readJson(path.join(SOURCE, "registry.json"), { explainers: [] });
const guides = (registry.explainers || []).filter((item) => item.approved_for_publication === true).map((item) => {
  const dir = path.join(SOURCE, item.slug);
  const metadata = readJson(path.join(dir, "metadata.json"));
  if (!metadata || metadata.approved_for_publication !== true || !fs.existsSync(path.join(dir, "guide.md"))) return null;
  return { ...item, metadata, markdown: fs.readFileSync(path.join(dir, "guide.md"), "utf8"), sourceNotes: fs.existsSync(path.join(dir, "source-notes.md")) ? fs.readFileSync(path.join(dir, "source-notes.md"), "utf8") : "" };
}).filter(Boolean).sort((a, b) => b.last_updated.localeCompare(a.last_updated));

for (const guide of guides) {
  const pathname = `/guides/${guide.slug}/`;
  const related = guides.filter((other) => other.slug !== guide.slug && other.topic_slugs.some((topic) => guide.topic_slugs.includes(topic))).slice(0, 4);
  const relatedHtml = related.length ? `<aside class="related"><h2>Related Clearforge guides</h2><ul>${related.map((item) => `<li><a href="/guides/${item.slug}/">${esc(item.title)}</a></li>`).join("")}</ul></aside>` : "";
  const sourceHtml = guide.sourceNotes ? `<details><summary>Source notes and revision history</summary>${markdownToHtml(guide.sourceNotes)}</details>` : "";
  const body = `<article class="feature"><p class="eyebrow">Clearforge Evergreen Guide</p><p class="report-meta">First published ${esc(guide.metadata.created)} · Last checked ${esc(guide.metadata.last_updated)}</p>${markdownToHtml(guide.markdown)}${sourceHtml}<p><strong>Editorial basis:</strong> ${esc(guide.metadata.editorial_basis)}</p></article>${relatedHtml}${newsletter()}`;
  const structured = { "@context": "https://schema.org", "@type": "Article", headline: guide.title, description: guide.description, datePublished: guide.metadata.created, dateModified: guide.metadata.last_updated, mainEntityOfPage: canonical(pathname), about: guide.search_question, author: { "@type": "Organization", name: "Clearforge" }, publisher: { "@type": "Organization", name: "Clearforge", logo: { "@type": "ImageObject", url: canonical("/podcast/cover.png") } } };
  write(path.join(GUIDES, guide.slug, "index.html"), page(guide.title, guide.description, pathname, body, structured));
}

const cards = guides.length ? `<ul>${guides.map((guide) => `<li class="report-card"><p class="eyebrow">Evergreen guide</p><h2><a href="/guides/${guide.slug}/">${esc(guide.title)}</a></h2><p>${esc(guide.description)}</p><p class="report-meta">Last checked ${esc(guide.last_updated)}</p></li>`).join("")}</ul>` : "<p>The first evergreen guide is being prepared.</p>";
const indexBody = `<section class="hero"><p class="eyebrow">Clearforge Evergreen Guides</p><h1>Durable answers beyond the daily AI headline.</h1><p>Plain-English guides explaining how AI adoption, products, systems and safeguards work in practice. Guides are updated when verified evidence changes.</p></section><section class="posts"><h2>Guides</h2>${cards}</section>${newsletter()}`;
write(path.join(GUIDES, "index.html"), page("Clearforge Evergreen Guides", "Durable, source-backed Clearforge explainers on AI adoption, everyday products, automation, models and accountability.", "/guides/", indexBody, { "@context": "https://schema.org", "@type": "CollectionPage", name: "Clearforge Evergreen Guides", description: "Durable, source-backed explainers on practical AI.", url: canonical("/guides/") }));

for (const file of [path.join(PUBLIC, "index.html"), path.join(PUBLIC, "topics", "index.html"), path.join(PUBLIC, "reports", "index.html"), path.join(PUBLIC, "newsletter", "index.html")]) {
  if (!fs.existsSync(file)) continue;
  let html = fs.readFileSync(file, "utf8");
  if (!html.includes('href="/guides/"')) html = html.replace('<nav aria-label="Site links">', '<nav aria-label="Site links"><a href="/guides/">Guides</a>');
  if (file.endsWith(`${path.sep}index.html`) && file === path.join(PUBLIC, "index.html") && !html.includes("Evergreen Guides</h2>")) {
    const section = `<section class="posts"><h2>Evergreen Guides</h2><p>Durable answers that are updated as verified evidence changes, rather than disappearing with the daily news cycle.</p><p><a class="button" href="/guides/">Browse evergreen guides</a></p></section>`;
    html = html.replace('<section class="posts"><h2>Topic guides</h2>', `${section}<section class="posts"><h2>Topic guides</h2>`);
  }
  write(file, html);
}

const sitemapPath = path.join(PUBLIC, "sitemap.xml");
if (fs.existsSync(sitemapPath)) {
  let sitemap = fs.readFileSync(sitemapPath, "utf8");
  const paths = ["/guides/", ...guides.map((guide) => `/guides/${guide.slug}/`)];
  const additions = paths.filter((pathname) => !sitemap.includes(canonical(pathname))).map((pathname) => `  <url><loc>${esc(canonical(pathname))}</loc></url>`).join("\n");
  if (additions) sitemap = sitemap.replace("</urlset>", `${additions}\n</urlset>`);
  write(sitemapPath, sitemap);
}

console.log(`Published ${guides.length} Clearforge evergreen guide${guides.length === 1 ? "" : "s"}.`);
