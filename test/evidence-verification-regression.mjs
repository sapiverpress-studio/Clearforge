import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { buildVerifiedClaims, extractDates, extractMaterialNumbers, extractUsableText, isMeaningfulEvidencePassage, splitAtomicClaims, splitSentences, verifyAtomicClaim } from "../src/evidence-verification.mjs";

assert.deepEqual(splitSentences("Qwen3.8-Max is a 2.4-trillion-parameter model. It launched today."), [
  "Qwen3.8-Max is a 2.4-trillion-parameter model.", "It launched today."
], "decimal points and dotted model names must not be mistaken for sentence boundaries");
assert.deepEqual(splitAtomicClaims("Solo-type applications rose 26.8%. Qwen3.8-Max has 2.4 trillion parameters."), [
  "Solo-type applications rose 26.8%.", "Qwen3.8-Max has 2.4 trillion parameters."
], "atomic claims must retain complete decimal statistics and model names");
assert.deepEqual(splitSentences("Source: https://www.brookings.edu/articles/example/ Next sentence."), [
  "Source: https://www.brookings.edu/articles/example/ Next sentence."
], "sentence handling must never insert spaces into URL domains");
assert.deepEqual(extractDates("People may contribute less in May 2026."), ["May 2026"], "lowercase modal may must not become a date");
assert.equal(extractMaterialNumbers("Transparency requirements &#8211; apply.").includes("8211"), true, "raw HTML entities demonstrate why extraction must decode before number checks");
assert.equal(extractMaterialNumbers(extractUsableText("<p>Transparency requirements &#8211; apply.</p>")).includes("8211"), false, "decoded HTML punctuation must not become a material number");

const microsoftText = `Microsoft describes the next measure of AI momentum as work transformed. Organizations are moving from individual assistance towards redesigned workflows and role-specific agents. Leaders should examine how work is redesigned across teams.`;
const falseCompound = "Microsoft found that organizational readiness accounts for 67% of realised AI value, twice the impact of individual prompting skills, in a survey of 20,000 workers across 10 countries.";
const microsoft = buildVerifiedClaims(falseCompound, microsoftText, "The next measure of AI momentum is work transformed");
assert.equal(microsoft.atomic.some((item) => item.supported), false, "fabricated Microsoft statistics must not verify");
assert.ok(microsoft.verified.some((item) => /redesigned workflows|work transformed/i.test(item.claim)), "source may survive on a narrower exact claim");
for (const marker of ["67%", "20,000", "10 countries", "twice"]) {
  assert.equal(microsoft.verified.some((item) => item.claim.includes(marker)), false, `${marker} must not enter verified facts`);
}

assert.equal(verifyAtomicClaim("The trial reported 42% adoption.", "The trial reported 42% adoption among participating teams.").supported, true, "verbatim percentage should verify");
const brookingsClaim = "Attributing creative work to AI leads to a measurable decline in perceived task meaning and a 3.4 percentage point reduction in the willingness to contribute voluntary effort.";
const brookingsEvidence = "Respondents found the task less meaningful when they thought that the slogans were AI-generated. Respondents in the AI-label condition were also less willing to contribute a slogan of their own by 3.4 percentage points.";
assert.equal(verifyAtomicClaim(brookingsClaim, brookingsEvidence).supported, true, "an exact statistic in its directly entailing evidence passage must survive paraphrase variation");
assert.equal(verifyAtomicClaim("Solo-type business applications rose 26.8%.", "Solo-type business applications are rising most in AI-exposed sectors. A separate table contains 26.8% for another measure.").supported, false, "a number elsewhere on the page must not authenticate a claim whose evidence passage lacks it");
assert.equal(verifyAtomicClaim('Microsoft called the change "work transformed".', "Microsoft called the change work redesigned.").supported, false, "quoted wording must appear in the source");
assert.equal(verifyAtomicClaim("Teams redesigned workflows around role-specific agents.", "The programme enabled teams to redesign their workflows around agents built for specific roles.").supported, true, "directly entailed paraphrase should verify");

const partial = buildVerifiedClaims("The study included 500 people and reported 38% adoption.", "The study included 500 people. It did not publish an adoption rate.");
assert.ok(partial.verified.some((item) => /500/.test(item.claim)), "supported component should survive");
assert.equal(partial.verified.some((item) => /38%/.test(item.claim)), false, "unsupported component should be excluded");

assert.equal(buildVerifiedClaims("Publisher claim 88%.", "").verified.length, 0, "publisher-blocked/no-body source cannot verify detailed claims");

