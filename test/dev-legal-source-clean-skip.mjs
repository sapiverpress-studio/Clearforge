import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repo = process.cwd();
const root = fs.mkdtempSync(path.join(os.tmpdir(), "sapiver-dev-legal-"));
const edition = "2026-08-03";
const draft = path.join(root, "drafts", edition);
const fixture = path.join(root, "fixture");
fs.mkdirSync(draft, { recursive: true });
fs.mkdirSync(path.join(root, "config"), { recursive: true });
fs.mkdirSync(fixture, { recursive: true });
fs.copyFileSync(path.join(repo, "config/output-release-validation-campaign.json"), path.join(root, "config/output-release-validation-campaign.json"));

const url = "https://dev.to/example/eu-ai-act-article-50";
fs.writeFileSync(path.join(draft, "structured_output.json"), JSON.stringify({
  sources: [{ acquisition_id: "exa-dev", title: "EU AI Act Article 50", url, published_date: "2026-08-02", confirmed_fact: "Article 50 of the EU AI Act requires deployers to disclose AI-generated public-interest text unless it has undergone human editorial control.", interpretation: "Sapiver Forge interpretation." }],
  story_summaries: [{ title: "Article 50", summary: "A legal claim", why_it_matters: "Release review", claim_to_verify: "NONE" }]
}));
fs.writeFileSync(path.join(draft, "source-acquisition.json"), JSON.stringify({ candidates: [{ acquisition_id: "exa-dev", requested_url: url, final_url: url, page_title: "EU AI Act Article 50", publication_date: "2026-08-02T19:37:52Z", usable_source_text: "Article 50 contains disclosure obligations. ".repeat(10), retrieval_status: "preflight_passed_with_exa_text", direct_http_status: 200 }] }));
fs.writeFileSync(path.join(fixture, "source-1.html"), `<html><head><title>EU AI Act Article 50</title></head><body><nav>Skip to content Log in Create account Add reaction Share to Facebook Report Abuse</nav><main><p>This article was written by an autonomous AI agent.</p><p>Article 50 contains an exception for certain AI-generated text that has undergone human review or editorial control.</p></main></body></html>`);

const validation = spawnSync(process.execPath, [path.join(repo, "src/validate-source-integrity.mjs")], { cwd: root, encoding: "utf8", env: { ...process.env, CLEARFORGE_DATE: edition, SAPIVER_FORGE_ALLOW_SOURCE_FIXTURES: "1", SOURCE_FIXTURE_DIR: fixture } });
assert.notEqual(validation.status, 0, "non-authoritative detailed legal source must be rejected");
const report = JSON.parse(fs.readFileSync(path.join(draft, "source-integrity-report.json"), "utf8"));
assert.equal(report.survivor_count, 0);
assert.match(JSON.stringify(report), /official or authoritative source/);

const recorded = spawnSync(process.execPath, [path.join(repo, "src/record-no-usable-verified-core.mjs")], { cwd: root, encoding: "utf8", env: { ...process.env, CLEARFORGE_DATE: edition } });
assert.equal(recorded.status, 0, recorded.stderr);
const skipped = JSON.parse(fs.readFileSync(path.join(draft, "no-public-content.json"), "utf8"));
assert.equal(skipped.status, "no_public_content");
assert.equal(skipped.verification_completed, true);
assert.equal(fs.existsSync(path.join(draft, "locked-facts.json")), false, "no locked facts may be created from the rejected source");
console.log("DEV legal-source clean-skip regression passed.");
