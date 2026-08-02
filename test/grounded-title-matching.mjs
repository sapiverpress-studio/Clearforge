import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/resolve-source-records.mjs", import.meta.url), "utf8");

assert.match(source, /const canonicalTitle = String\(evidenceItem\.title \|\| resolved\.title \|\| source\.title/);
assert.match(source, /using the grounded title instead/);
assert.doesNotMatch(source, /similarity\(resolved\.title, evidenceItem\.title\) < 0\.35/);
assert.match(source, /url: evidenceItem\.url/);
assert.match(source, /if \(!evidenceItem\) throw new Error/);

console.log("Grounded title matching contract passed.");
