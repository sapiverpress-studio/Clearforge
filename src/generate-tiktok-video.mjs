import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const DATE = process.env.SAPIVER_FORGE_DATE || process.env.CLEARFORGE_DATE || new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());
const mediaDir = path.join(ROOT, "media", DATE);
const manifestPath = path.join(mediaDir, "media-manifest.json");
const audioPath = path.join(mediaDir, "tiktok-narration.mp3");
const outputPath = path.join(mediaDir, "tiktok.mp4");
const warningPath = path.join(mediaDir, "tiktok-video-warning.txt");

function fail(message) {
  fs.mkdirSync(mediaDir, { recursive: true });
  fs.rmSync(outputPath, { force: true });
  fs.writeFileSync(warningPath, `${message}\nTikTok narration, caption and audio remain available.\n`, "utf8");
  console.warn(message);
  process.exit(0);
}

if (!fs.existsSync(audioPath) || fs.statSync(audioPath).size < 1000) {
  fail(`TikTok MP4 skipped for ${DATE}: tiktok-narration.mp3 is missing or invalid.`);
}
if (!fs.existsSync(manifestPath)) {
  fail(`TikTok MP4 skipped for ${DATE}: media-manifest.json is missing.`);
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
} catch (error) {
  fail(`TikTok MP4 skipped for ${DATE}: media manifest could not be read (${error.message}).`);
}

const preferredIndex = Number.isInteger(manifest?.tiktok?.story_index) ? manifest.tiktok.story_index + 1 : 1;
const imageCandidates = [
  path.join(mediaDir, `story-${preferredIndex}.png`),
  path.join(mediaDir, "story-1.png"),
  path.join(mediaDir, `story-${preferredIndex}.jpg`),
  path.join(mediaDir, "story-1.jpg")
];
const imagePath = imageCandidates.find((file) => fs.existsSync(file) && fs.statSync(file).size > 1000);
if (!imagePath) {
  fail(`TikTok MP4 skipped for ${DATE}: no usable story image exists.`);
}

for (const binary of ["ffmpeg", "ffprobe"]) {
  const probe = spawnSync(binary, ["-version"], { stdio: "ignore" });
  if (probe.status !== 0) fail(`TikTok MP4 skipped for ${DATE}: ${binary} is unavailable.`);
}

const audioProbe = spawnSync("ffprobe", [
  "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", audioPath
], { encoding: "utf8" });
const duration = Number(String(audioProbe.stdout || "").trim());
if (audioProbe.status !== 0 || !Number.isFinite(duration) || duration <= 0) {
  fail(`TikTok MP4 skipped for ${DATE}: narration duration could not be determined.`);
}

const render = spawnSync("ffmpeg", [
  "-hide_banner", "-loglevel", "error", "-y",
  "-loop", "1", "-framerate", "30", "-i", imagePath,
  "-i", audioPath,
  "-filter_complex",
  "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.0008,1.08)':d=1:s=1080x1920:fps=30,format=yuv420p[v]",
  "-map", "[v]", "-map", "1:a",
  "-t", String((duration + 0.15).toFixed(3)),
  "-c:v", "libx264", "-preset", "medium", "-crf", "24",
  "-c:a", "aac", "-b:a", "128k", "-ar", "44100",
  "-movflags", "+faststart", "-shortest", outputPath
], { stdio: "inherit" });

if (render.status !== 0 || !fs.existsSync(outputPath) || fs.statSync(outputPath).size < 10000) {
  fail(`TikTok MP4 generation failed for ${DATE}; the rest of the media pack is preserved.`);
}

fs.rmSync(warningPath, { force: true });
manifest.tiktok = {
  ...(manifest.tiktok || {}),
  video: path.relative(ROOT, outputPath).replaceAll("\\", "/"),
  video_source_audio: path.relative(ROOT, audioPath).replaceAll("\\", "/"),
  video_duration_seconds: Number(duration.toFixed(3)),
  video_independent_of_podcast: true
};
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Generated independent TikTok MP4: ${path.relative(ROOT, outputPath)}`);
