import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const draftsDir = path.join(ROOT, "drafts");
const postsDir = path.join(ROOT, "public", "posts");
const publicMediaDir = path.join(ROOT, "public", "media");
const START = "<!-- SAPIVER_TIKTOK_PACK_START -->";
const END = "<!-- SAPIVER_TIKTOK_PACK_END -->";

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; }
}
function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function removeExisting(html) {
  const start = html.indexOf(START);
  const end = html.indexOf(END);
  if (start === -1 || end === -1 || end < start) return html;
  return `${html.slice(0, start)}${html.slice(end + END.length)}`;
}
function mediaForEdition(edition) {
  const sourceDir = path.join(ROOT, "media", edition);
  if (!fs.existsSync(sourceDir)) return { video: "", audio: "" };

  const names = fs.readdirSync(sourceDir);
  const videoName = [
    "tiktok.mp4",
    "tiktok-video.mp4",
    "tiktok-vertical.mp4",
    "social-video.mp4"
  ].find((name) => names.includes(name)) || names.find((name) => /tiktok.*\.mp4$/i.test(name)) || "";
  const audioName = ["tiktok-narration.mp3", "narration.mp3"].find((name) => names.includes(name)) || "";

  const destinationDir = path.join(publicMediaDir, edition);
  fs.mkdirSync(destinationDir, { recursive: true });
  for (const name of [videoName, audioName].filter(Boolean)) {
    fs.copyFileSync(path.join(sourceDir, name), path.join(destinationDir, name));
  }

  return {
    video: videoName ? `/media/${edition}/${videoName}` : "",
    audio: audioName ? `/media/${edition}/${audioName}` : ""
  };
}
function buildPack(edition, social, media) {
  const script = String(social.tiktok_script || "").trim();
  const caption = String(social.tiktok_caption || "").trim();
  if (!script && !caption) return "";

  const player = media.video
    ? `<video controls playsinline preload="metadata" style="width:100%;max-width:420px;border-radius:12px;background:#000"><source src="${esc(media.video)}" type="video/mp4">Your browser cannot play this TikTok video.</video><p><a href="${esc(media.video)}" download>Download TikTok video</a></p>`
    : media.audio
      ? `<audio controls preload="metadata" style="width:100%"><source src="${esc(media.audio)}" type="audio/mpeg">Your browser cannot play this narration.</audio><p class="tiktok-note">A TikTok MP4 was not generated for this edition. The narration audio and exact posting copy are preserved below.</p><p><a href="${esc(media.audio)}" download>Download narration audio</a></p>`
      : `<p class="tiktok-note">No TikTok video or narration audio was generated. The exact posting copy is preserved below.</p>`;

  return `${START}
<section id="tiktok-publishing-pack" class="tiktok-publishing-pack" aria-labelledby="tiktok-pack-title">
<style>
.tiktok-publishing-pack{margin:2rem 0;padding:1.25rem;border:1px solid #d8e0e6;border-radius:14px;background:#f7f4ed;color:#102437}
.tiktok-publishing-pack h2{margin-top:0}.tiktok-publishing-pack .tiktok-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1rem}
.tiktok-publishing-pack article{padding:1rem;border:1px solid #d8e0e6;border-radius:10px;background:#fff}
.tiktok-publishing-pack pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;margin:.5rem 0 0}
.tiktok-publishing-pack button{margin-top:.75rem;padding:.55rem .8rem;border:0;border-radius:8px;background:#071827;color:#fff;cursor:pointer}
.tiktok-publishing-pack .tiktok-note{font-size:.92rem}
</style>
<h2 id="tiktok-pack-title">TikTok publishing pack</h2>
<p>Use the exact narration and caption prepared for this edition.</p>
${player}
<div class="tiktok-grid">
<article><h3>TikTok narration</h3><pre id="tiktok-script-${esc(edition)}">${esc(script || "Not generated")}</pre><button type="button" onclick="navigator.clipboard.writeText(document.getElementById('tiktok-script-${esc(edition)}').innerText)">Copy narration</button></article>
<article><h3>TikTok caption</h3><pre id="tiktok-caption-${esc(edition)}">${esc(caption || "Not generated")}</pre><button type="button" onclick="navigator.clipboard.writeText(document.getElementById('tiktok-caption-${esc(edition)}').innerText)">Copy caption</button></article>
</div>
</section>
${END}`;
}

if (!fs.existsSync(draftsDir) || !fs.existsSync(postsDir)) {
  console.log("TikTok publishing pack skipped: drafts or public posts directory is absent.");
  process.exit(0);
}

let updated = 0;
for (const edition of fs.readdirSync(draftsDir).sort()) {
  if (!/^\d{4}-\d{2}-\d{2}(?:-[a-z0-9-]+)?$/.test(edition)) continue;
  const structured = readJson(path.join(draftsDir, edition, "structured_output.json"));
  const social = structured?.social || {};
  if (!String(social.tiktok_script || "").trim() && !String(social.tiktok_caption || "").trim()) continue;

  const postPath = path.join(postsDir, `${edition}.html`);
  if (!fs.existsSync(postPath)) continue;

  const pack = buildPack(edition, social, mediaForEdition(edition));
  if (!pack) continue;
  let html = removeExisting(fs.readFileSync(postPath, "utf8"));
  const insertionPoint = html.lastIndexOf("</main>") >= 0 ? html.lastIndexOf("</main>") : html.lastIndexOf("</body>");
  html = insertionPoint >= 0
    ? `${html.slice(0, insertionPoint)}\n${pack}\n${html.slice(insertionPoint)}`
    : `${html}\n${pack}\n`;
  fs.writeFileSync(postPath, html, "utf8");
  updated += 1;
}

console.log(`Added or refreshed TikTok publishing packs on ${updated} public post page(s).`);
