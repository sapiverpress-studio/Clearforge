import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const homepagePath = path.join(root, "public", "index.html");
const latestShortPath = path.join(root, "public", "podcast", "latest-short.js");
const legacySelector = "data-clearforge-latest-short";
const currentSelector = "data-sapiver-forge-latest-short";

if (!fs.existsSync(homepagePath)) throw new Error(`Expected generated file is missing: ${path.relative(root, homepagePath)}`);
if (!fs.existsSync(latestShortPath)) {
  const draftsRoot = path.join(root, "drafts");
  const editions = fs.existsSync(draftsRoot) ? fs.readdirSync(draftsRoot).sort().reverse() : [];
  const edition = editions.find((name) => fs.existsSync(path.join(draftsRoot, name, "structured_output.json"))
    && fs.existsSync(path.join(root, "public", "media", name, "tiktok.mp4")));
  if (!edition) throw new Error("No sealed TikTok MP4 and caption were available for the latest-short panel.");
  const structured = JSON.parse(fs.readFileSync(path.join(draftsRoot, edition, "structured_output.json"), "utf8"));
  const caption = String(structured.social?.tiktok_caption || structured.social?.tiktok_caption_prompt || "").trim();
  if (!caption) throw new Error(`TikTok caption is missing for ${edition}.`);
  fs.mkdirSync(path.dirname(latestShortPath), { recursive: true });
  fs.writeFileSync(latestShortPath, `(() => {
  const videoUrl = ${JSON.stringify(`/media/${edition}/tiktok.mp4`)};
  const caption = ${JSON.stringify(caption)};
  for (const section of document.querySelectorAll("[data-sapiver-forge-latest-short]")) {
    const host = section.querySelector("[data-short-content]");
    if (!host) continue;
    const video = document.createElement("video");
    video.controls = true; video.preload = "metadata"; video.playsInline = true; video.src = videoUrl;
    const textarea = document.createElement("textarea");
    textarea.readOnly = true; textarea.value = caption; textarea.setAttribute("aria-label", "TikTok caption");
    const copy = document.createElement("button");
    copy.type = "button"; copy.textContent = "Copy caption";
    copy.addEventListener("click", async () => { await navigator.clipboard.writeText(caption); copy.textContent = "Caption copied"; });
    host.replaceChildren(video, textarea, copy); section.hidden = false;
  }
})();\n`, "utf8");
}

for (const file of [homepagePath, latestShortPath]) {
  const original = fs.readFileSync(file, "utf8");
  const updated = original.replaceAll(legacySelector, currentSelector);
  fs.writeFileSync(file, updated, "utf8");
  if (updated.includes(legacySelector)) throw new Error(`Legacy selector remains in ${path.relative(root, file)}`);
}

const homepage = fs.readFileSync(homepagePath, "utf8");
const latestShort = fs.readFileSync(latestShortPath, "utf8");
if (!homepage.includes(`[${currentSelector}]`) && !homepage.includes(currentSelector)) {
  throw new Error("Sapiver Forge latest-short section selector is missing from the homepage.");
}
if (!latestShort.includes(`[${currentSelector}]`)) {
  throw new Error("Sapiver Forge latest-short JavaScript selector is missing.");
}

console.log("Finalised Sapiver Forge latest-short selectors.");
