import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const EDITION = String(process.env.CLEARFORGE_DATE || "").trim();
const RUN_URL = String(process.env.CLEARFORGE_RUN_URL || "").trim();
const SOURCE_COMMIT = String(process.env.CLEARFORGE_SOURCE_SHA || "").trim();
if (!/^\d{4}-\d{2}-\d{2}(?:-[a-z0-9-]+)?$/.test(EDITION)) {
  throw new Error("CLEARFORGE_DATE must be an exact Clearforge edition ID.");
}

const draftDir = path.join(ROOT, "drafts", EDITION);
const mediaDir = path.join(ROOT, "media", EDITION);
const publicDir = path.join(ROOT, "public");
if (!fs.existsSync(draftDir)) throw new Error(`Missing candidate directory: ${draftDir}`);

function readText(file) {
  try { return fs.readFileSync(file, "utf8").trim(); } catch { return ""; }
}
function readJson(file, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  })[character]);
}
function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
function collectFiles(directory, prefix) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(absolute, relative));
    else if (entry.isFile() && !/human-review-|candidate-manifest\.json$/.test(entry.name)) {
      const stat = fs.statSync(absolute);
      files.push({ path: relative, bytes: stat.size, sha256: sha256(absolute) });
    }
  }
  return files;
}
function markdownBlock(title, content) {
  return `<section class="panel"><h2>${esc(title)}</h2><pre>${esc(content || "Not generated")}</pre></section>`;
}

const structured = readJson(path.join(draftDir, "structured_output.json"));
const validation = readJson(path.join(draftDir, "validation.json"));
const podcastMeta = readJson(path.join(draftDir, "podcast", "episode-metadata.json"));
const article = readText(path.join(draftDir, "daily_brief.md"));
const feature = readText(path.join(draftDir, "feature.md"));
const socialPack = readText(path.join(draftDir, "social_pack.md"));
const podcastScript = readText(path.join(draftDir, "podcast", "COPY_PASTE_INTO_ELEVENLABS.txt"));
const sources = Array.isArray(structured.sources) ? structured.sources : [];
const social = structured.social || {};

const files = [
  ...collectFiles(draftDir, `drafts/${EDITION}`),
  ...collectFiles(mediaDir, `media/${EDITION}`),
  ...collectFiles(publicDir, "public")
].sort((a, b) => a.path.localeCompare(b.path));

const payload = {
  schema_version: 2,
  edition: EDITION,
  generated_at: new Date().toISOString(),
  workflow_run_url: RUN_URL,
  source_commit: SOURCE_COMMIT,
  human_approval_required: true,
  files
};
const candidateId = crypto
  .createHash("sha256")
  .update(JSON.stringify(payload))
  .digest("hex");
const manifest = { ...payload, candidate_id: candidateId };

const manifestPath = path.join(draftDir, "candidate-manifest.json");
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const sourceRows = sources.map((source, index) => `<tr>
  <td>${index + 1}</td>
  <td><a href="${esc(source.url || "")}">${esc(source.source_name || source.title || "Source")}</a><br><small>${esc(source.published_date || "Date not recorded")}</small></td>
  <td>${esc(source.confirmed_fact || "Not recorded")}</td>
  <td>${esc(source.interpretation || "Not recorded")}</td>
</tr>`).join("");

const socialSections = [
  ["TikTok narration", social.tiktok_script],
  ["TikTok caption", social.tiktok_caption],
  ["YouTube Shorts narration", social.youtube_shorts_script],
  ["Facebook post", social.facebook_post],
  ["Pinterest title", social.pinterest_title],
  ["Pinterest description", social.pinterest_description]
].map(([name, content]) => `<article><h3>${esc(name)}</h3><pre>${esc(content || "Not generated")}</pre></article>`).join("");

let embeddedImageBytes = 0;
const imageLimit = 4 * 1024 * 1024;
const mediaCards = files
  .filter((file) => file.path.startsWith(`media/${EDITION}/`))
  .map((file) => {
    const absolute = path.join(ROOT, file.path);
    const extension = path.extname(file.path).toLowerCase();
    const mime = extension === ".png" ? "image/png"
      : extension === ".jpg" || extension === ".jpeg" ? "image/jpeg"
        : extension === ".webp" ? "image/webp" : "";
    let preview = "";
    if (mime && embeddedImageBytes + file.bytes <= imageLimit) {
      embeddedImageBytes += file.bytes;
      preview = `<img src="data:${mime};base64,${fs.readFileSync(absolute).toString("base64")}" alt="${esc(path.basename(file.path))}">`;
    }
    return `<article class="media">${preview}<h3>${esc(path.basename(file.path))}</h3><p>${file.bytes.toLocaleString()} bytes</p><code>${esc(file.sha256.slice(0, 16))}…</code></article>`;
  }).join("");

