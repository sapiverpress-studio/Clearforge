import fs from "node:fs";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const requiredScripts = {
  "feature": "node src/run-optional-feature.mjs",
  "podcast:daily": "node src/run-optional-podcast.mjs",
  "media:ai": "node src/run-optional-media.mjs",
  "validate:auto": "node src/audit-publishability.mjs"
};

for (const [name, expected] of Object.entries(requiredScripts)) {
  if (!String(pkg.scripts?.[name] || "").includes(expected)) {
    throw new Error(`${name} must use the graceful production path: ${expected}`);
  }
}
if (!pkg.scripts?.["validate:auto"]?.includes("node src/run-graceful-validation.mjs")) {
  throw new Error("validate:auto must retain graceful minimum-story handling after the publishability audit.");
}

if (!pkg.scripts?.["social:optimise"]?.includes("run-social-link-finaliser.mjs")) {
  throw new Error("Social CTA finalisation must be non-blocking.");
}
if (pkg.scripts?.["validate:auto"]?.includes("verify:sources")) {
  throw new Error("Final validation must not repeat live source-integrity requests.");
}

for (const file of [
  "src/run-optional-feature.mjs",
  "src/run-optional-podcast.mjs",
  "src/run-optional-media.mjs",
  "src/run-social-link-finaliser.mjs",
  "src/run-graceful-validation.mjs"
]) {
  if (!fs.existsSync(file)) throw new Error(`Missing graceful production component: ${file}`);
}

const mediaWrapper = fs.readFileSync("src/run-optional-media.mjs", "utf8");
if (!mediaWrapper.includes("Adapted ${stories.length}-story edition into a three-scene media sequence")) {
  throw new Error("One- and two-story editions must be adapted for media rather than rejected.");
}

const validator = fs.readFileSync("src/validate-and-approve.mjs", "utf8");
for (const phrase of ["Expected 1–5 sources", "Expected 1–5 stories", "No distinct source domain remains"]) {
  if (!validator.includes(phrase)) throw new Error(`One-story production must be native in the validator: ${phrase}`);
}

const usability = fs.readFileSync("src/ensure-output-usability.mjs", "utf8");
const publishability = fs.readFileSync("src/audit-publishability.mjs", "utf8");
const narrowedRebuild = fs.readFileSync("src/rebuild-narrowed-edition.mjs", "utf8");
if (!usability.includes("tiktok_words > 120") || !publishability.includes("tiktokWords > 120")) {
  throw new Error("A 61–120 word TikTok narration must not destroy an otherwise usable verified edition.");
}
if (!narrowedRebuild.includes("if (wordCount(primaryFactText) >= 18) return primaryFactText")) {
  throw new Error("Narrowed recovery must avoid lengthening an already usable verified TikTok fact.");
}

console.log("Graceful production contract passed.");
