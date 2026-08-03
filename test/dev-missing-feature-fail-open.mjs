import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repo = process.cwd();
const root = fs.mkdtempSync(path.join(os.tmpdir(), "sapiver-dev-no-feature-"));
const edition = "2026-08-03";
const draft = path.join(root, "drafts", edition);
fs.mkdirSync(draft, { recursive: true });
fs.writeFileSync(path.join(draft, "approval.json"), JSON.stringify({
  feature_approved: true,
  dev_approved: true
}));

const result = spawnSync(process.execPath, [path.join(repo, "src/post-feature-to-dev.mjs")], {
  cwd: root,
  encoding: "utf8",
  env: { ...process.env, CLEARFORGE_DATE: edition, DEV_API_KEY: "unused" }
});

assert.equal(result.status, 0, result.stderr);
assert.match(result.stdout, /no optional feature package/i);
assert.equal(fs.existsSync(path.join(draft, "dev-post-result.json")), false);
console.log("DEV missing-feature fail-open regression passed.");
