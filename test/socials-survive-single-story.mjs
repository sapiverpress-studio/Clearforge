import fs from "node:fs";
import assert from "node:assert/strict";

const resolver = fs.readFileSync("src/resolve-source-records.mjs", "utf8");
const validator = fs.readFileSync("src/validate-source-integrity.mjs", "utf8");
const rebuild = fs.readFileSync("src/rebuild-pruned-edition.mjs", "utf8");
const podcast = fs.readFileSync("src/run-optional-podcast.mjs", "utf8");

assert.match(resolver, /survivors\.length < 1/);
assert.match(validator, /passedIndexes\.length >= 1/);
assert.match(rebuild, /detailed single-story report/i);
assert.match(rebuild, /Generate the complete social pack every time/i);
assert.match(podcast, /Podcast skipped without failing/);
assert.match(podcast, /process\.exit\(0\)/);

console.log("Single-story detailed-report and always-social fallback contract passed.");
