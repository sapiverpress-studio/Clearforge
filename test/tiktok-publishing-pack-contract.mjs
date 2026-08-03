import fs from "node:fs";
import assert from "node:assert/strict";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const script = fs.readFileSync("scripts/add-tiktok-publishing-packs.mjs", "utf8");

assert.match(pkg.scripts["build:site"], /add-tiktok-publishing-packs\.mjs/, "Site build must add TikTok publishing packs.");
assert.match(script, /social\.tiktok_script/, "Publishing pack must use the exact TikTok narration field.");
assert.match(script, /social\.tiktok_caption/, "Publishing pack must use the exact TikTok caption field.");
assert.match(script, /tiktok-narration\.mp3/, "Publishing pack must support narration-audio fallback.");
assert.match(script, /tiktok.*\.mp4/i, "Publishing pack must support a generated TikTok MP4.");
assert.match(script, /SAPIVER_TIKTOK_PACK_START/, "Publishing pack injection must be idempotent.");

console.log("TikTok publishing pack contract passed.");