const devBoilerplate = "EU AI Act Article 50: What My Agent Workspace Changed - DEV Community Skip to content Powered by Algolia Log in Create account DEV Community Add reaction Like Unicorn Exploding Head Raised Hands Fire Jump to Comments Save Boost Copy link Copied to Clipboard Share to X Share to LinkedIn Share to Facebook Report Abuse.";
assert.equal(isMeaningfulEvidencePassage(devBoilerplate), false, "navigation and reaction furniture must never become evidence");
const shareFurniture = "EU AI Act Article 50 Share Share on Twitter LinkedIn Email The disclosure duty applies to covered systems.";
assert.equal(isMeaningfulEvidencePassage(shareFurniture), false, "share controls embedded in otherwise plausible prose must invalidate the evidence passage");
const repeatedPublisherTitle = "Samsung Bespoke AI Appliances Review: The Future of Smart Home Automation - Phadera Tech : Smartphone Reviews & Latest Gadget News # Samsung Bespoke AI Appliances Review: The Future of Smart Home Automation In an era where artificial intelligence is transforming daily life, Samsung is pushing AI into living spaces.";
assert.equal(verifyAtomicClaim(repeatedPublisherTitle, repeatedPublisherTitle).supported, false, "a repeated headline and publisher category block must not verify merely because it appears verbatim");
assert.equal(buildVerifiedClaims("A detailed legal claim that is absent.", devBoilerplate, "EU AI Act Article 50").verified.length, 0, "boilerplate fallback must not create a verified core");
assert.equal(extractUsableText("<html><script>fake 99%</script><body><main>Usable report text.</main></body></html>"), "Usable report text.", "scripts and metadata are not usable source evidence");

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "sapiver-evidence-regression-"));
const edition = "2026-08-03";
const draft = path.join(temp, "drafts", edition);
fs.mkdirSync(path.join(draft, "podcast"), { recursive: true });
fs.writeFileSync(path.join(draft, "structured_output.json"), JSON.stringify({
  headline: "Microsoft describes redesigned workflows.",
  main_article: "Microsoft describes redesigned workflows. The result was 67%. EU AI Act Article 50 Share Share on Twitter LinkedIn Email requires disclosure.",
  social: { tiktok_script: "Microsoft describes redesigned workflows. Adoption reached 67%.", facebook_post: "Microsoft describes redesigned workflows.", pinterest_title: "Sapiver Forge: test one bounded AI task" },
  sources: [{ source_name: "Microsoft", confirmed_fact: falseCompound, interpretation: "Workflow design may matter more commercially than isolated prompt training." }]
}));
fs.writeFileSync(path.join(draft, "source-evidence.json"), JSON.stringify({ records: [{
  final_url: "https://www.microsoft.com/example", verified_claims: [{
    atomic_claim: "Microsoft describes organizations moving toward redesigned workflows and role-specific agents.",
    source_url: "https://www.microsoft.com/example", evidence_passage: "Organizations are moving from individual assistance towards redesigned workflows and role-specific agents.",
    evidence_location: { type: "character_offsets", start: 55, end: 160 }, verification_checks: { numbers: [], entities: [{ value: "Microsoft", supported: true }], dates: [], comparisons: [] },
    supported_numbers: [], supported_entities: ["Microsoft"], verification_status: "verified", qualification: ""
  }, {
    atomic_claim: "EU AI Act Article 50 requires disclosure.", source_url: "https://www.microsoft.com/example",
    evidence_passage: "EU AI Act Article 50 Share Share on Twitter LinkedIn Email requires disclosure.",
    evidence_location: { type: "character_offsets", start: 170, end: 245 }, verification_checks: { numbers: [], entities: [], dates: [], comparisons: [] },
    supported_numbers: [], supported_entities: ["EU AI Act"], verification_status: "verified", qualification: ""
  }], unsupported_claims: [{ atomic_claim: falseCompound, verification_status: "unsupported", failed_checks: ["numbers:67%", "numbers:20000", "comparison:twice"] }]
}] }));
fs.writeFileSync(path.join(draft, "feature.md"), "# Feature\n\nMicrosoft describes redesigned workflows. Slack and Shopify use Python execution with live dashboards. The claimed result was 67%.\n");
fs.writeFileSync(path.join(draft, "social_pack.md"), "# Social\n\nMicrosoft describes redesigned workflows. The result was 67%.\n");
fs.writeFileSync(path.join(draft, "podcast", "COPY_PASTE_INTO_ELEVENLABS.txt"), "Microsoft describes redesigned workflows.\n");
const enforce = spawnSync(process.execPath, [path.resolve("src/enforce-locked-facts.mjs")], { cwd: temp, env: { ...process.env, SAPIVER_FORGE_DATE: edition }, encoding: "utf8" });
assert.equal(enforce.status, 0, enforce.stderr);
const locked = JSON.parse(fs.readFileSync(path.join(draft, "locked-facts.json"), "utf8"));
assert.equal(locked.facts.some((item) => /67%|20,000|10 countries|twice/.test(item.atomic_claim)), false, "false claim must not enter locked-facts.json");
assert.equal(locked.facts.some((item) => /Article 50/.test(item.atomic_claim)), false, "a claim backed by contaminated evidence must not enter locked-facts.json");
const allOutputs = ["structured_output.json", "feature.md", "social_pack.md"].map((file) => fs.readFileSync(path.join(draft, file), "utf8")).join("\n");
for (const marker of ["67%", "Slack", "Shopify", "Python", "dashboards", "Share Share on Twitter", "Twitter LinkedIn Email"]) assert.equal(allOutputs.includes(marker), false, `${marker} must be removed from generated outputs`);
const discipline = JSON.parse(fs.readFileSync(path.join(draft, "fact-discipline-report.json"), "utf8"));
assert.ok(discipline.change_count >= 2, "candidate review must not claim there were no verification concerns");

console.log("Evidence-backed verification regression suite passed.");
