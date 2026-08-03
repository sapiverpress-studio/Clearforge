import fs from "node:fs";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const requiredScripts = {
  "feature": "node src/run-optional-feature.mjs",
  "podcast:daily": "node src/run-optional-podcast.mjs",
  "media:ai": "node src/run-optional-media.mjs",
  "validate:auto": "npm run brand:current && node src/run-graceful-validation.mjs"
};

for (const [name, expected] of Object.entries(requiredScripts)) {
  if (!String(pkg.scripts?.[name] || "").includes(expected)) {
    throw new Error(`${name} must use the graceful production path: ${expected}`);
  }
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

const validationWrapper = fs.readFileSync("src/run-graceful-validation.mjs", "utf8");
for (const phrase of ["Expected 3–5 sources", "Expected 3–5 stories", "Fewer than two distinct source domains"]) {
  if (!validationWrapper.includes(phrase)) throw new Error(`Missing legacy validation override for: ${phrase}`);
}

console.log("Graceful production contract passed.");
