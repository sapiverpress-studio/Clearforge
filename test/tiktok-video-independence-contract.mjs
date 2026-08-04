import fs from "node:fs";

const wrapper = fs.readFileSync("src/run-optional-media.mjs", "utf8");
const generator = fs.readFileSync("src/generate-tiktok-video.mjs", "utf8");
const mediaGenerator = fs.readFileSync("src/generate-ai-media.mjs", "utf8");
const workflow = fs.readFileSync(".github/workflows/daily-draft.yml", "utf8");

const failures = [];
if (!wrapper.includes('src/generate-tiktok-video.mjs')) failures.push("Media wrapper does not invoke the TikTok MP4 generator.");
if (!generator.includes('tiktok-narration.mp3')) failures.push("TikTok MP4 generator does not use TikTok narration audio.");
if (!generator.includes('tiktok.mp4')) failures.push("TikTok MP4 generator does not produce the expected public-pack filename.");
if (!generator.includes('video_independent_of_podcast: true')) failures.push("TikTok manifest does not record podcast independence.");
if (/podcast.*mp3/i.test(generator)) failures.push("TikTok MP4 generator must not depend on podcast MP3 files.");
if (!generator.includes('process.exit(0)')) failures.push("TikTok MP4 failure is not contained as an optional output.");
if (!workflow.includes('Generate story-specific AI visuals and narration')) failures.push("Daily workflow no longer invokes the media pipeline.");
if (!mediaGenerator.includes("matchedTikTokStoryIndex") || !mediaGenerator.includes("overlapScore(tiktokNarrationText")) failures.push("TikTok visual selection is not matched to the narration story.");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("TikTok video independence contract passed.");
