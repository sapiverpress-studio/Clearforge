import assert from "node:assert/strict";
import fs from "node:fs";

const daily = fs.readFileSync(".github/workflows/daily-draft.yml", "utf8");
const release = fs.readFileSync(".github/workflows/human-release.yml", "utf8");
const exporter = fs.readFileSync("src/export-approved-bundle.mjs", "utf8");

assert.match(daily, /sapiver-forge-candidate-/);
assert.match(daily, /SAPIVER_FORGE_DATE/);
assert.doesNotMatch(daily, /clearforge-candidate-/i);
assert.match(release, /event_type\\\":\\\"sapiver_forge_publish/);
assert.match(release, /SAPIVER_FORGE_CANDIDATE_ID/);
assert.doesNotMatch(release, /bridge\/clearforge/i);
assert.match(exporter, /"bridge", "sapiver-forge"/);
assert.doesNotMatch(exporter, /"bridge", "clearforge"/i);

console.log("Sapiver Forge naming contract passed.");
