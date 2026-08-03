import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "sapiver-selector-"));
const podcast = path.join(temp, "public", "podcast");
fs.mkdirSync(podcast, { recursive: true });
fs.writeFileSync(path.join(temp, "public", "index.html"), '<section data-clearforge-latest-short></section>');
fs.writeFileSync(path.join(podcast, "latest-short.js"), 'document.querySelector("[data-clearforge-latest-short]");');

const result = spawnSync(process.execPath, [path.join(repo, "scripts", "finalise-sapiver-selectors.mjs")], {
  cwd: temp, encoding: "utf8"
});
assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
for (const file of [path.join(temp, "public", "index.html"), path.join(podcast, "latest-short.js")]) {
  const content = fs.readFileSync(file, "utf8");
  assert.match(content, /data-sapiver-forge-latest-short/);
  assert.doesNotMatch(content, /data-clearforge-latest-short/);
}

console.log("Sapiver Forge selector finalisation passed.");
