import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const BASE = (process.env.PODCAST_BASE_URL || "https://clearforge-daily-brief.netlify.app").replace(/\/$/, "");
const RETENTION_DAYS = Number(process.env.ARCHIVE_AFTER_DAYS || 90);
const DRY_RUN = process.env.ARCHIVE_DRY_RUN === "1";
const now = process.env.ARCHIVE_NOW ? new Date(process.env.ARCHIVE_NOW) : new Date();
if (!Number.isFinite(RETENTION_DAYS) || RETENTION_DAYS < 1) throw new Error("ARCHIVE_AFTER_DAYS must be a positive number.");
if (Number.isNaN(now.valueOf())) throw new Error("ARCHIVE_NOW is not a valid date.");

const podcastDir = path.join(ROOT, "public", "podcast");
const episodeDir = path.join(podcastDir, "episodes");
const dbPath = path.join(podcastDir, "episodes.json");
const archiveDir = path.join(ROOT, "public", "archive");
if (!fs.existsSync(dbPath)) throw new Error(`Missing ${dbPath}`);
fs.mkdirSync(archiveDir, { recursive: true });

const episodes = JSON.parse(fs.readFileSync(dbPath, "utf8"));
const cutoff = new Date(now.valueOf() - RETENTION_DAYS * 86400_000);
const copyIfPresent = (source, destinationDir, name = path.basename(source)) => {
  if (!fs.existsSync(source)) return false;
  fs.cpSync(source, path.join(destinationDir, name), { recursive: true });
  return true;
};
const escHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

let changed = false;
for (const episode of episodes) {
  if (episode.archived || new Date(episode.published) > cutoff) continue;
  const slug = episode.slug;
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(slug)) throw new Error(`Unsafe episode slug: ${slug}`);
  const zipName = `Clearforge_${slug}_Archive.zip`;
  const zipPath = path.join(archiveDir, zipName);
  console.log(`${DRY_RUN ? "Would archive" : "Archiving"} ${slug} -> public/archive/${zipName}`);
  if (DRY_RUN) continue;

  const staging = fs.mkdtempSync(path.join(os.tmpdir(), `clearforge-${slug}-`));
  const bundle = path.join(staging, `Clearforge_${slug}`);
  fs.mkdirSync(bundle);
  copyIfPresent(path.join(episodeDir, `${slug}.mp3`), bundle);
  copyIfPresent(path.join(episodeDir, `${slug}.mp4`), bundle);
  copyIfPresent(path.join(episodeDir, `${slug}.txt`), bundle, "transcript.txt");
  copyIfPresent(path.join(episodeDir, `${slug}.html`), bundle, "episode-page.html");
  const dateSlug = slug.match(/^\d{4}-\d{2}-\d{2}(?:-[a-z0-9-]+)?/i)?.[0] || slug;
  copyIfPresent(path.join(ROOT, "public", "posts", `${dateSlug}.html`), bundle, "daily-article.html");
  copyIfPresent(path.join(ROOT, "public", "features", `${dateSlug}.html`), bundle, "feature-analysis.html");
  if (episode.source_dir) {
    const sourceDir = path.join(ROOT, episode.source_dir);
    const sourceBundle = path.join(bundle, "source-material");
    const allowedSourceFiles = [
      "episode-metadata.json",
      "source-notes.md",
      "report.json",
      "production-notes.txt",
      "transcript.txt",
      "social-hooks.json",
      "learning-brief.pdf"
    ];
    for (const name of allowedSourceFiles) {
      if (fs.existsSync(path.join(sourceDir, name))) {
        fs.mkdirSync(sourceBundle, { recursive: true });
        copyIfPresent(path.join(sourceDir, name), sourceBundle);
      }
    }
  }
  fs.writeFileSync(path.join(bundle, "archive-metadata.json"), JSON.stringify({ ...episode, archived_at: now.toISOString() }, null, 2) + "\n");

  fs.rmSync(zipPath, { force: true });
  const zipped = spawnSync("zip", ["-q", "-r", zipPath, path.basename(bundle)], { cwd: staging, stdio: "inherit" });
  fs.rmSync(staging, { recursive: true, force: true });
  if (zipped.status !== 0) throw new Error(`zip failed for ${slug}`);

  // The MP3 remains available because podcast RSS enclosures must stay reachable.
  // The large standalone MP4 is replaced by the complete ZIP on the public site.
  fs.rmSync(path.join(episodeDir, `${slug}.mp4`), { force: true });
  episode.archived = true;
  episode.archived_at = now.toISOString();
  episode.archive_url = `${BASE}/archive/${encodeURIComponent(zipName)}`;
  episode.video_url = "";
  episode.video_size = 0;

  const pagePath = path.join(episodeDir, `${slug}.html`);
  if (fs.existsSync(pagePath)) {
    const page = fs.readFileSync(pagePath, "utf8");
    const replacement = `<p data-episode-downloads><a style="color:#66a7ff" href="${episode.archive_url}">Download complete ZIP archive</a> · <a style="color:#66a7ff" href="${episode.audio_url}">Listen or download MP3</a></p>`;
    fs.writeFileSync(pagePath, page.replace(/<p data-episode-downloads>[\s\S]*?<\/p>/, replacement));
  }
  const podcastIndexPath = path.join(podcastDir, "index.html");
  if (fs.existsSync(podcastIndexPath)) {
    const podcastIndex = fs.readFileSync(podcastIndexPath, "utf8");
    const archivedCard = `<article><p class="kind">${escHtml(episode.kind)} · archived</p><h2><a href="/podcast/episodes/${encodeURIComponent(slug)}.html">${escHtml(episode.title)}</a></h2><p>${escHtml(episode.description)}</p><audio controls preload="none" src="${escHtml(episode.audio_url)}"></audio><p><a href="${escHtml(episode.episode_url)}">Show notes</a> · <a href="${escHtml(episode.related_article_url)}">Daily briefing</a> · <a href="${escHtml(episode.archive_url)}">Complete ZIP archive</a></p></article>`;
    const escapedSlug = slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const cardPattern = new RegExp(`<article>(?:(?!<\\/article>)[\\s\\S])*?podcast\\/episodes\\/${escapedSlug}\\.html(?:(?!<\\/article>)[\\s\\S])*?<\\/article>`);
    fs.writeFileSync(podcastIndexPath, podcastIndex.replace(cardPattern, archivedCard));
  }
  changed = true;
}

