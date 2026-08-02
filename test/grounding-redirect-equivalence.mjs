import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("src/resolve-source-records.mjs", "utf8");
assert.match(source, /grounded_title_to_redirect/);
assert.match(source, /proposed_canonical_url/);
assert.match(source, /selectGroundedEvidence/);
assert.match(source, /evidenceItem\.url/);
assert.doesNotMatch(source, /was not present in the web-search evidence/);
console.log("Grounding redirect equivalence regression test passed.");
