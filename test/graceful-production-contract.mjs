import fs from "node:fs";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const requiredScripts = {
  feature: "node src/run-optional-feature.mjs",
  "podcast:daily": "node src/run-optional-podcast.mjs",
  "media:ai": "node src/run-optional-media.mjs",
  "validate:auto": "node src/audit-publishability.mjs"
};

for (const [name, expected] of Object.entries(requiredScripts)) {
  if (!String(pkg.scripts?.[name] || "").includes(expected)) throw new Error(`${name} must use the graceful production path: ${expected}`);
}
if (!pkg.scripts?.["validate:auto"]?.includes("node src/run-graceful-validation.mjs")) throw new Error("validate:auto must retain graceful validation after the publishability audit.");
if (!pkg.scripts?.["social:optimise"]?.includes("run-social-link-finaliser.mjs")) throw new Error("Social CTA finalisation wrapper is missing.");
if (pkg.scripts?.["validate:auto"]?.includes("verify:sources")) throw new Error("Final validation must not repeat live source-integrity requests.");

for (const file of [
  "src/run-optional-feature.mjs",
  "src/run-optional-podcast.mjs",
  "src/run-optional-media.mjs",
  "src/run-social-link-finaliser.mjs",
  "src/run-graceful-validation.mjs"
]) if (!fs.existsSync(file)) throw new Error(`Missing graceful production component: ${file}`);

const mediaWrapper = fs.readFileSync("src/run-optional-media.mjs", "utf8");
if (!mediaWrapper.includes("Adapted ${stories.length}-story edition into a three-scene media sequence")) throw new Error("One- and two-story editions must be adapted for media rather than rejected.");

const validator = fs.readFileSync("src/validate-and-approve.mjs", "utf8");
const publishability = fs.readFileSync("src/audit-publishability.mjs", "utf8");
const usability = fs.readFileSync("src/ensure-output-usability.mjs", "utf8");
const narrowedRebuild = fs.readFileSync("src/rebuild-narrowed-edition.mjs", "utf8");

for (const marker of ["sources.length === 1", "articleWords < 650", "stories.length !== sources.length", "uniqueHosts.size < 1"]) {
  if (!validator.includes(marker)) throw new Error(`Current one-source validator protection missing: ${marker}`);
}
for (const marker of ["sources.length === 1", "words(data.main_article) < 650", "story_summaries", "No distinct source domain remains"]) {
  if (!publishability.includes(marker)) throw new Error(`Current publishability protection missing: ${marker}`);
}
if (!usability.includes("checks.article_words < 650")) throw new Error("Narrowed recovery must remain substantive after downstream processing.");
if (!usability.includes("checks.tiktok_words < 18") || !usability.includes("checks.tiktok_words > 120")) throw new Error("TikTok narration must remain within the 18–120 word usable range.");
for (const marker of ["depth_first_verified_rebuild", "wordCount(article) < 650", "delete social.linkedin_post"]) {
  if (!narrowedRebuild.includes(marker) && !(marker === "delete social.linkedin_post" && fs.readFileSync("src/finalise-social-links.mjs", "utf8").includes(marker))) {
    throw new Error(`Depth-first recovery protection missing: ${marker}`);
  }
}

console.log("Graceful production contract passed.");
