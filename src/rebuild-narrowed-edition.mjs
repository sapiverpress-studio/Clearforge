import fs from "node:fs";
import path from "node:path";
import { hasUsableEvidenceLocation, isMeaningfulEvidencePassage, isUsableAtomicClaim, verifyAtomicClaim } from "./evidence-verification.mjs";

const ROOT = process.cwd();
const DATE = process.env.SAPIVER_FORGE_DATE || process.env.SAPIVER_FORGE_DATE || new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());
const dir = path.join(ROOT, "drafts", DATE);
const structuredPath = path.join(dir, "structured_output.json");
const evidencePath = path.join(dir, "source-evidence.json");
const reportPath = path.join(dir, "narrowed-edition-rebuild.json");
if (!fs.existsSync(structuredPath) || !fs.existsSync(evidencePath)) throw new Error("Narrowed rebuild requires structured output and verified source evidence.");

const data = JSON.parse(fs.readFileSync(structuredPath, "utf8"));
const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
const records = Array.isArray(evidence.records) ? evidence.records : [];
function claimIsLockable(claim, record) {
  let publisher = "";
  try { publisher = new URL(claim.source_url || record?.final_url).hostname.split(".").find((part) => !/^(?:www|com|org|net|co|uk)$/i.test(part)) || ""; } catch {}
  const sourceContext = `${publisher ? `${publisher} published this report. ` : ""}${record?.page_title || ""} ${claim.evidence_passage || ""}`;
  return claim?.verification_status === "verified"
    && isUsableAtomicClaim(claim.atomic_claim)
    && isMeaningfulEvidencePassage(claim.evidence_passage)
    && hasUsableEvidenceLocation(claim.evidence_location)
    && verifyAtomicClaim(claim.atomic_claim, sourceContext).supported;
}
const rejectedVerified = records.flatMap((record) => (record.verified_claims || []).filter((claim) => !claimIsLockable(claim, record)).map((claim) => ({
  atomic_claim: claim.atomic_claim, verification_status: "rejected_before_rebuild", failed_checks: ["claim:not-lockable"]
})));
const unsupported = [...records.flatMap((record) => record.unsupported_claims || []), ...rejectedVerified];
if (!unsupported.length) {
  console.log("No unsupported atomic claims; narrowed-edition rebuild not required.");
  process.exit(0);
}
const verifiedEntries = records.flatMap((record) => (record.verified_claims || []).filter((claim) => claimIsLockable(claim, record)).map((claim) => ({ claim, record })));
const verified = verifiedEntries.map((item) => item.claim);
if (!verified.length) throw new Error("No verified factual core remains for a narrowed edition.");

