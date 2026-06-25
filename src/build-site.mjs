import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const draftsDir = path.join(ROOT, "drafts");
const publicDir = path.join(ROOT, "public");
const postsDir = path.join(publicDir, "posts");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function markdownToBasicHtml(markdown) {
  const lines = markdown.split(/\r?\n/);
  const html = [];
  let inList = false;

  for (const line of lines) {
    if (line.startsWith("# ")) {
      if (inList) { html.push("</ul>"); inList = false; }
      html.push(`<h1>${escapeHtml(line.slice(2))}</h1>`);
    } else if (line.startsWith("## ")) {
      if (inList) { html.push("</ul>"); inList = false; }
      html.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
    } else if (line.startsWith("### ")) {
      if (inList) { html.push("</ul>"); inList = false; }
      html.push(`<h3>${escapeHtml(line.slice(4))}</h3>`);
    } else if (line.startsWith("- ")) {
      if (!inList) { html.push("<ul>"); inList = true; }
      html.push(`<li>${escapeHtml(line.slice(2))}</li>`);
    } else if (!line.trim()) {
      if (inList) { html.push("</ul>"); inList = false; }
    } else {
      if (inList) { html.push("</ul>"); inList = false; }
      html.push(`<p>${escapeHtml(line)}</p>`);
    }
  }

  if (inList) html.push("</ul>");
  return html.join("\n");
}

function pageTemplate(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} | Clearforge</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <header class="site-header">
    <a class="brand" href="/">Clearforge</a>
    <p>Human-led. AI-empowered.</p>
  </header>
  <main class="content">
    ${body}
  </main>
  <footer class="site-footer">
    <p>Turning human input into clear, usable systems.</p>
  </footer>
</body>
</html>`;
}

function main() {
  ensureDir(publicDir);
  ensureDir(postsDir);

  const dates = fs.existsSync(draftsDir)
    ? fs.readdirSync(draftsDir).filter((name) => fs.existsSync(path.join(draftsDir, name, "daily_brief.md"))).sort().reverse()
    : [];

  const links = [];

  for (const date of dates) {
    const mdPath = path.join(draftsDir, date, "daily_brief.md");
    const approvalPath = path.join(draftsDir, date, "approval.json");
    let approved = false;

    if (fs.existsSync(approvalPath)) {
      const approval = JSON.parse(fs.readFileSync(approvalPath, "utf8"));
      approved = approval.article_approved === true;
    }

    if (!approved) continue;

    const markdown = fs.readFileSync(mdPath, "utf8");
    const html = markdownToBasicHtml(markdown);
    const filename = `${date}.html`;
    fs.writeFileSync(path.join(postsDir, filename), pageTemplate(`Daily AI Brief ${date}`, html), "utf8");
    links.push(`<li><a href="/posts/${filename}">Daily AI Brief — ${date}</a></li>`);
  }

  const indexBody = `
<section class="hero">
  <h1>Clear AI learning from noisy AI news.</h1>
  <p>Clearforge turns daily AI updates into practical learning, careful takeaways, and usable workflow tests.</p>
</section>
<section class="posts">
  <h2>Daily Briefs</h2>
  ${links.length ? `<ul>${links.join("\n")}</ul>` : `<p>No approved public briefs yet.</p>`}
</section>`;

  fs.writeFileSync(path.join(publicDir, "index.html"), pageTemplate("Clearforge", indexBody), "utf8");
  console.log(`Built site with ${links.length} approved posts.`);
}

main();
