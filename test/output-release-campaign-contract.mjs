import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { acquireExaSources } from "../src/exa-source-acquisition.mjs";

const root = process.cwd();
const campaign = JSON.parse(fs.readFileSync(path.join(root, "config/output-release-validation-campaign.json"), "utf8"));
assert.equal(campaign.product_url, "https://payhip.com/b/pkSEY");
assert.equal(campaign.max_public_packages_per_day, 1);
assert.equal(campaign.feature_enabled, false);
assert.equal(campaign.podcast_enabled, false);
assert.equal(campaign.media.vertical_images, 1);

let exaCalls = 0;
const irrelevantFetch = async (url) => {
  if (url === "https://api.exa.ai/search") {
    exaCalls += 1;
    return { ok: true, json: async () => ({ costDollars: { total: 0.001 }, results: [{ url: "https://example.com/model", title: "A new model launches", text: "A model launch with benchmark details. ".repeat(20), highlights: [] }] }) };
  }
  return { ok: true, status: 200, url, json: async () => ({}) };
};
const acquisition = await acquireExaSources({ apiKey: "test", date: "2026-08-04", campaign, fetchImpl: irrelevantFetch });
assert.equal(exaCalls, 2, "campaign discovery must use two searches");
assert.equal(acquisition.status, "no_suitable_source");
assert.equal(acquisition.candidate_count, 0);

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "sapiver-campaign-"));
fs.mkdirSync(path.join(temp, "config"), { recursive: true });
fs.mkdirSync(path.join(temp, "drafts", "2026-08-04"), { recursive: true });
fs.copyFileSync(path.join(root, "config/output-release-validation-campaign.json"), path.join(temp, "config/output-release-validation-campaign.json"));
const structured = { social: { tiktok_caption: "Open the source first.", facebook_post: "Check the draft.", pinterest_description: "A useful checklist.", linkedin_post: "Review the exact output.", youtube_shorts_script: "Would you send this?" } };
fs.writeFileSync(path.join(temp, "drafts", "2026-08-04", "structured_output.json"), JSON.stringify(structured));
const result = spawnSync(process.execPath, [path.join(root, "src/finalise-social-links.mjs")], { cwd: temp, env: { ...process.env, CLEARFORGE_DATE: "2026-08-04" }, encoding: "utf8" });
assert.equal(result.status, 0, result.stderr);
const finalised = JSON.parse(fs.readFileSync(path.join(temp, "drafts", "2026-08-04", "structured_output.json"), "utf8"));
for (const field of ["tiktok_caption", "facebook_post", "pinterest_description", "linkedin_post"]) {
  const value = finalised.social[field];
  assert.equal((value.match(/https:\/\/payhip\.com\/b\/pkSEY/g) || []).length, 1);
  assert.match(value, /utm_campaign=output-release-30-day-validation/);
  assert.doesNotMatch(value, /5147ce2817|o8iQA|vGks8/);
}

const workflow = fs.readFileSync(path.join(root, ".github/workflows/daily-draft.yml"), "utf8");
assert.match(workflow, /Clean skipped day/);
assert.match(workflow, /steps\.campaign\.outputs\.active != 'true'/);
assert.match(workflow, /bash scripts\/run-commercial-daily\.sh/);
console.log("Output Release Gate campaign contract passed.");
