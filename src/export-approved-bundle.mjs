import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATE = process.env.CLEARFORGE_DATE || new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(new Date());

const draftDir = path.join(ROOT, "drafts", DATE);
const approvalPath = path.join(draftDir, "approval.json");
const structuredPath = path.join(draftDir, "structured_output.json");
const articlePath = path.join(draftDir, "daily_brief.md");
const socialPath = path.join(draftDir, "social_pack.md");
const outDir = path.join(ROOT, "bridge", "clearforge", DATE);

function requireFile(file) {
  if (!fs.existsSync(file)) throw new Error(`Required file missing: ${file}`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function write(name, content) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, name), content.endsWith("\n") ? content : `${content}\n`, "utf8");
}

requireFile(approvalPath);
requireFile(structuredPath);
requireFile(articlePath);
requireFile(socialPath);

const approval = readJson(approvalPath);
if (approval.article_approved !== true) {
  console.log(`Clearforge ${DATE} not exported: article_approved is not true.`);
  process.exit(0);
}

const data = readJson(structuredPath);
const blogBase = String(process.env.BLOG_BASE_URL || "").replace(/\/$/, "");
const articleUrl = blogBase ? `${blogBase}/posts/${DATE}.html` : "";

const manifest = {
  version: 1,
  brand: "Clearforge",
  date: DATE,
  type: "clearforge_daily_ai_brief",
  approved: {
    article: approval.article_approved === true,
    facebook: approval.facebook_approved === true,
    pinterest: approval.pinterest_approved === true,
    youtube: approval.youtube_approved === true
  },
  article: {
    headline: data.headline,
    dek: data.dek,
    url: articleUrl,
    markdown: "daily_brief.md"
  },
  facebook: {
    post: data.social.facebook_post
  },
  pinterest: {
    title: data.social.pinterest_title,
    description: data.social.pinterest_description,
    destination_url: articleUrl
  },
  youtube: {
    title: (data.headline_options?.[0] || data.headline || "Clearforge Daily AI Brief").slice(0, 95),
    script: data.social.youtube_shorts_script,
    description: `${data.practical_takeaway}${articleUrl ? `\n\nRead the full brief: ${articleUrl}` : ""}`
  },
  quote_card_lines: data.social.quote_card_lines || [],
  headline_options: data.headline_options || [],
  sources: data.sources || []
};

write("manifest.json", JSON.stringify(manifest, null, 2));
write("daily_brief.md", fs.readFileSync(articlePath, "utf8"));
write("social_pack.md", fs.readFileSync(socialPath, "utf8"));
write("structured_output.json", JSON.stringify(data, null, 2));
write("approval.json", JSON.stringify(approval, null, 2));

const latestDir = path.join(ROOT, "bridge", "clearforge", "latest");
fs.rmSync(latestDir, { recursive: true, force: true });
fs.mkdirSync(latestDir, { recursive: true });
for (const name of fs.readdirSync(outDir)) {
  fs.copyFileSync(path.join(outDir, name), path.join(latestDir, name));
}

console.log(`Exported approved Clearforge bundle for ${DATE}.`);