const factText = verified.map((claim) => claim.atomic_claim).join("\n\n").trim();
function standaloneClaimScore(claim) {
  const text = String(claim.atomic_claim || "").trim();
  let score = 100 - Math.min(text.split(/\s+/).length, 70);
  if (/^(?:however|although|but|and|therefore|consequently|overall|meanwhile|they|it|this|these|those)\b/i.test(text)) score -= 100;
  if (!/\b[A-Z][A-Za-z0-9&.'’-]{2,}\b/.test(text)) score -= 30;
  if (/\b(?:is|are|was|were|has|have|found|reported|announced|published|takes?|turns?|uses?|shows?|describes?)\b/i.test(text)) score += 10;
  return score;
}
const primaryClaim = [...verified].sort((a, b) => standaloneClaimScore(b) - standaloneClaimScore(a))[0];
const primaryFactText = String(primaryClaim?.atomic_claim || factText).trim();
const evidenceText = verified.map((claim) => claim.evidence_passage).join(" ").trim();
const primaryEntry = verifiedEntries.find((item) => item.claim === primaryClaim) || verifiedEntries[0];
const sourceUrl = primaryClaim?.source_url || primaryEntry?.record?.final_url || "";
const sourceTitle = primaryEntry?.record?.page_title || "Verified AI development";
const existingSocial = data.social || {};
const urls = [...new Set(JSON.stringify(existingSocial).match(/https:\/\/[^\s"\\]+/g) || [])];
const commercialLinks = urls.filter((url) => /sapiver-press\.kit\.com|payhip\.com/.test(url)).join("\n");
const interpretation = "Sapiver Forge interpretation: this development makes workflow design, clear boundaries and human review practical areas to examine before expanding AI use.";

function fallbackEdition() {
  const article = `${factText}\n\nSapiver Forge interpretation: this verified development is worth testing against one real task instead of treating it as a reason to automate an entire operation. Start with a bounded use, define the input and decide what a useful result would look like.\n\nSapiver Forge interpretation: creators, freelancers and small teams may benefit from writing down what the AI can access, what it may change and which action remains reserved for a person. That turns a broad development into a controlled experiment.\n\nSapiver Forge interpretation: review should happen at a named release point. Check factual accuracy, tone, permissions, privacy and whether the result still serves the original purpose before it is sent, published or used.\n\nSapiver Forge interpretation: speed alone may not show whether the experiment worked. Record correction time, avoidable errors, useful output and the effort required from the reviewer. Keep, adjust or stop the workflow from that evidence.\n\nSapiver Forge interpretation: the Applied AI Gate System provides a structure for this sequence—assess the opportunity, set workflow controls, review the output and examine the outcome. The cited source does not endorse Sapiver Forge; this is our practical application of the verified fact above.\n\nSource: ${sourceUrl}`;
  const tiktok = `${primaryFactText} Sapiver Forge interpretation: test one bounded use, define the AI boundary and keep a named human release decision.`;
  const caption = `${primaryFactText}\n\nSapiver Forge interpretation: test one bounded task, define the AI boundary and keep a named human release decision before expanding the workflow.\n\n${commercialLinks}`.trim();
  return {
    headline: "A verified AI development worth testing carefully",
    dek: "A narrower, source-supported Sapiver Forge briefing with unsupported claim components removed.",
    main_article: article,
    practical_takeaway: "Map one repeated workflow, name the AI boundary and require a human decision before anything is sent, published or allowed to act.",
    what_to_test_next: "Sapiver Forge interpretation: test one low-risk workflow and record time saved, corrections needed, access granted and the person responsible for release.",
    claims_to_verify: [],
    headline_options: [
      "A verified AI development worth testing carefully",
      "What the retrieved evidence supports",
      "Turn this AI development into a bounded test",
      "Define the human release point before expanding AI",
      "A narrower AI briefing built from verified evidence"
    ],
    social: {
      tiktok_script: tiktok,
      tiktok_caption: caption,
      tiktok_caption_prompt: caption,
      youtube_shorts_script: tiktok,
      facebook_post: `${primaryFactText}\n\n${interpretation} Start with one bounded use and name the human release decision.\n\n${commercialLinks}`.trim(),
      pinterest_title: "Sapiver Forge: test one bounded AI task",
      pinterest_description: `${interpretation} Map the task, permissions, boundaries and approval step before scaling it.\n\n${commercialLinks}`.trim(),
      linkedin_post: `${primaryFactText}\n\n${interpretation}\n\nThe practical move is to map one workflow and name the human release decision.\n\n${commercialLinks}`.trim(),
      quote_card_lines: [
        "Sapiver Forge interpretation: test one bounded task first.",
        "Sapiver Forge interpretation: define what AI may access.",
        "Sapiver Forge interpretation: name the human release decision.",
        "Sapiver Forge interpretation: measure corrections as well as speed.",
        "Sapiver Forge interpretation: expand only after reviewing the outcome."
      ]
    }
  };
}

const rebuilt = fallbackEdition();
const method = "deterministic_verified_rebuild";
const modelError = "";

Object.assign(data, rebuilt, { claims_to_verify: [], narrowed_from_unsupported_claims: true });
delete data.audience_fit;
delete data.social_mode;
delete data.social_source;
if (data.editorial_theme && typeof data.editorial_theme === "object") {
  data.editorial_theme.focus = "A short evidence-led edition built around the verified facts that survived source review.";
}
const previousSources = Array.isArray(data.sources) ? data.sources : [];
data.sources = verifiedEntries.map(({ claim, record }) => {
  const source = previousSources.find((item) => item.acquisition_id && item.acquisition_id === record.acquisition_id)
    || previousSources.find((item) => item.url === record.final_url || item.url === record.requested_url)
    || {};
  return {
    ...source,
    source_name: source.source_name || new URL(record.final_url || claim.source_url).hostname,
    title: record.page_title || source.title || "Verified source",
    url: claim.source_url || record.final_url,
    published_date: String(record.publication_date || source.published_date || DATE).slice(0, 10),
    confirmed_fact: claim.atomic_claim,
    interpretation,
    evidence_basis: "Retrieved source body text with atomic evidence verification."
  };
});
data.story_summaries = data.sources.map((source) => ({
  title: source.title,
  summary: source.confirmed_fact,
  why_it_matters: interpretation,
  practical_angle: rebuilt.practical_takeaway,
  coverage_lane: source.coverage_lane || "confirmed_development",
  topic_category: source.topic_category || "workplace_and_business",
  claim_to_verify: "NONE — verified from cited source evidence."
}));
fs.writeFileSync(structuredPath, `${JSON.stringify(data, null, 2)}\n`);

const sourceLines = data.sources.map((source) => `- [${source.title || sourceTitle}](${source.url || sourceUrl})\n  - Verified fact: ${source.confirmed_fact}\n  - ${interpretation}`).join("\n");
fs.writeFileSync(path.join(dir, "daily_brief.md"), `# ${rebuilt.headline}\n\nStatus: Draft — human approval required\n\n${rebuilt.dek}\n\n## Verified source and evidence\n\n${sourceLines}\n\n## Main article\n\n${rebuilt.main_article}\n\n## Practical takeaway\n\n${rebuilt.practical_takeaway}\n\n## What to test next\n\n${rebuilt.what_to_test_next}\n\n## Verification status\n\nUnsupported proposed claim components were excluded. Retained material is listed in the evidence ledger.\n`);
fs.writeFileSync(path.join(dir, "social_pack.md"), `# Sapiver Forge Social Pack — ${DATE}\n\nStatus: Draft — human approval required\n\n## TikTok Script\n\n${rebuilt.social.tiktok_script}\n\n## TikTok Caption\n\n${rebuilt.social.tiktok_caption}\n\n## YouTube Shorts Script\n\n${rebuilt.social.youtube_shorts_script}\n\n## Facebook Post\n\n${rebuilt.social.facebook_post}\n\n## Pinterest Pin\n\n**Title:** ${rebuilt.social.pinterest_title}\n\n**Description:** ${rebuilt.social.pinterest_description}\n\n## LinkedIn-Style Post\n\n${rebuilt.social.linkedin_post}\n\n## Quote Cards\n\n${rebuilt.social.quote_card_lines.map((line) => `- ${line}`).join("\n")}\n`);
fs.writeFileSync(reportPath, `${JSON.stringify({ edition: DATE, rebuilt: true, method, model_error: modelError, verified_fact_count: verified.length, excluded_claim_count: unsupported.length }, null, 2)}\n`);
console.log(`Rebuilt narrowed edition using ${method}: ${verified.length} verified fact(s), ${unsupported.length} excluded claim(s).`);
