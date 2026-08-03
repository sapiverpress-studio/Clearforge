import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const candidateRoot = path.resolve(String(process.env.REPLAY_CANDIDATE_DIR || ""));
const originalDraft = path.join(candidateRoot, "drafts", "2026-08-03");
const originalMedia = path.join(candidateRoot, "media", "2026-08-03");
assert.ok(fs.existsSync(path.join(originalDraft, "structured_output.json")), "Set REPLAY_CANDIDATE_DIR to the extracted 2026-08-03 candidate root.");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "sapiver-production-replay-"));
const draft = path.join(root, "drafts", "2026-08-03");
const media = path.join(root, "media", "2026-08-03");
fs.mkdirSync(draft, { recursive: true });
fs.mkdirSync(media, { recursive: true });
for (const file of fs.readdirSync(originalMedia).filter((name) => /^story-\d+\.(?:png|jpe?g|webp)$/i.test(name))) {
  fs.copyFileSync(path.join(originalMedia, file), path.join(media, file));
}
for (const file of ["structured_output.json", "daily_brief.md", "social_pack.md", "sources.json", "validation.json", "approval.json"]) {
  fs.copyFileSync(path.join(originalDraft, file), path.join(draft, file));
}
const imageHashesBefore = Object.fromEntries(fs.readdirSync(media).map((file) => [file, crypto.createHash("sha256").update(fs.readFileSync(path.join(media, file))).digest("hex")]));

function run(script, extraEnv = {}) {
  const result = spawnSync(process.execPath, [path.join(repo, "src", script)], {
    cwd: root, encoding: "utf8", env: { ...process.env, SAPIVER_FORGE_DATE: "2026-08-03", ...extraEnv }
  });
  assert.equal(result.status, 0, `${script} failed:\n${result.stdout}\n${result.stderr}`);
}

run("validate-source-integrity.mjs", { SAPIVER_FORGE_ALLOW_SOURCE_FIXTURES: "1", SOURCE_FIXTURE_DIR: path.join(repo, "test", "fixtures", "2026-08-03-microsoft") });
run("rebuild-narrowed-edition.mjs", { NARROWED_REBUILD_DISABLE_MODEL: "1" });
run("enforce-locked-facts.mjs");
{
  const damaged = JSON.parse(fs.readFileSync(path.join(draft, "structured_output.json"), "utf8"));
  damaged.social.tiktok_script = "67%";
  fs.writeFileSync(path.join(draft, "structured_output.json"), `${JSON.stringify(damaged, null, 2)}\n`);
}
run("ensure-output-usability.mjs");

const structured = JSON.parse(fs.readFileSync(path.join(draft, "structured_output.json"), "utf8"));
const lock = JSON.parse(fs.readFileSync(path.join(draft, "locked-facts.json"), "utf8"));
const report = JSON.parse(fs.readFileSync(path.join(draft, "narrowed-edition-rebuild.json"), "utf8"));
const daily = fs.readFileSync(path.join(draft, "daily_brief.md"), "utf8");
const socialPack = fs.readFileSync(path.join(draft, "social_pack.md"), "utf8");
const outputCorpus = `${JSON.stringify(structured)}\n${daily}\n${socialPack}`;
for (const marker of ["67%", "20,000", "10 countries", "twice as", "twice the", "Slack", "Shopify", "Python execution", "live dashboards"]) {
  assert.equal(outputCorpus.includes(marker), false, `unsupported output survived replay: ${marker}`);
}
assert.equal(lock.facts.some((fact) => /67%|20,000|10 countries|twice/i.test(fact.atomic_claim)), false);
assert.equal(report.method, "deterministic_fallback", "replay must prove the no-extra-API fallback");
assert.ok(structured.main_article.trim().split(/\s+/).length >= 180, "narrowed article is too thin to use");
assert.ok(structured.social.tiktok_script.trim().split(/\s+/).length >= 45, "TikTok script is too thin to use");
assert.ok(structured.social.tiktok_caption.includes("payhip.com") && structured.social.tiktok_caption.includes("sapiver-press.kit.com"), "TikTok caption lost commercial links");
for (const field of ["youtube_shorts_script", "facebook_post", "pinterest_title", "pinterest_description", "linkedin_post"]) assert.ok(String(structured.social[field] || "").trim(), `missing ${field}`);
assert.equal(structured.social.quote_card_lines.length, 5);

const narrationHash = crypto.createHash("sha256").update(structured.social.tiktok_script).digest("hex");
const silentAudio = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", "3", "-codec:a", "libmp3lame", path.join(media, "tiktok-narration.mp3")]);
assert.equal(silentAudio.status, 0, "could not create replay narration carrier");
fs.writeFileSync(path.join(media, "media-manifest.json"), JSON.stringify({ version: 5, tiktok: { story_index: 0, narration_text: structured.social.tiktok_script, narration_script_sha256: narrationHash } }, null, 2));
run("generate-tiktok-video.mjs");
assert.ok(fs.statSync(path.join(media, "tiktok-narration.mp3")).size > 1000 && fs.statSync(path.join(media, "tiktok.mp4")).size > 10000, "corrected TikTok MP3/MP4 path was not produced");
const finalManifest = JSON.parse(fs.readFileSync(path.join(media, "media-manifest.json"), "utf8"));
assert.equal(finalManifest.tiktok.narration_script_sha256, narrationHash, "TikTok media is not bound to the corrected script");
assert.equal(finalManifest.tiktok.video_source_audio, "media/2026-08-03/tiktok-narration.mp3");
assert.equal(finalManifest.tiktok.video_independent_of_podcast, true);
const imageHashesAfter = Object.fromEntries(Object.keys(imageHashesBefore).map((file) => [file, crypto.createHash("sha256").update(fs.readFileSync(path.join(media, file))).digest("hex")]));
assert.deepEqual(imageHashesAfter, imageHashesBefore, "text repair modified selected story imagery");

spawnSync("git", ["init", "-q"], { cwd: root });
spawnSync("git", ["config", "user.email", "replay@sapiverforge.invalid"], { cwd: root });
spawnSync("git", ["config", "user.name", "Sapiver Forge Replay"], { cwd: root });
spawnSync("git", ["commit", "--allow-empty", "-qm", "replay baseline"], { cwd: root });
run("build-human-review-package.mjs", { SAPIVER_FORGE_RUN_URL: "https://github.com/sapiverpress-studio/SapiverForge/actions/runs/30785673296", SAPIVER_FORGE_SOURCE_SHA: "replay" });
const review = fs.readFileSync(fs.readdirSync(draft).map((file) => path.join(draft, file)).find((file) => /human-review-/.test(file)), "utf8");
assert.match(review, /Claims excluded from locked facts/);
assert.doesNotMatch(review, /None — all material claims used in this edition were verified/);
assert.ok(fs.existsSync(path.join(draft, "candidate-manifest.json")), "candidate was not sealed");

console.log(JSON.stringify({
  passed: true,
  replay_source: "exact sealed candidate 4ab931318ef14df89e261ec0c30938891dc5d7390a213b0333b9c9bcd92e514d",
  article_words: structured.main_article.trim().split(/\s+/).length,
  tiktok_words: structured.social.tiktok_script.trim().split(/\s+/).length,
  verified_facts: lock.facts.length,
  excluded_claims: report.excluded_claim_count,
  tiktok_media_regenerated_from_corrected_script: true,
  candidate_sealed: true
}, null, 2));
