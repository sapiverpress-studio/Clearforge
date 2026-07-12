import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const draftsDir = path.join(ROOT, "drafts");
const publicDir = path.join(ROOT, "public");
const postsDir = path.join(publicDir, "posts");
const featuresDir = path.join(publicDir, "features");
const blogBase = String(process.env.BLOG_BASE_URL || "").replace(/\/$/, "");
const reportsSourceDir = path.join(ROOT, "reports");
const reportsPublicDir = path.join(publicDir, "reports");

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
function pageTemplate(title, description, body) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} | Clearforge</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="stylesheet" href="/styles.css">
  <link rel="alternate" type="application/rss+xml" title="Clearforge Features" href="/features.xml">
</head>
<body>
  <header class="site-header">
    <a class="brand" href="/">Clearforge</a>
    <p>Human-led. AI-empowered.</p>
    <nav aria-label="Site links">
      <a href="/reports/">Clearforge Reports</a>
    </nav>
  </header>
  <main class="content">${body}</main>
  <footer class="site-footer">
    <p>Turning human input into clear, usable systems.</p>
    <p><a href="/reports/">Browse Clearforge Reports</a></p>
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
    const summary = `<article class="report-detail">
      <p class="eyebrow">Weekly AI Learning Brief</p>
      <h1>${escapeHtml(meta.title)}</h1>
      <p class="report-meta">Published ${escapeHtml(meta.date)} · Last verified ${escapeHtml(meta.last_verified)}</p>
      <p>${escapeHtml(meta.description)}</p>
      <div class="report-actions">
        <a class="button" href="./${encodeURIComponent(pdfName)}">Download PDF</a>
        <a class="button button-secondary" href="/reports/">All reports</a>
      </div>
      <h2>Inside this edition</h2>
      <ul>${meta.highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      ${sourceNotes ? `<section id="source-notes"><h2>Source notes</h2>${sourceNotes}</section>` : ""}
    </article>`;
    fs.writeFileSync(path.join(targetDir, "index.html"), pageTemplate(meta.title, meta.description, summary), "utf8");
    cards.push(`<li class="report-card"><p class="eyebrow">Weekly AI Learning Brief</p><h3><a href="/reports/weekly/${date}/">${escapeHtml(meta.title)}</a></h3><p class="report-meta">${escapeHtml(meta.date)} · Last verified ${escapeHtml(meta.last_verified)}</p><p>${escapeHtml(meta.description)}</p><div class="report-actions"><a class="button" href="/reports/weekly/${date}/${encodeURIComponent(pdfName)}">Download PDF</a><a class="button button-secondary" href="/reports/weekly/${date}/">Read summary</a>${sourceNotes ? `<a href="/reports/weekly/${date}/#source-notes">Source notes</a>` : ""}</div></li>`);
  }
  const body = `<section class="hero"><p class="eyebrow">Clearforge Reports</p><h1>Practical AI learning, checked and explained.</h1><p>Weekly learning guides and focused research papers for creators, small businesses and practical AI learners.</p></section>
  <section class="posts"><h2>Weekly AI Learning Briefs</h2>${cards.length ? `<ul>${cards.join("")}</ul>` : "<p>No weekly reports published yet.</p>"}</section>
  <section class="posts"><h2>Major Release Research Papers</h2><p>Standalone papers will appear here after significant releases are independently researched on their release date.</p></section>`;
  fs.writeFileSync(path.join(reportsPublicDir, "index.html"), pageTemplate("Clearforge Reports", "Clearforge weekly AI learning briefs and major release research papers.", body), "utf8");
  return cards.length;
}

