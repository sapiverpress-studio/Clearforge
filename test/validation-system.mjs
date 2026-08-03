import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repo = process.cwd();
const root = fs.mkdtempSync(path.join(os.tmpdir(), "sapiver-forge-validation-"));
const date = "2099-01-01";
const draftDir = path.join(root, "drafts", date);
const mediaDir = path.join(root, "media", date);
fs.mkdirSync(path.join(draftDir, "podcast"), { recursive: true });
fs.mkdirSync(mediaDir, { recursive: true });

const sources = [1, 2, 3].map((number) => ({
  source_name: `Source ${number}`,
  title: `Source title ${number}`,
  url: `https://example.com/source-${number}`,
  published_date: date,
  event_date: date,
  freshness_status: "current",
  freshness_basis: "Published today",
  coverage_lane: number === 3 ? "human_impact" : "confirmed_development",
  topic_category: "workplace_and_business",
  evidence_basis: "Original publication",
  confirmed_fact: `Supported fact ${number}`,
  interpretation: `Sapiver Forge interpretation ${number}`
}));
const stories = sources.map((source, index) => ({
  title: `Story ${index + 1}`,
  event_date: date,
  freshness_status: "current",
  coverage_lane: source.coverage_lane,
  topic_category: source.topic_category,
  summary: source.confirmed_fact,
  why_it_matters: "It affects practical work.",
  practical_angle: "Check the result.",
  claim_to_verify: "NONE — draft generator found no open check."
}));
const structured = {
  headline: "Validation fixture",
  dek: "A complete test edition.",
  sources,
  story_summaries: stories,
  main_article: "article-body",
  practical_takeaway: "Check before release.",
  what_to_test_next: "Run the gate.",
  claims_to_verify: [],
  social: {
    tiktok_script: "Freelancers sending client work should verify each important name number link and claim before release today.",
    youtube_shorts_script: "Freelancers can avoid preventable client-facing mistakes by checking names, numbers, links and claims before release.",
    facebook_post: "If AI helped draft client work, which fact do you check first before sending it?",
    pinterest_title: "AI client work verification checklist",
    pinterest_description: "A practical save-for-later check for freelancers reviewing names, numbers, links and claims in AI-assisted client work.",
    linkedin_post: "A practical human check belongs before every AI-assisted client handoff.",
    quote_card_lines: ["Check facts before client delivery.", "Human approval remains accountable.", "Sources need accurate interpretation.", "A citation is not automatic proof.", "Review the exact final version."]
  }
};
const articleTail = "UNIQUE_COMPLETE_ARTICLE_END";
const featureTail = "UNIQUE_COMPLETE_FEATURE_END";
const podcastTail = "UNIQUE_COMPLETE_PODCAST_END";
const article = `# Fixture\n\nStatus: Claim and structural checks passed — human approval pending\n\n${"article ".repeat(600)}${articleTail}`;
const feature = `# Fixture feature\n\n${"feature ".repeat(1300)}\n\n## Sources\n\n${featureTail}`;
const podcast = `${"podcast ".repeat(1300)}${podcastTail}`;

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}
function run(script, extraEnv = {}) {
  return spawnSync(process.execPath, [path.join(repo, script)], {
    cwd: root,
    env: { ...process.env, SAPIVER_FORGE_DATE: date, ...extraEnv },
    encoding: "utf8"
  });
}

