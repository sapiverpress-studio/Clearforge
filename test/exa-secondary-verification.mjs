import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "sapiver-exa-secondary-"));
const edition = "2026-08-05";
const draft = path.join(root, "drafts", edition);
const fixtures = path.join(root, "fixtures");
fs.mkdirSync(draft, { recursive: true });
fs.mkdirSync(fixtures, { recursive: true });
const url = "https://publisher.example/ai-announcement";
const claim = "Example Corp announced an AI assistant for finance teams.";
const sourceText = `${claim} The announcement explains that the assistant remains subject to administrator controls and human review before release.`;
fs.writeFileSync(path.join(draft, "structured_output.json"), JSON.stringify({
  sources: [{ acquisition_id: "exa-test", source_name: "publisher.example", title: "AI announcement", url, published_date: "2026-08-05", confirmed_fact: claim }],
  story_summaries: [{ title: "AI announcement", summary: claim, why_it_matters: "A controlled feature", practical_angle: "Review before use" }]
}));
fs.writeFileSync(path.join(draft, "source-acquisition.json"), JSON.stringify({ candidates: [{
  acquisition_id: "exa-test", requested_url: url, final_url: url, page_title: "AI announcement", publication_date: "2026-08-05",
  usable_source_text: sourceText, retrieval_status: "retrieved_by_exa_after_publisher_block", direct_http_status: 403
}] }));
fs.writeFileSync(path.join(fixtures, "source-1.html"), "");
fs.writeFileSync(path.join(fixtures, "source-1.json"), JSON.stringify({ status: 403, final_url: url }));

const run = spawnSync(process.execPath, [path.resolve("src/validate-source-integrity.mjs")], {
  cwd: root, encoding: "utf8", env: { ...process.env, CLEARFORGE_DATE: edition, SAPIVER_FORGE_ALLOW_SOURCE_FIXTURES: "1", SOURCE_FIXTURE_DIR: fixtures }
});
assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
const report = JSON.parse(fs.readFileSync(path.join(draft, "source-integrity-report.json"), "utf8"));
const evidence = JSON.parse(fs.readFileSync(path.join(draft, "source-evidence.json"), "utf8"));
assert.equal(report.passed, true);
assert.equal(evidence.records[0].retrieval_status, "retrieved_from_sealed_exa_acquisition");
assert.equal(evidence.records[0].retrieval_provider, "exa");
assert.equal(evidence.records[0].verified_claims[0].atomic_claim, claim);
console.log("Sealed Exa evidence can verify a publisher-blocked source without accepting 404 URLs.");
