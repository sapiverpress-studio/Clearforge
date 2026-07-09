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
const mediaDir = path.join(ROOT, "media", DATE);
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
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
  return true;
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
const mediaManifestPath = path.join(mediaDir, "media-manifest.json");
const hasMedia = fs.existsSync(mediaManifestPath);
const mediaManifest = hasMedia ? readJson(mediaManifestPath) : null;

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

if (hasMedia) copyDir(mediaDir, path.join(outDir, "media"));

const manifest = {
  version: 2,
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
  stories: (data.story_summaries || []).slice(0, 3).map((story, i) => ({
    title: story.title,
    summary: story.summary,
    why_it_matters: story.why_it_matters,
    practical_angle: story.practical_angle,
    source_name: data.sources?.[i]?.source_name || "Source",
    source_url: data.sources?.[i]?.url || ""
  })),
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
  ai_media: hasMedia ? {
    manifest: "media/media-manifest.json",
    narration: "media/narration.mp3",
    story_images: ["media/story-1.png", "media/story-2.png", "media/story-3.png"],
    generated: true
  } : {
    generated: false
  },
  quote_card_lines: data.social.quote_card_lines || [],
  headline_options: data.headline_options || [],
  sources: data.sources || [],
  media_metadata: mediaManifest
};

write("manifest.json", JSON.stringify(manifest, null, 2));
write("daily_brief.md", fs.readFileSync(articlePath, "utf8"));
write("social_pack.md", fs.readFileSync(socialPath, "utf8"));
write("structured_output.json", JSON.stringify(data, null, 2));
write("approval.json", JSON.stringify(approval, null, 2));

const latestDir = path.join(ROOT, "bridge", "clearforge", "latest");
fs.rmSync(latestDir, { recursive: true, force: true });
copyDir(outDir, latestDir);

console.log(`Exported approved Clearforge bundle for ${DATE}${hasMedia ? " with AI media" : " without AI media"}.`);