writeJson(path.join(draftDir, "structured_output.json"), structured);
writeJson(path.join(draftDir, "validation.json"), { passed: true, failures: [], warnings: [] });
writeJson(path.join(draftDir, "approval.json"), { article_approved: true });
writeJson(path.join(draftDir, "claim-verification.json"), {
  passed: true,
  confidence: 0.97,
  checked_outputs: ["structured_output", "daily_article", "full_feature", "podcast_script"],
  missing_outputs: [],
  blocking_findings: [],
  findings: [{
    output: "structured_output",
    exact_claim: "Supported fact 1",
    classification: "verified_fact",
    status: "supported",
    severity: "info",
    reason: "Supported by the original source.",
    required_correction: "",
    source_url: "https://example.com/source-1"
  }],
  summary: "All material claims passed."
});
fs.copyFileSync(
  path.join(draftDir, "claim-verification.json"),
  path.join(draftDir, "claim-verification-initial.json")
);
const imageFiles = ["one.png", "two.png", "three.png"];
writeJson(path.join(mediaDir, "media-manifest.json"), {
  stories: imageFiles.map((file) => ({ file: `media/${date}/${file}` }))
});
for (const file of imageFiles) fs.writeFileSync(path.join(mediaDir, file), "test-image");
fs.writeFileSync(path.join(draftDir, "daily_brief.md"), article);
fs.writeFileSync(path.join(draftDir, "feature.md"), feature);
fs.writeFileSync(path.join(draftDir, "podcast", "COPY_PASTE_INTO_ELEVENLABS.txt"), podcast);

let result = run("src/repair-material-claims.mjs", { OPENAI_API_KEY: "not-used-for-passing-report" });
assert.equal(result.status, 0, result.stderr);

result = run("src/build-release-desk.mjs");
assert.equal(result.status, 0, result.stderr);
let report = JSON.parse(fs.readFileSync(path.join(draftDir, "release-desk.json"), "utf8"));
let html = fs.readFileSync(path.join(draftDir, `sapiver-forge-release-desk-${date}.html`), "utf8");
assert.equal(report.decision, "HUMAN REVIEW");
assert.equal(report.claim_verification.passed, true);
assert.match(html, new RegExp(articleTail));
assert.match(html, new RegExp(featureTail));
assert.match(html, new RegExp(podcastTail));
assert.match(html, /Independent claim verification/);
assert.equal(report.component_scores.technical_readiness, 1);

fs.unlinkSync(path.join(mediaDir, "three.png"));
result = run("src/build-release-desk.mjs");
assert.equal(result.status, 0, result.stderr);
report = JSON.parse(fs.readFileSync(path.join(draftDir, "release-desk.json"), "utf8"));
assert.equal(report.decision, "STOP");
assert.ok(report.hard_stops.some((item) => item.includes("only 2 readable image file(s)")));
fs.writeFileSync(path.join(mediaDir, "three.png"), "test-image");
result = run("src/build-release-desk.mjs");
assert.equal(result.status, 0, result.stderr);
report = JSON.parse(fs.readFileSync(path.join(draftDir, "release-desk.json"), "utf8"));
assert.equal(report.decision, "HUMAN REVIEW");

result = run("src/approve-release.mjs", {
  SAPIVER_FORGE_APPROVER: "test-reviewer",
  SAPIVER_FORGE_CONFIRMATION: `APPROVE ${date}`
});
assert.equal(result.status, 0, result.stderr);

writeJson(path.join(draftDir, "claim-verification.json"), {
  passed: false,
  confidence: 0.96,
  checked_outputs: ["structured_output", "daily_article", "full_feature", "podcast_script"],
  missing_outputs: [],
  blocking_findings: [{
    exact_claim: "61% verify outputs",
    reason: "The statistic measured independent action, not output verification."
  }],
  findings: [],
  summary: "Correction required."
});
result = run("src/build-release-desk.mjs");
assert.equal(result.status, 0, result.stderr);
report = JSON.parse(fs.readFileSync(path.join(draftDir, "release-desk.json"), "utf8"));
assert.equal(report.decision, "STOP");
assert.ok(report.hard_stops.some((item) => item.includes("61% verify outputs")));

result = run("src/approve-release.mjs", {
  SAPIVER_FORGE_APPROVER: "test-reviewer",
  SAPIVER_FORGE_CONFIRMATION: `APPROVE ${date}`
});
assert.notEqual(result.status, 0, "STOP edition must not be approvable");

fs.rmSync(root, { recursive: true, force: true });
console.log("Validation-system regression test passed.");
