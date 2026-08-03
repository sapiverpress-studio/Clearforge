import fs from "node:fs";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const sourceValidator = fs.readFileSync("src/validate-source-integrity.mjs", "utf8");
const podcast = fs.readFileSync("src/generate-broad-ai-news-podcast.mjs", "utf8");
const podcastWrapper = fs.readFileSync("src/run-optional-podcast.mjs", "utf8");
const workflow = fs.readFileSync(".github/workflows/daily-draft.yml", "utf8");

const assertions = [
  [pkg.scripts.daily.includes("verify:sources"), "Fresh research must fail closed on source integrity."],
  [pkg.scripts["angle:alternate"].includes("verify:sources"), "Alternate editions must fail closed on source integrity."],
  [podcastWrapper.includes('["run", "verify:claims"]'), "Claim verification must run after all text outputs."],
  [pkg.scripts["validate:auto"].includes("facts:enforce"), "Final automated validation must recheck outputs against persisted source evidence."],
  [sourceValidator.includes("response.ok"), "Source validator must reject unsuccessful HTTP responses."],
  [sourceValidator.includes("titleSimilarity"), "Source validator must compare recorded and resolved titles."],
  [sourceValidator.includes("verified_claims"), "Source validator must persist verified atomic claims."],
  [sourceValidator.includes("publisher_blocked"), "Publisher-blocked sources must not authenticate detailed claims."],
  [sourceValidator.includes("No meaningful factual core"), "Missing material evidence must block the source."],
  [podcast.includes("at least three verified stories"), "Podcast must be a broad multi-story briefing."],
  [podcast.includes("whole AI landscape"), "Podcast scope must remain broad."],
  [podcast.includes("sourceReport.passed !== true"), "Podcast must not run from unverified sources."],
  [workflow.indexOf("Run automated checks for the human reviewer") < workflow.indexOf("Install FFmpeg"), "Validation must occur before expensive media work."],
  [workflow.indexOf("Generate daily biggest-story podcast script") < workflow.indexOf("Install FFmpeg"), "Podcast text and claim checks must complete before media work."]
];

const failed = assertions.filter(([passed]) => !passed);
for (const [, message] of failed) console.error(`FAIL: ${message}`);
if (failed.length) process.exit(1);
console.log(`Passed ${assertions.length} fail-closed editorial pipeline checks.`);