function textFromMarkdown(markdown) {
  return markdown.replace(/[#*_`>\[\]()]/g, " ").replace(/https?:\/\/\S+/g, " ").replace(/\s+/g, " ").trim();
}
function xmlEscape(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function main() {
  ensureDir(publicDir); ensureDir(postsDir); ensureDir(featuresDir);\n  const reportCount = buildReports();
  const dates = fs.existsSync(draftsDir)
    ? fs.readdirSync(draftsDir).filter((name) => fs.existsSync(path.join(draftsDir, name, "daily_brief.md"))).sort().reverse()
    : [];

  const briefLinks = [];
  const featureLinks = [];
  const feedItems = [];

  for (const date of dates) {
    const approvalPath = path.join(draftsDir, date, "approval.json");
    if (!fs.existsSync(approvalPath)) continue;
    const approval = JSON.parse(fs.readFileSync(approvalPath, "utf8"));

    if (approval.article_approved === true) {
      const markdown = fs.readFileSync(path.join(draftsDir, date, "daily_brief.md"), "utf8");
      const filename = `${date}.html`;
      fs.writeFileSync(path.join(postsDir, filename), pageTemplate(`Daily AI Brief ${date}`, textFromMarkdown(markdown).slice(0, 160), markdownToHtml(markdown)), "utf8");
      briefLinks.push(`<li><a href="/posts/${filename}">Daily AI Brief — ${date}</a></li>`);
    }

    const featurePath = path.join(draftsDir, date, "feature.md");
    const featureJsonPath = path.join(draftsDir, date, "feature.json");
    if (approval.feature_approved === true && fs.existsSync(featurePath) && fs.existsSync(featureJsonPath)) {
      const markdown = fs.readFileSync(featurePath, "utf8");
      const meta = JSON.parse(fs.readFileSync(featureJsonPath, "utf8"));
      const filename = `${date}.html`;
      fs.writeFileSync(path.join(featuresDir, filename), pageTemplate(meta.feature_headline, meta.seo_description || meta.feature_dek, `<article class="feature">${markdownToHtml(markdown)}</article>`), "utf8");
      featureLinks.push(`<li><a href="/features/${filename}">${escapeHtml(meta.feature_headline)}</a><span> — ${date}</span></li>`);
      const url = blogBase ? `${blogBase}/features/${filename}` : `/features/${filename}`;
      feedItems.push(`<item><title>${xmlEscape(meta.feature_headline)}</title><link>${xmlEscape(url)}</link><guid>${xmlEscape(url)}</guid><pubDate>${new Date(`${date}T08:00:00Z`).toUTCString()}</pubDate><description>${xmlEscape(meta.seo_description || meta.feature_dek || "")}</description></item>`);
    }
  }

  const indexBody = `
<section class="hero"><h1>Clear AI learning from noisy AI news.</h1><p>Clearforge turns daily AI updates into practical learning, careful takeaways, and usable workflow tests.</p><p><a href="/reports/">Explore Clearforge Reports</a></p></section>\n<section class="posts"><h2>Clearforge Reports</h2><p>Go deeper with weekly AI learning briefs and standalone research papers on major releases.</p><p><a class="button" href="/reports/">Browse all reports</a></p></section>
<section class="posts"><h2>Feature Analysis</h2>${featureLinks.length ? `<ul>${featureLinks.join("\n")}</ul>` : `<p>No approved features yet.</p>`}</section>
<section class="posts"><h2>Daily Briefs</h2>${briefLinks.length ? `<ul>${briefLinks.join("\n")}</ul>` : `<p>No approved public briefs yet.</p>`}</section>`;

  fs.writeFileSync(path.join(publicDir, "index.html"), pageTemplate("Clearforge", "Practical AI news, analysis and workflow learning.", indexBody), "utf8");
  const rss = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Clearforge Features</title><link>${xmlEscape(blogBase || "https://clearforge-daily-brief.netlify.app")}</link><description>Long-form practical AI analysis from Clearforge.</description>${feedItems.join("")}</channel></rss>`;
  fs.writeFileSync(path.join(publicDir, "features.xml"), rss, "utf8");
  console.log(`Built site with ${briefLinks.length} briefs, ${featureLinks.length} features, and ${reportCount} reports.`);
}

main();
