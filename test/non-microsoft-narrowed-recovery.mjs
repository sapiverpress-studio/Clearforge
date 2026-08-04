import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "sapiver-narrowed-generic-"));
const edition = "2026-08-04";
const draft = path.join(root, "drafts", edition);
fs.mkdirSync(draft, { recursive: true });
const supported = "Intuit announced an AI-powered feature for its accountant suite.";
fs.writeFileSync(path.join(draft, "structured_output.json"), JSON.stringify({
  headline: "Unsupported original angle", dek: "Draft", main_article: "Intuit announced an AI-powered feature. Adoption reached 91%.",
  practical_takeaway: "Test it.", what_to_test_next: "Review it.", claims_to_verify: [],
  sources: [{ source_name: "Intuit", title: "Intuit announcement", url: "https://www.intuit.com/example", published_date: "2026-08-04", confirmed_fact: `${supported} Adoption reached 91%.`, interpretation: "Sapiver Forge interpretation: test it in a bounded workflow." }],
  story_summaries: [{ title: "Intuit announcement", summary: supported, why_it_matters: "Test it", practical_angle: "Review it" }],
  social: { tiktok_script: "Adoption reached 91%.", tiktok_caption: "91% adoption.", youtube_shorts_script: "91% adoption.", facebook_post: "91% adoption.", pinterest_title: "AI adoption", pinterest_description: "91% adoption.", linkedin_post: "91% adoption.", quote_card_lines: ["91%", "91%", "91%", "91%", "91%"] },
  headline_options: ["One", "Two", "Three", "Four", "Five"]
}, null, 2));
fs.writeFileSync(path.join(draft, "source-evidence.json"), JSON.stringify({ records: [{
  source_index: 0, final_url: "https://www.intuit.com/example", page_title: "Intuit announcement",
  verified_claims: [{ id: "source-1-claim-1", atomic_claim: supported, source_url: "https://www.intuit.com/example", evidence_passage: supported, evidence_location: { type: "character_offsets", start: 0, end: supported.length }, verification_checks: { numbers: [], entities: [{ value: "Intuit", supported: true }], dates: [], comparisons: [], quotes: [] }, supported_numbers: [], supported_entities: ["Intuit"], verification_status: "verified", qualification: "" }],
  unsupported_claims: [{ atomic_claim: "Adoption reached 91%.", verification_status: "unsupported", failed_checks: ["numbers:91%"] }]
}] }, null, 2));

const env = { ...process.env, SAPIVER_FORGE_DATE: edition, NARROWED_REBUILD_DISABLE_MODEL: "1" };
for (const script of ["src/rebuild-narrowed-edition.mjs", "src/enforce-locked-facts.mjs", "src/ensure-output-usability.mjs"]) {
  const run = spawnSync(process.execPath, [path.resolve(script)], { cwd: root, env, encoding: "utf8" });
  assert.equal(run.status, 0, `${script} failed:\n${run.stdout}\n${run.stderr}`);
}
const output = JSON.parse(fs.readFileSync(path.join(draft, "structured_output.json"), "utf8"));
const rendered = JSON.stringify(output);
for (const marker of ["91%", "Microsoft", "Slack", "Shopify", "Python", "live dashboards", "prompting skills"]) {
  assert.equal(rendered.includes(marker), false, `Generic recovery must not introduce ${marker}.`);
}
assert.ok(output.main_article.trim().split(/\s+/).length >= 150);
assert.ok(output.social.tiktok_caption.trim().split(/\s+/).length >= 12);
assert.ok(output.social.tiktok_script.trim().split(/\s+/).length <= 60, "fallback TikTok must remain a usable single-story script");
assert.equal(output.social.tiktok_script.includes("91%"), false);
assert.match(output.social.tiktok_script, /^Intuit announced/);
assert.equal(output.social.pinterest_title, "Sapiver Forge: test one bounded AI task");
assert.doesNotMatch(output.social.pinterest_title, /retrieved evidence|original draft/i);
assert.equal(output.social.quote_card_lines.length, 5);
console.log("Source-neutral narrowed-edition recovery passed for a non-Microsoft story.");
