import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "sapiver-failed-candidate-replay-"));
const edition = "2026-08-04";
const draft = path.join(root, "drafts", edition);
fs.mkdirSync(path.join(draft, "podcast"), { recursive: true });
fs.mkdirSync(path.join(root, "config"), { recursive: true });
fs.copyFileSync(path.join(repo, "config", "output-release-validation-campaign.json"), path.join(root, "config", "output-release-validation-campaign.json"));

const brookings = "Attributing creative work to AI leads to a measurable decline in perceived task meaning and a 3.4 percentage point reduction in voluntary effort.";
const brookingsEvidence = "Compared to the human-label group, the AI-label group saw a drop in task meaning of about 0.07 standard deviations. Respondents in the AI-label condition were also less willing to contribute a slogan of their own by 3.4 percentage points.";
const brokenClaims = [
  ["and energy management.", "Samsung refrigerator reporting includes AI energy management features."],
  ["LifeOS: The AI Harness That Installs Itself | Starlog > try starlog. dev ↗ vibe-coding is fine.", "LifeOS promotional page furniture."],
  ["More blueprint than product Glanceboard offers a physical AI display.", "Glanceboard offers a physical AI display."]
];
const sources = [
  ...brokenClaims.map(([claim], index) => ({ acquisition_id: `broken-${index}`, source_name: "Publisher", title: `Broken source ${index}`, url: `https://example.com/broken-${index}`, published_date: edition, confirmed_fact: claim, interpretation: "Sapiver Forge interpretation: test carefully." })),
  { acquisition_id: "brookings", source_name: "Brookings", title: "When people think AI did the creative work", url: "https://www.brookings.edu/example", published_date: edition, confirmed_fact: brookings, interpretation: "Sapiver Forge interpretation: test carefully." }
];
fs.writeFileSync(path.join(draft, "structured_output.json"), `${JSON.stringify({
  headline: "Broken edition", dek: "Broken", main_article: `${brokenClaims.map(([claim]) => claim).join(" ")} ${brookings}`,
  practical_takeaway: "Review it.", what_to_test_next: "Sapiver Forge interpretation: the retrieved evidence supports a narrower conclusion than the original draft claimed.", claims_to_verify: [],
  sources,
  story_summaries: sources.map((source) => ({ title: source.title, summary: source.confirmed_fact, why_it_matters: source.interpretation, practical_angle: "Review", claim_to_verify: "NONE" })),
  social: { tiktok_script: brookings, tiktok_caption: `${brookings} ? https://payhip.com/b/pkSEY?`, youtube_shorts_script: brookings, facebook_post: `${brookings} ?`, pinterest_title: "Internal recovery", pinterest_description: "Sapiver Forge interpretation: the retrieved evidence supports a narrower conclusion than the original draft claimed.", linkedin_post: brookings, quote_card_lines: ["one", "two", "three", "four", "five"] },
  headline_options: ["One", "Two", "Three", "Four", "Five"]
}, null, 2)}\n`);
fs.writeFileSync(path.join(draft, "source-evidence.json"), `${JSON.stringify({ records: [
  ...brokenClaims.map(([claim, evidence], index) => ({ source_index: index, acquisition_id: `broken-${index}`, final_url: `https://example.com/broken-${index}`, page_title: `Broken source ${index}`, verified_claims: [{ atomic_claim: claim, source_url: `https://example.com/broken-${index}`, evidence_passage: evidence, evidence_location: { type: "unavailable", start: null, end: null }, verification_checks: {}, verification_status: "verified" }], unsupported_claims: [{ atomic_claim: `Unsupported detail ${index}.`, verification_status: "unsupported", failed_checks: ["entailment"] }] })),
  { source_index: 3, acquisition_id: "brookings", final_url: "https://www.brookings.edu/example", page_title: "When people think AI did the creative work", publication_date: edition, verified_claims: [{ atomic_claim: brookings, source_url: "https://www.brookings.edu/example", evidence_passage: brookingsEvidence, evidence_location: { type: "character_offsets", start: 100, end: 100 + brookingsEvidence.length }, verification_checks: { numbers: [{ value: "3.4 percent", supported: true }], entities: [], dates: [], comparisons: [], quotes: [] }, supported_numbers: ["3.4 percent"], supported_entities: [], verification_status: "verified" }], unsupported_claims: [] }
] }, null, 2)}\n`);
fs.writeFileSync(path.join(draft, "source-integrity-report.json"), JSON.stringify({ passed: true }));
fs.writeFileSync(path.join(draft, "narrowed-edition-rebuild.json"), JSON.stringify({ rebuilt: true }));
fs.writeFileSync(path.join(draft, "podcast", "COPY_PASTE_INTO_ELEVENLABS.txt"), "LifeOS gives coding assistants unsupported persistent memory.");
fs.writeFileSync(path.join(draft, "podcast-claim-verification.json"), JSON.stringify({ passed: true }));

function run(script) {
  const result = spawnSync(process.execPath, [path.join(repo, "src", script)], { cwd: root, encoding: "utf8", env: { ...process.env, SAPIVER_FORGE_DATE: edition, NARROWED_REBUILD_DISABLE_MODEL: "1" } });
  assert.equal(result.status, 0, `${script} failed:\n${result.stdout}\n${result.stderr}`);
}
for (const script of ["rebuild-narrowed-edition.mjs", "run-optional-podcast.mjs", "enforce-locked-facts.mjs", "finalise-social-links.mjs", "ensure-output-usability.mjs", "audit-publishability.mjs", "validate-and-approve.mjs"]) run(script);

const output = JSON.parse(fs.readFileSync(path.join(draft, "structured_output.json"), "utf8"));
const lock = JSON.parse(fs.readFileSync(path.join(draft, "locked-facts.json"), "utf8"));
const report = JSON.parse(fs.readFileSync(path.join(draft, "publishability-report.json"), "utf8"));
const corpus = `${JSON.stringify(output)}\n${fs.readFileSync(path.join(draft, "social_pack.md"), "utf8")}`;
assert.equal(report.passed, true);
assert.deepEqual(lock.facts.map((fact) => fact.atomic_claim), [brookings]);
assert.equal(output.sources.length, 1);
assert.equal(output.story_summaries.length, 1);
assert.ok(output.main_article.split(/\s+/).length >= 150);
assert.ok(output.social.tiktok_script.split(/\s+/).length <= 60);
assert.match(output.social.tiktok_caption, /pkSEY\?utm_source=tiktok&/);
assert.equal(fs.existsSync(path.join(draft, "podcast")), false);
assert.equal(fs.existsSync(path.join(draft, "podcast-claim-verification.json")), false);
for (const marker of ["and energy management", "try starlog", "vibe-coding", "retrieved evidence supports", "original draft claimed", "pkSEY?\""]) assert.equal(corpus.includes(marker), false, `${marker} survived the replay`);
console.log("Failed-candidate publishability replay passed with one clean Brookings story and no podcast expansion.");
