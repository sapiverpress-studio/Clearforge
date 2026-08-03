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
assert.equal(campaign.podcast_enabled, true);
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
const result = spawnSync(process.execPath, [path.join(root, "src/finalise-social-links.mjs")], { cwd: temp, env: { ...process.env, SAPIVER_FORGE_DATE: "2026-08-04" }, encoding: "utf8" });
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
assert.match(workflow, /Generate daily broad AI podcast script/);
assert.match(workflow, /default: true/);

const podcastTemp = fs.mkdtempSync(path.join(os.tmpdir(), "sapiver-podcast-social-"));
fs.mkdirSync(path.join(podcastTemp, "config"), { recursive: true });
fs.mkdirSync(path.join(podcastTemp, "drafts", "2026-08-04"), { recursive: true });
fs.copyFileSync(path.join(root, "config/output-release-validation-campaign.json"), path.join(podcastTemp, "config/output-release-validation-campaign.json"));
fs.writeFileSync(path.join(podcastTemp, "drafts", "2026-08-04", "structured_output.json"), JSON.stringify({ social_mode: "podcast_general", social: structured.social }));
const podcastLinks = spawnSync(process.execPath, [path.join(root, "src/finalise-social-links.mjs")], { cwd: podcastTemp, env: { ...process.env, SAPIVER_FORGE_DATE: "2026-08-04" }, encoding: "utf8" });
assert.equal(podcastLinks.status, 0, podcastLinks.stderr);
const podcastFinal = JSON.parse(fs.readFileSync(path.join(podcastTemp, "drafts", "2026-08-04", "structured_output.json"), "utf8"));
for (const field of ["tiktok_caption", "facebook_post", "pinterest_description", "linkedin_post"]) {
  assert.match(podcastFinal.social[field], /sapiverforge-daily-brief\.netlify\.app\/podcast\//);
  assert.doesNotMatch(podcastFinal.social[field], /payhip\.com\/b\/pkSEY/);
}

const daily = fs.readFileSync(path.join(root, "src/run-daily.mjs"), "utf8");
assert.match(daily, /campaign: null/, "daily research must remain broad during the product campaign");
assert.doesNotMatch(daily, /FINAL CAMPAIGN OVERRIDE/, "campaign must not collapse broad research to one product story");
const podcastGenerator = fs.readFileSync(path.join(root, "src/generate-broad-ai-news-podcast.mjs"), "utf8");
assert.match(podcastGenerator, /verified AI deep dive/, "one verified story must still produce a useful podcast rather than a skipped day");
assert.doesNotMatch(podcastGenerator, /Broad podcast requires at least three verified stories/);
assert.ok(workflow.indexOf("Generate daily broad AI podcast script") < workflow.indexOf("Optimise social content for audience response"), "podcast must exist before social routing");
assert.doesNotMatch(workflow, /full_podcast[\s\S]{0,180}campaign\.outputs\.active != 'true'/, "campaign must not disable daily podcast audio");
console.log("Output Release Gate campaign contract passed.");