const validationFailures = Array.isArray(validation.failures) ? validation.failures : [];
const validationWarnings = Array.isArray(validation.warnings) ? validation.warnings : [];
const htmlPath = path.join(draftDir, `human-review-${EDITION}-${candidateId.slice(0, 12)}.html`);
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Clearforge human review — ${esc(EDITION)}</title>
<style>
:root{--navy:#071827;--ink:#102437;--gold:#e2b85b;--paper:#fff;--cream:#f7f4ed;--line:#d8e0e6;--red:#a62929}
*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font:16px/1.5 system-ui,sans-serif}
header{background:var(--navy);color:#fff;padding:24px}header div,main{max-width:1100px;margin:auto}main{padding:16px 12px 60px}
.panel,article{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:16px;margin:12px 0}
.status{border-left:8px solid var(--gold)}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:14px/1.5 system-ui,sans-serif}
.scroll{overflow:auto}table{border-collapse:collapse;width:100%;font-size:.9rem}th,td{border-bottom:1px solid var(--line);padding:8px;text-align:left;vertical-align:top}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.grid article{margin:0}
.media img{display:block;width:100%;height:auto;border-radius:8px;margin-bottom:10px}code{overflow-wrap:anywhere}
.warning{color:var(--red)}a{color:#075a86}
</style></head><body>
<header><div><strong>CLEARFORGE</strong><h1>Human validation package</h1><p>Review the exact candidate before manually releasing it.</p></div></header>
<main>
<section class="panel status">
  <h2>AWAITING HUMAN APPROVAL</h2>
  <p><strong>Edition:</strong> ${esc(EDITION)}</p>
  <p><strong>Candidate ID:</strong> <code>${candidateId}</code></p>
  <p><strong>Files sealed:</strong> ${files.length}</p>
  <p>Nothing in this candidate should be deployed, syndicated or distributed until you manually run the human release workflow for this exact candidate.</p>
  ${RUN_URL ? `<p><a href="${esc(RUN_URL)}">Open the generating workflow run</a></p>` : ""}
</section>
<section class="panel"><h2>Automated checks for your attention</h2>
  <p>These checks support your review; they do not approve or reject the candidate.</p>
  <h3>Failures</h3>${validationFailures.length ? `<ul class="warning">${validationFailures.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>` : "<p>None recorded.</p>"}
  <h3>Warnings</h3>${validationWarnings.length ? `<ul>${validationWarnings.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>` : "<p>None recorded.</p>"}
</section>
${markdownBlock("Daily brief", article)}
${markdownBlock("Long-form feature", feature)}
<section class="panel"><h2>Evidence and interpretation</h2><div class="scroll"><table><thead><tr><th>#</th><th>Source</th><th>Confirmed fact</th><th>Clearforge interpretation</th></tr></thead><tbody>${sourceRows || "<tr><td colspan=\"4\">No sources recorded.</td></tr>"}</tbody></table></div></section>
<section class="panel"><h2>Social materials</h2><div class="grid">${socialSections}</div>${socialPack ? `<details><summary>Open complete generated social pack</summary><pre>${esc(socialPack)}</pre></details>` : ""}</section>
${markdownBlock("Podcast script", podcastScript)}
<section class="panel"><h2>Podcast metadata</h2><pre>${esc(JSON.stringify(podcastMeta, null, 2))}</pre></section>
<section class="panel"><h2>Generated media</h2><p>Images are embedded where the email-size safety limit permits. Audio and video are sealed in the workflow candidate artifact and listed by name, size and hash.</p><div class="grid">${mediaCards || "<p>No media files were generated.</p>"}</div></section>
<section class="panel"><h2>Release decision</h2>
  <ol><li>Check the evidence, wording, product references, scripts and media.</li><li>If anything is wrong, do not release this candidate.</li><li>If satisfied, run <strong>Release Human-Validated Clearforge Edition</strong> with this edition and candidate ID.</li></ol>
  <p>The release workflow will reject changed or substituted files.</p>
</section>
</main></body></html>`;
fs.writeFileSync(htmlPath, html);

const githubOutput = process.env.GITHUB_OUTPUT;
if (githubOutput) {
  fs.appendFileSync(githubOutput, `candidate_id=${candidateId}\n`);
  fs.appendFileSync(githubOutput, `review_html=${path.relative(ROOT, htmlPath)}\n`);
}
console.log(`Built human review package ${candidateId} for ${EDITION}.`);
