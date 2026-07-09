import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATE = process.env.CLEARFORGE_DATE || new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());
const draftDir = path.join(ROOT, "drafts", DATE);
const approvalPath = path.join(draftDir, "approval.json");
const featurePath = path.join(draftDir, "feature.md");
const metaPath = path.join(draftDir, "feature.json");
const statePath = path.join(draftDir, "dev-post-result.json");

function requireFile(file) { if (!fs.existsSync(file)) throw new Error(`Missing ${file}`); }
requireFile(approvalPath); requireFile(featurePath); requireFile(metaPath);

const approval = JSON.parse(fs.readFileSync(approvalPath, "utf8"));
if (approval.dev_approved !== true || approval.feature_approved !== true) {
  console.log("DEV syndication skipped: feature is not approved.");
  process.exit(0);
}

if (fs.existsSync(statePath)) {
  const existing = JSON.parse(fs.readFileSync(statePath, "utf8"));
  if (existing?.id && existing?.url) {
    console.log(`DEV syndication skipped: already posted ${existing.url}`);
    process.exit(0);
  }
}

const apiKey = String(process.env.DEV_API_KEY || "").trim();
if (!apiKey) {
  console.log("DEV syndication skipped: DEV_API_KEY is not configured.");
  process.exit(0);
}

const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
const markdown = fs.readFileSync(featurePath, "utf8");
const blogBase = String(process.env.BLOG_BASE_URL || "").replace(/\/$/, "");
const canonicalUrl = blogBase ? `${blogBase}/features/${DATE}.html` : undefined;
const tags = (meta.tags || ["ai", "productivity", "technology"]).map((x) => String(x).toLowerCase().replace(/[^a-z0-9]/g, "")).filter(Boolean).slice(0, 4).join(", ");

const response = await fetch("https://dev.to/api/articles", {
  method: "POST",
  headers: {
    "api-key": apiKey,
    "accept": "application/vnd.forem.api-v1+json",
    "content-type": "application/json"
  },
  body: JSON.stringify({
    article: {
      title: meta.feature_headline,
      body_markdown: markdown,
      published: true,
      description: String(meta.seo_description || meta.feature_dek || "").slice(0, 200),
      tags,
      ...(canonicalUrl ? { canonical_url: canonicalUrl } : {})
    }
  })
});

const raw = await response.text();
let body = {};
try { body = raw ? JSON.parse(raw) : {}; } catch { body = { raw }; }
if (!response.ok) throw new Error(`DEV publish failed ${response.status}: ${JSON.stringify(body).slice(0, 1600)}`);

fs.writeFileSync(statePath, JSON.stringify({
  date: DATE,
  posted_at: new Date().toISOString(),
  id: body.id || null,
  url: body.url || null,
  canonical_url: canonicalUrl || null,
  title: meta.feature_headline
}, null, 2) + "\n");

console.log(`Published Clearforge feature to DEV: ${body.url || body.id || "created"}`);
