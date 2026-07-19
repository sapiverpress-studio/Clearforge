import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const draftsDir = path.join(ROOT, "drafts");
const publicDir = path.join(ROOT, "public");
const postsDir = path.join(publicDir, "posts");
const featuresDir = path.join(publicDir, "features");
const topicsDir = path.join(publicDir, "topics");
const newsletterDir = path.join(publicDir, "newsletter");
const blogBase = String(process.env.BLOG_BASE_URL || "https://clearforge-daily-brief.netlify.app").replace(/\/$/, "");
const reportsSourceDir = path.join(ROOT, "reports");
const reportsPublicDir = path.join(publicDir, "reports");
const podcastPage = "/podcast/";
const podcastRss = "/podcast/feed.xml";

const topicDefinitions = [
  {
    slug: "ai-adoption",
    title: "AI Adoption and Business Change",
    description: "Who is adopting AI, why they are doing it, how deployments work, and what changes in practice.",
    keywords: ["adopt", "deployment", "rollout", "pilot", "partnership", "contract", "customer", "enterprise", "business change", "implementation"]
  },
  {
    slug: "ai-inside-products",
    title: "AI Inside Everyday Products",
    description: "How established products and services are quietly using advancing AI to improve design, work, commerce, media and administration.",
    keywords: ["canva", "adobe", "microsoft 365", "copilot", "shopify", "notion", "zoom", "dropbox", "product", "feature", "integration"]
  },
  {
    slug: "creators-small-business",
    title: "AI for Creators and Small Businesses",
    description: "Practical AI workflows, tools and decisions for creators, freelancers, solo operators and small teams.",
    keywords: ["creator", "small business", "freelancer", "solo", "workflow", "marketing", "publishing", "ecommerce", "content"]
  },
  {
    slug: "systems-automation",
    title: "AI Systems and Automation",
    description: "Agents, automation, handoffs, review loops, reliability and the places where human control still matters.",
    keywords: ["agent", "automation", "system", "workflow", "handoff", "approval", "reliability", "governance", "human review"]
  },
  {
    slug: "models-research",
    title: "AI Models, Research and Infrastructure",
    description: "Important model releases, research advances, infrastructure changes and the practical consequences behind them.",
    keywords: ["model", "research", "benchmark", "open source", "infrastructure", "chip", "gpu", "training", "reasoning"]
  },
  {
    slug: "safety-accountability",
    title: "AI Safety and Accountability",
    description: "Verification, transparency, policy, safeguards, limitations and responsible human use.",
    keywords: ["safety", "risk", "accountability", "policy", "regulation", "transparency", "disclosure", "verification", "privacy"]
  }
];

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function write(file, content) { ensureDir(path.dirname(file)); fs.writeFileSync(file, content, "utf8"); }
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function xmlEscape(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}
function inlineMarkdown(value) {
  const escaped = escapeHtml(value);
  return escaped
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}
function markdownToHtml(markdown) {
  const lines = markdown.split(/\r?\n/);
  const html = [];
  let inList = false;
  for (const line of lines) {
    if (line.startsWith("# ")) {
      if (inList) { html.push("</ul>"); inList = false; }
      html.push(`<h1>${inlineMarkdown(line.slice(2))}</h1>`);
    } else if (line.startsWith("## ")) {
      if (inList) { html.push("</ul>"); inList = false; }
      html.push(`<h2>${inlineMarkdown(line.slice(3))}</h2>`);
    } else if (line.startsWith("### ")) {
      if (inList) { html.push("</ul>"); inList = false; }
      html.push(`<h3>${inlineMarkdown(line.slice(4))}</h3>`);
    } else if (line.startsWith("- ")) {
      if (!inList) { html.push("<ul>"); inList = true; }
      html.push(`<li>${inlineMarkdown(line.slice(2))}</li>`);
    } else if (!line.trim()) {
      if (inList) { html.push("</ul>"); inList = false; }
    } else {
      if (inList) { html.push("</ul>"); inList = false; }
      html.push(`<p>${inlineMarkdown(line)}</p>`);
    }
  }
  if (inList) html.push("</ul>");
  return html.join("\n");
}
function textFromMarkdown(markdown) {
  return markdown.replace(/[#*_`>\[\]()]/g, " ").replace(/https?:\/\/\S+/g, " ").replace(/\s+/g, " ").trim();
}
function datePart(editionId) {
  const match = String(editionId || "").match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function canonical(pathname) { return `${blogBase}${pathname.startsWith("/") ? pathname : `/${pathname}`}`; }
function jsonLd(value) { return `<script type="application/ld+json">${JSON.stringify(value).replace(/</g, "\\u003c")}</script>`; }
function topicsFor(text) {
  const haystack = String(text || "").toLowerCase();
  const matches = topicDefinitions.filter((topic) => topic.keywords.some((keyword) => haystack.includes(keyword)));
  return matches.length ? matches : [topicDefinitions[2]];
}
function topicLinks(topics) {
  return `<p class="topic-links"><strong>Topics:</strong> ${topics.map((topic) => `<a href="/topics/${topic.slug}/">${escapeHtml(topic.title)}</a>`).join(" · ")}</p>`;
}
function relatedBlock(entry, allEntries) {
  const related = allEntries
    .filter((candidate) => candidate.url !== entry.url)
    .map((candidate) => ({ candidate, overlap: candidate.topics.filter((topic) => entry.topics.some((own) => own.slug === topic.slug)).length }))
    .filter((item) => item.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap || b.candidate.date.localeCompare(a.candidate.date))
    .slice(0, 4)
    .map(({ candidate }) => `<li><a href="${candidate.url}">${escapeHtml(candidate.title)}</a><span> — ${escapeHtml(candidate.date)}</span></li>`);
  if (!related.length) return "";
  return `<aside class="related"><h2>Continue learning</h2><ul>${related.join("")}</ul></aside>`;
}
function newsletterCallout() {
  return `<section class="newsletter-callout"><h2>Get the weekly Clearforge digest</h2><p>One calm email covering what changed, why it matters and what is worth testing. No daily inbox noise.</p><p><a class="button" href="/newsletter/">Join the weekly digest</a></p></section>`;
}
function pageTemplate(title, description, body, options = {}) {
  const pathname = options.pathname || "/";
  const pageUrl = canonical(pathname);
  const type = options.type || "website";
  const image = options.image || canonical("/podcast/cover.png");
  const structured = options.structuredData || {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description,
    url: pageUrl,
    isPartOf: { "@type": "WebSite", name: "Clearforge", url: blogBase }
  };
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script>if (location.hash.includes("invite_token=")) location.replace("/publishing/" + location.hash);</script>
  <title>${escapeHtml(title)} | Clearforge</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${escapeHtml(pageUrl)}">
  <meta property="og:type" content="${escapeHtml(type)}">
  <meta property="og:site_name" content="Clearforge">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(pageUrl)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">
  <link rel="stylesheet" href="/styles.css">
  <link rel="alternate" type="application/rss+xml" title="Clearforge Features" href="/features.xml">
  <link rel="alternate" type="application/rss+xml" title="Clearforge AI Briefing Podcast" href="${podcastRss}">
  ${jsonLd(structured)}
</head>
<body>
  <header class="site-header">
    <a class="brand" href="/">Clearforge</a>
    <p>Human-led. AI-empowered.</p>
    <nav aria-label="Site links">
      <a href="/topics/">Topics</a>
      <a href="/reports/">Reports</a>
      <a href="${podcastPage}">Podcast</a>
      <a href="/newsletter/">Weekly digest</a>
    </nav>
  </header>
  <main class="content">${body}</main>
  <footer class="site-footer">
    <p>Turning human input into clear, usable systems.</p>
    <p><a href="/topics/">Browse topics</a> · <a href="/reports/">Reports</a> · <a href="${podcastPage}">Podcast</a> · <a href="/newsletter/">Weekly digest</a></p>
  </footer>
</body>
</html>`;
}

function buildReports() {
  ensureDir(reportsPublicDir);
  const weeklySource = path.join(reportsSourceDir, "weekly");
  const weekly = fs.existsSync(weeklySource)
    ? fs.readdirSync(weeklySource).filter((date) => fs.existsSync(path.join(weeklySource, date, "report.json"))).sort().reverse()
    : [];
  const cards = [];
  for (const date of weekly) {
    const sourceDir = path.join(weeklySource, date);
    const meta = JSON.parse(fs.readFileSync(path.join(sourceDir, "report.json"), "utf8"));
    if (meta.approved_for_publication !== true) continue;
    const targetDir = path.join(reportsPublicDir, "weekly", date);
    ensureDir(targetDir);
    const pdfName = meta.pdf_filename;
    const encoded = fs.readFileSync(path.join(sourceDir, "learning-brief.pdf.base64"), "utf8").replace(/\s+/g, "");
    fs.writeFileSync(path.join(targetDir, pdfName), Buffer.from(encoded, "base64"));
    const sourceNotes = fs.existsSync(path.join(sourceDir, "source-notes.md"))
      ? markdownToHtml(fs.readFileSync(path.join(sourceDir, "source-notes.md"), "utf8"))
      : "";
    const pathname = `/reports/weekly/${date}/`;
    const summary = `<article class="report-detail"><p class="eyebrow">Weekly AI Learning Brief</p><h1>${escapeHtml(meta.title)}</h1><p class="report-meta">Published ${escapeHtml(meta.date)} · Last verified ${escapeHtml(meta.last_verified)}</p><p>${escapeHtml(meta.description)}</p><div class="report-actions"><a class="button" href="./${encodeURIComponent(pdfName)}">Download PDF</a><a class="button button-secondary" href="/reports/">All reports</a><a class="button button-secondary" href="${podcastPage}">Listen to the podcast</a></div><h2>Inside this edition</h2><ul>${meta.highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>${sourceNotes ? `<section id="source-notes"><h2>Source notes</h2>${sourceNotes}</section>` : ""}</article>${newsletterCallout()}`;
    write(path.join(targetDir, "index.html"), pageTemplate(meta.title, meta.description, summary, { pathname, type: "article", structuredData: { "@context": "https://schema.org", "@type": "Report", headline: meta.title, description: meta.description, datePublished: meta.date, dateModified: meta.last_verified, url: canonical(pathname), publisher: { "@type": "Organization", name: "Clearforge" } } }));
    cards.push(`<li class="report-card"><p class="eyebrow">Weekly AI Learning Brief</p><h3><a href="${pathname}">${escapeHtml(meta.title)}</a></h3><p class="report-meta">${escapeHtml(meta.date)} · Last verified ${escapeHtml(meta.last_verified)}</p><p>${escapeHtml(meta.description)}</p><div class="report-actions"><a class="button" href="${pathname}${encodeURIComponent(pdfName)}">Download PDF</a><a class="button button-secondary" href="${pathname}">Read summary</a></div></li>`);
  }
  const body = `<section class="hero"><p class="eyebrow">Clearforge Reports</p><h1>Practical AI learning, checked and explained.</h1><p>Weekly learning guides and focused research papers for creators, small businesses and practical AI learners.</p><p><a class="button" href="${podcastPage}">Listen to the Clearforge podcast</a></p></section><section class="posts"><h2>Weekly AI Learning Briefs</h2>${cards.length ? `<ul>${cards.join("")}</ul>` : "<p>No weekly reports published yet.</p>"}</section><section class="posts"><h2>Major Release Research Papers</h2><p>Standalone papers will appear here after significant releases are independently researched on their release date.</p></section>${newsletterCallout()}`;
  write(path.join(reportsPublicDir, "index.html"), pageTemplate("Clearforge Reports", "Clearforge weekly AI learning briefs and major-release research papers.", body, { pathname: "/reports/" }));
  return cards.length;
}

function buildNewsletter() {
  const body = `<section class="hero"><p class="eyebrow">Clearforge Weekly Digest</p><h1>One useful AI briefing each week.</h1><p>A calm summary of what changed, who is adopting it, why it matters and what is worth testing next.</p></section><section class="posts"><h2>Join the list</h2><form name="clearforge-weekly-digest" method="POST" data-netlify="true" netlify-honeypot="bot-field" action="/newsletter/thanks/"><input type="hidden" name="form-name" value="clearforge-weekly-digest"><p hidden><label>Do not fill this out: <input name="bot-field"></label></p><p><label>Email address<br><input type="email" name="email" autocomplete="email" required style="width:min(100%,32rem);padding:.8rem;margin-top:.4rem"></label></p><p><label><input type="checkbox" name="consent" value="yes" required> I agree to receive the Clearforge weekly email and understand I can unsubscribe at any time.</label></p><button class="button" type="submit">Join the weekly digest</button></form><h2>What you will receive</h2><ul><li>The week’s most useful AI developments.</li><li>Real company adoption explained through who, why, how and when.</li><li>One practical workflow or tool worth testing.</li><li>Links to the full Clearforge articles, podcast and reports.</li></ul><p>Clearforge will use your email only to send the digest and essential subscription messages. It will not be sold to advertisers.</p></section>`;
  write(path.join(newsletterDir, "index.html"), pageTemplate("Clearforge Weekly Digest", "Join the weekly Clearforge email: practical AI developments, adoption stories and one useful workflow each week.", body, { pathname: "/newsletter/" }));
  write(path.join(newsletterDir, "thanks", "index.html"), pageTemplate("Subscription received", "Your request to join the Clearforge weekly digest has been received.", `<section class="hero"><h1>You’re on the list.</h1><p>Your request to join the Clearforge weekly digest has been received.</p><p><a class="button" href="/">Return to Clearforge</a></p></section>`, { pathname: "/newsletter/thanks/" }));
}

function buildTopics(entries) {
  ensureDir(topicsDir);
  const indexCards = topicDefinitions.map((topic) => {
    const count = entries.filter((entry) => entry.topics.some((item) => item.slug === topic.slug)).length;
    return `<li class="report-card"><h2><a href="/topics/${topic.slug}/">${escapeHtml(topic.title)}</a></h2><p>${escapeHtml(topic.description)}</p><p>${count} item${count === 1 ? "" : "s"} in the archive.</p></li>`;
  });
  write(path.join(topicsDir, "index.html"), pageTemplate("Clearforge Topics", "Explore Clearforge coverage by practical AI topic, including adoption, everyday products, automation, creators, models and accountability.", `<section class="hero"><h1>Explore Clearforge by topic.</h1><p>Follow the subjects that remain useful after the daily headline has moved on.</p></section><section class="posts"><ul>${indexCards.join("")}</ul></section>${newsletterCallout()}`, { pathname: "/topics/" }));
  for (const topic of topicDefinitions) {
    const items = entries.filter((entry) => entry.topics.some((item) => item.slug === topic.slug)).sort((a, b) => b.date.localeCompare(a.date));
    const list = items.length ? `<ul>${items.map((entry) => `<li><a href="${entry.url}">${escapeHtml(entry.title)}</a><span> — ${escapeHtml(entry.date)} · ${escapeHtml(entry.kind)}</span><p>${escapeHtml(entry.description)}</p></li>`).join("")}</ul>` : "<p>No approved items in this topic yet.</p>";
    const pathname = `/topics/${topic.slug}/`;
    write(path.join(topicsDir, topic.slug, "index.html"), pageTemplate(topic.title, topic.description, `<section class="hero"><p class="eyebrow">Clearforge Topic</p><h1>${escapeHtml(topic.title)}</h1><p>${escapeHtml(topic.description)}</p></section><section class="posts"><h2>Latest coverage</h2>${list}</section>${newsletterCallout()}`, { pathname, structuredData: { "@context": "https://schema.org", "@type": "CollectionPage", name: topic.title, description: topic.description, url: canonical(pathname), isPartOf: { "@type": "WebSite", name: "Clearforge", url: blogBase } } }));
  }
}

function buildDiscoveryFiles(entries) {
  const staticPaths = ["/", "/topics/", "/reports/", "/podcast/", "/newsletter/"];
  const topicPaths = topicDefinitions.map((topic) => `/topics/${topic.slug}/`);
  const urls = [...new Set([...staticPaths, ...topicPaths, ...entries.map((entry) => entry.url)])];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((pathname) => `  <url><loc>${xmlEscape(canonical(pathname))}</loc></url>`).join("\n")}\n</urlset>\n`;
  write(path.join(publicDir, "sitemap.xml"), sitemap);
  write(path.join(publicDir, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${canonical("/sitemap.xml")}\n`);
}

function main() {
  ensureDir(publicDir);
  ensureDir(postsDir);
  ensureDir(featuresDir);
  const reportCount = buildReports();
  buildNewsletter();
  const dates = fs.existsSync(draftsDir)
    ? fs.readdirSync(draftsDir).filter((name) => fs.existsSync(path.join(draftsDir, name, "daily_brief.md"))).sort().reverse()
    : [];

  const entries = [];
  const feedItems = [];
  for (const date of dates) {
    const approvalPath = path.join(draftsDir, date, "approval.json");
    if (!fs.existsSync(approvalPath)) continue;
    const approval = JSON.parse(fs.readFileSync(approvalPath, "utf8"));
    if (approval.article_approved === true) {
      const markdown = fs.readFileSync(path.join(draftsDir, date, "daily_brief.md"), "utf8");
      const structuredPath = path.join(draftsDir, date, "structured_output.json");
      const structured = fs.existsSync(structuredPath) ? JSON.parse(fs.readFileSync(structuredPath, "utf8")) : {};
      const title = structured.headline || `Daily AI Brief ${date}`;
      const description = structured.dek || textFromMarkdown(markdown).slice(0, 160);
      const topics = topicsFor(`${title} ${description} ${markdown}`);
      entries.push({ kind: "Daily brief", date, title, description, url: `/posts/${date}.html`, markdown, topics });
    }
    const featurePath = path.join(draftsDir, date, "feature.md");
    const featureJsonPath = path.join(draftsDir, date, "feature.json");
    if (approval.feature_approved === true && fs.existsSync(featurePath) && fs.existsSync(featureJsonPath)) {
      const markdown = fs.readFileSync(featurePath, "utf8");
      const meta = JSON.parse(fs.readFileSync(featureJsonPath, "utf8"));
      const title = meta.feature_headline;
      const description = meta.seo_description || meta.feature_dek || textFromMarkdown(markdown).slice(0, 160);
      const topics = topicsFor(`${title} ${description} ${markdown}`);
      const url = `/features/${date}.html`;
      entries.push({ kind: "Feature analysis", date, title, description, url, markdown, topics });
      const absoluteUrl = canonical(url);
      feedItems.push(`<item><title>${xmlEscape(title)}</title><link>${xmlEscape(absoluteUrl)}</link><guid>${xmlEscape(absoluteUrl)}</guid><pubDate>${new Date(`${datePart(date)}T08:00:00Z`).toUTCString()}</pubDate><description>${xmlEscape(description)}</description></item>`);
    }
  }

  for (const entry of entries) {
    const articleBody = `<article class="${entry.kind === "Feature analysis" ? "feature" : "daily-brief"}">${topicLinks(entry.topics)}${markdownToHtml(entry.markdown)}</article>${relatedBlock(entry, entries)}${newsletterCallout()}`;
    const target = entry.kind === "Feature analysis" ? path.join(featuresDir, `${entry.date}.html`) : path.join(postsDir, `${entry.date}.html`);
    write(target, pageTemplate(entry.title, entry.description, articleBody, { pathname: entry.url, type: "article", structuredData: { "@context": "https://schema.org", "@type": "NewsArticle", headline: entry.title, description: entry.description, datePublished: datePart(entry.date), dateModified: datePart(entry.date), mainEntityOfPage: canonical(entry.url), author: { "@type": "Organization", name: "Clearforge" }, publisher: { "@type": "Organization", name: "Clearforge", logo: { "@type": "ImageObject", url: canonical("/podcast/cover.png") } } } }));
  }

  buildTopics(entries);
  const features = entries.filter((entry) => entry.kind === "Feature analysis");
  const briefs = entries.filter((entry) => entry.kind === "Daily brief");
  const latestBrief = briefs[0];
  const latestFeature = features[0];
  const latestSection = latestBrief
    ? `<section class="posts"><p class="eyebrow">Latest Clearforge briefing</p><h2><a href="${latestBrief.url}">${escapeHtml(latestBrief.title)}</a></h2><p>${escapeHtml(latestBrief.description)}</p><div class="report-actions"><a class="button" href="${latestBrief.url}">Read the latest brief</a><a class="button button-secondary" href="${podcastPage}">Listen to the latest episode</a></div></section>`
    : "";
  const listenSection = `<section class="posts"><p class="eyebrow">Listen on the go</p><h2>Clearforge AI Briefing</h2><p>Hear the practical breakdown in your podcast app. Search for <strong>Clearforge AI Briefing</strong>, or open the Clearforge podcast page.</p><p><a class="button" href="${podcastPage}">Open the podcast</a></p></section>`;
  const indexBody = `<section class="hero"><p class="eyebrow">Practical AI news and learning</p><h1>Clear AI learning from noisy AI news.</h1><p>Clearforge explains what changed, who is adopting it, why it matters and what is worth testing.</p><div class="report-actions">${latestBrief ? `<a class="button" href="${latestBrief.url}">Read today’s brief</a>` : `<a class="button" href="/topics/">Explore topics</a>`}<a class="button button-secondary" href="${podcastPage}">Listen to the podcast</a></div></section>${latestSection}${listenSection}<section class="posts"><h2>Feature Analysis</h2>${features.length ? `<ul>${features.slice(0, 8).map((entry) => `<li><a href="${entry.url}">${escapeHtml(entry.title)}</a><span> — ${escapeHtml(entry.date)}</span></li>`).join("")}</ul>${latestFeature ? `<p><a class="button button-secondary" href="${latestFeature.url}">Read the latest feature</a></p>` : ""}` : "<p>No approved features yet.</p>"}</section><section class="posts"><h2>Explore by topic</h2><p>Follow durable coverage of AI adoption, everyday products, creator workflows, automation, models and accountability.</p><p><a class="button" href="/topics/">Browse all topics</a></p></section><section class="posts"><h2>Clearforge Reports</h2><p>Go deeper with weekly AI learning briefs and standalone research papers.</p><p><a class="button" href="/reports/">Browse reports</a></p></section>${newsletterCallout()}`;
  write(path.join(publicDir, "index.html"), pageTemplate("Clearforge", "Practical AI news, adoption analysis, podcast briefings and workflow learning without the hype.", indexBody, { pathname: "/", structuredData: { "@context": "https://schema.org", "@type": "WebSite", name: "Clearforge", url: blogBase, description: "Practical AI news, adoption analysis, podcast briefings and workflow learning without the hype.", potentialAction: { "@type": "SearchAction", target: `${blogBase}/topics/?q={search_term_string}`, "query-input": "required name=search_term_string" } } }));
  const rss = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Clearforge Features</title><link>${xmlEscape(blogBase)}</link><description>Long-form practical AI analysis from Clearforge.</description>${feedItems.join("")}</channel></rss>`;
  write(path.join(publicDir, "features.xml"), rss);
  buildDiscoveryFiles(entries);
  console.log(`Built site with ${briefs.length} briefs, ${features.length} features, ${reportCount} reports, ${topicDefinitions.length} topic hubs and newsletter capture.`);
}

main();