if (changed) fs.writeFileSync(dbPath, JSON.stringify(episodes, null, 2) + "\n");

const archived = episodes.filter((episode) => episode.archived && episode.archive_url);
const cards = archived.map((episode) => `<article><p>${escHtml(episode.published.slice(0, 10))}</p><h2>${escHtml(episode.title)}</h2><p>${escHtml(episode.description)}</p><p><a href="${escHtml(episode.episode_url)}">Read and listen</a> · <a href="${escHtml(episode.archive_url)}">Download complete ZIP</a> · <a href="${escHtml(episode.related_article_url)}">Article</a></p></article>`).join("\n");
const index = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Clearforge Edition Archive</title><meta name="description" content="Permanent downloadable archives of Clearforge podcast editions, articles, transcripts and source notes."><style>body{margin:0;background:#07111f;color:#eef4ff;font:17px/1.6 system-ui}main{max-width:900px;margin:auto;padding:48px 20px}a{color:#66a7ff}article{background:#101d30;border:1px solid #263b59;border-radius:18px;padding:24px;margin:24px 0}h1,h2{line-height:1.15}</style></head><body><main><p><a href="/">Clearforge</a> · <a href="/podcast/">Podcast</a></p><h1>Clearforge Edition Archive</h1><p>After 90 days, each edition is preserved as one package containing its podcast media, transcript, articles, metadata and source material. Articles remain readable online.</p>${cards || "<p>No editions have reached the 90-day archive point yet.</p>"}</main></body></html>`;
fs.writeFileSync(path.join(archiveDir, "index.html"), index);
console.log(changed ? "Archive updated." : "No editions were old enough to archive.");
