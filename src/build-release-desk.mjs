import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATE = process.env.CLEARFORGE_DATE || new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());
const draftDir = path.join(ROOT, "drafts", DATE);

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}
function readText(file) {
  try { return fs.readFileSync(file, "utf8").trim(); } catch { return ""; }
}
function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  })[c]);
}
function clamp(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}
function ratio(items, test) {
  return items.length ? items.filter(test).length / items.length : 0;
}
const structured = readJson(path.join(draftDir, "structured_output.json"), {});
const validation = readJson(path.join(draftDir, "validation.json"), {});
const claimVerification = readJson(path.join(draftDir, "claim-verification.json"), {});
const automated = readJson(path.join(draftDir, "approval.json"), {});
const media = readJson(path.join(ROOT, "media", DATE, "media-manifest.json"), {});
const podcastMeta = readJson(path.join(draftDir, "podcast", "episode-metadata.json"), {});
const article = readText(path.join(draftDir, "daily_brief.md"));
const feature = readText(path.join(draftDir, "feature.md"));
const podcastScript = readText(path.join(draftDir, "podcast", "COPY_PASTE_INTO_ELEVENLABS.txt"));
const sources = Array.isArray(structured.sources) ? structured.sources : [];
const stories = Array.isArray(structured.story_summaries) ? structured.story_summaries : [];
const social = structured.social || {};
const openClaims = Array.isArray(structured.claims_to_verify)
  ? structured.claims_to_verify.map(clean).filter(Boolean)
  : [];
const validationFailures = Array.isArray(validation.failures) ? validation.failures.map(clean).filter(Boolean) : [];
const validationWarnings = Array.isArray(validation.warnings) ? validation.warnings.map(clean).filter(Boolean) : [];
const storyImagePaths = Array.isArray(media.stories)
  ? media.stories.map((story) => clean(story.file)).filter(Boolean)
  : Array.isArray(media.story_images)
    ? media.story_images.map(clean).filter(Boolean)
    : [];
const readableStoryImages = storyImagePaths.filter((file) => {
  const resolved = path.isAbsolute(file) ? file : path.join(ROOT, file);
  try {
    const stat = fs.statSync(resolved);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
});
const storyImagesReady = readableStoryImages.length >= 3;

const sourceDetailScore = ratio(sources, (source) =>
  /^https:\/\//i.test(clean(source.url)) &&
  /^\d{4}-\d{2}-\d{2}$/.test(clean(source.published_date)) &&
  clean(source.confirmed_fact) &&
  clean(source.interpretation)
);
const verifiedFindings = Array.isArray(claimVerification.findings) ? claimVerification.findings : [];
const blockingFindings = Array.isArray(claimVerification.blocking_findings) ? claimVerification.blocking_findings : [];
const failedNumericAudits = Array.isArray(claimVerification.failed_numeric_audits) ? claimVerification.failed_numeric_audits : [];
const failedQualificationAudits = Array.isArray(claimVerification.failed_qualification_audits) ? claimVerification.failed_qualification_audits : [];
const failedInferenceAudits = Array.isArray(claimVerification.failed_inference_audits) ? claimVerification.failed_inference_audits : [];
const missingQualificationAudits = Array.isArray(claimVerification.missing_qualification_audits) ? claimVerification.missing_qualification_audits : [];
const missingInferenceAudits = Array.isArray(claimVerification.missing_inference_audits) ? claimVerification.missing_inference_audits : [];
const socialFields = [
  social.tiktok_script,
  social.youtube_shorts_script,
  social.facebook_post,
  social.pinterest_title,
  social.pinterest_description
];
const componentScores = {
  source_completeness: sourceDetailScore,
  claim_verification: claimVerification.passed === true ? clamp(claimVerification.confidence) : 0,
  structural_checks: validation.passed === true ? 1 : 0,
  output_consistency: clamp(ratio(socialFields, (value) => clean(value).length > 0)),
  specifics: clamp(ratio(sources, (source) =>
    /^https:\/\//i.test(clean(source.url)) && /^\d{4}-\d{2}-\d{2}$/.test(clean(source.published_date))
  )),
  privacy_rights: validationWarnings.some((item) => /privacy|confidential|licen[cs]e|rights|disclosure/i.test(item)) ? 0.5 : 1,
  technical_readiness: clamp([
    article.length > 0,
    feature.length > 0,
    podcastScript.length > 0,
    storyImagesReady
  ].filter(Boolean).length / 4)
};

const hardStops = [];
if (!article) hardStops.push("The daily article is missing.");
if (claimVerification.passed !== true) {
  hardStops.push(...(blockingFindings.length || failedNumericAudits.length || failedQualificationAudits.length || failedInferenceAudits.length || missingQualificationAudits.length || missingInferenceAudits.length
    ? [
        ...blockingFindings.map((item) => `Claim check: ${clean(item.exact_claim || item.reason || "blocking finding")}`),
        ...failedNumericAudits.map((item) => `Statistic used out of context: ${clean(item.reason || item.occurrence_id)}`),
        ...failedQualificationAudits.map((item) => `Availability/access wording failed: ${clean(item.reason || item.occurrence_id)}`),
        ...failedInferenceAudits.map((item) => `Editorial inference failed: ${clean(item.reason || item.occurrence_id)}`),
        ...missingQualificationAudits.map((item) => `Availability/access wording was not audited: ${clean(item.context || item.id)}`),
        ...missingInferenceAudits.map((item) => `Editorial inference was not audited: ${clean(item.context || item.id)}`)
      ]
    : ["Independent claim verification did not pass."]));
}
if (Number(claimVerification.confidence) < 0.9) {
  hardStops.push(`Claim-verification confidence is below 0.90 (${Number(claimVerification.confidence) || 0}).`);
}
if ((claimVerification.missing_outputs || []).length) {
  hardStops.push(`Complete outputs were not verified: ${claimVerification.missing_outputs.join(", ")}.`);
}
const structuralFailures = validationFailures.filter((item) =>
  !/independent claim verification|claim-verification confidence|claim verifier did not inspect/i.test(item)
);
if (validation.passed !== true && structuralFailures.length) hardStops.push(...structuralFailures);
if (openClaims.length) hardStops.push(`Unresolved claims remain: ${openClaims.join(" | ")}`);
if (stories.some((story) => !/^none\b/i.test(clean(story.claim_to_verify)))) hardStops.push("At least one story retains an unresolved verification check.");
if (sources.length < 3) hardStops.push(`Only ${sources.length} source(s) were supplied; at least three are required.`);
if (sources.some((source) => !/^https:\/\//i.test(clean(source.url)))) hardStops.push("At least one source lacks a valid HTTPS URL.");
if (automated.article_approved !== true) hardStops.push("The article did not pass the structural publication checks.");
if (!storyImagesReady) {
  hardStops.push(`Three generated story images are required, but only ${readableStoryImages.length} readable image file(s) were found.`);
}

const advisoryFlags = [];
if (validationWarnings.length) advisoryFlags.push(...validationWarnings);
if (!feature) advisoryFlags.push("No full feature was generated.");
if (!podcastScript) advisoryFlags.push("No podcast script was generated.");
if (/\b(medical|legal advice|financial advice|employment law|guaranteed|lawsuit|fine|penalt(?:y|ies))\b/i.test(
  `${article}\n${feature}\n${podcastScript}`
)) advisoryFlags.push("Potentially high-consequence wording was detected; inspect the relevant passage.");

const assurance = Math.min(...Object.values(componentScores));
const uniqueHardStops = [...new Map(hardStops.map((item) => [
  clean(item).toLowerCase().replace(/^(claim check:|claim verification:)\s*/, ""),
  clean(item)
])).values()];
const decision = uniqueHardStops.length ? "STOP" : "HUMAN REVIEW";
const reviewDepth = hardStops.length
  ? "Do not approve. Correct the listed stop conditions and regenerate the report."
  : assurance >= 0.96 && !advisoryFlags.length
    ? "Routine review: check the claims table, opening hooks, product references and disclosure. Full consumption is not required unless something looks wrong."
    : "Closer review: inspect every flagged section and open the linked source or full output where indicated.";

const disclosure = "Produced with AI assistance and released with human approval by Sapiver Forge.";
const approvalWorkflowUrl = "https://github.com/sapiverpress-studio/Sapiver Forge/actions/workflows/approve-and-publish.yml";
const report = {
  schema_version: 1,
  edition: DATE,
  generated_at: new Date().toISOString(),
  decision,
  assurance_score: Number(assurance.toFixed(3)),
  automatic_publication: false,
  human_approval_required: true,
  disclosure_after_approval: disclosure,
  component_scores: Object.fromEntries(Object.entries(componentScores).map(([key, value]) => [key, Number(value.toFixed(3))])),
  hard_stops: uniqueHardStops,
  advisory_flags: [...new Set(advisoryFlags)],
  review_depth: reviewDepth,
  counts: {
    sources: sources.length,
    stories: stories.length,
    article_words: article.split(/\s+/).filter(Boolean).length,
    feature_words: feature.split(/\s+/).filter(Boolean).length,
    podcast_words: podcastScript.split(/\s+/).filter(Boolean).length,
    verified_findings: verifiedFindings.length,
    blocking_findings: blockingFindings.length
  },
  claim_verification: {
    passed: claimVerification.passed === true,
    confidence: Number(claimVerification.confidence) || 0,
    summary: clean(claimVerification.summary),
    findings: verifiedFindings
  }
};

const readiness = {
  facts: claimVerification.passed === true ? "PASS" : "FAIL",
  structure: validation.passed === true ? "PASS" : "FAIL",
  images: storyImagesReady ? "READY FOR APPROVAL" : "MISSING",
  human_approval: "REQUIRED"
};
const scoreCards = Object.entries(readiness).map(([name, status]) =>
  `<div class="score"><strong>${esc(name.replaceAll("_", " "))}</strong><span>${esc(status)}</span></div>`
).join("");
const stopList = report.hard_stops.length
  ? `<ul>${report.hard_stops.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`
  : "<p>No hard stop was detected.</p>";
const flagList = report.advisory_flags.length
  ? `<ul>${report.advisory_flags.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`
  : "<p>No advisory flag was detected.</p>";
const sourceRows = sources.map((source, index) => `<tr>
  <td>${index + 1}</td>
  <td><a href="${esc(source.url)}">${esc(source.source_name || source.title || "Source")}</a><br><small>${esc(source.published_date || "Date unknown")}</small></td>
  <td>${esc(source.confirmed_fact || "Not recorded")}</td>
  <td>${esc(source.interpretation || "Not recorded")}</td>
</tr>`).join("");
const storyCards = stories.map((story) => `<article class="item">
  <h3>${esc(story.title || "Untitled story")}</h3>
  <p><strong>Why it matters:</strong> ${esc(story.why_it_matters || "")}</p>
  <p><strong>Practical angle:</strong> ${esc(story.practical_angle || "")}</p>
  <p><strong>Draft generator note:</strong> ${esc(story.claim_to_verify || "Not recorded")}</p>
</article>`).join("");
const verificationRows = verifiedFindings.map((finding) => `<tr>
  <td>${esc(finding.output || "")}</td>
  <td>${esc(finding.exact_claim || "")}</td>
  <td>${esc(finding.classification || "")}</td>
  <td>${esc(finding.status || "")}</td>
  <td>${esc(finding.reason || "")}${finding.source_url ? `<br><a href="${esc(finding.source_url)}">Open evidence</a>` : ""}</td>
  <td>${esc(finding.required_correction || "None")}</td>
</tr>`).join("");
const socialCards = [
  ["TikTok", social.tiktok_script],
  ["YouTube", social.youtube_shorts_script],
  ["Facebook", social.facebook_post],
  ["Pinterest title", social.pinterest_title],
  ["Pinterest description", social.pinterest_description]
].map(([name, value]) => `<article class="item"><h3>${esc(name)}</h3><p>${esc(value || "Not generated")}</p></article>`).join("");

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sapiver Forge Release Desk - ${esc(DATE)}</title>
<style>
:root{--navy:#071827;--blue:#163d5c;--gold:#e2b85b;--paper:#fff;--cream:#f7f4ed;--ink:#102437;--line:#d8e0e6;--red:#ad2d2d}
*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font:16px/1.5 system-ui,sans-serif}header{background:var(--navy);color:#fff;padding:24px}header div,main{max-width:1080px;margin:auto}main{padding:18px 14px 60px}.panel,.item{background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:18px;margin:14px 0}.decision{border-left:8px solid var(--gold)}.decision.stop{border-color:var(--red)}.scores{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:9px}.score{display:flex;justify-content:space-between;background:#edf3f6;padding:10px;border-radius:9px}.score strong{text-transform:capitalize}table{border-collapse:collapse;width:100%;font-size:.9rem}th,td{text-align:left;vertical-align:top;border-bottom:1px solid var(--line);padding:9px}.scroll{overflow:auto}.copy{background:#eef5f8;padding:12px;border-radius:9px;white-space:pre-wrap;overflow-wrap:anywhere}.approve-button{display:inline-block;background:#176b45;color:#fff;padding:12px 18px;border-radius:9px;font-weight:700;text-decoration:none}small{color:#607080}a{color:#0c567f}@media(max-width:680px){th:nth-child(4),td:nth-child(4){display:none}}
</style></head><body>
<header><div><strong>CLEARFORGE</strong><h1>Daily Release Desk</h1><p>${esc(DATE)} - nothing publishes without Jim's approval.</p></div></header>
<main>
<section class="panel decision ${decision === "STOP" ? "stop" : ""}"><h2>${esc(decision)}</h2><p>${esc(reviewDepth)}</p></section>
<section class="panel"><h2>What Jim must do</h2><ol><li>Read the stop conditions and advisory flags.</li><li>Check the claims table and open any source that looks weak or surprising.</li><li>Read every social opening and check that it matches the evidence.</li><li>Inspect the article, podcast or video in full only when this report flags it or something looks wrong.</li></ol><p><a class="approve-button" href="${esc(approvalWorkflowUrl)}">Open approval workflow</a></p><p><small>Only continue when this exact edition is factually correct. GitHub will select the newest completed Release Desk and record your authenticated approval.</small></p></section>
<section class="panel"><h2>Release readiness</h2><div class="scores">${scoreCards}</div><p><small>Facts, structure and images are separate checks. Publication always requires Jim's approval.</small></p></section>
<section class="panel"><h2>Hard stops</h2>${stopList}<h2>Advisory flags</h2>${flagList}</section>
<section class="panel"><h2>Independent claim verification</h2><p><strong>Result:</strong> ${claimVerification.passed === true ? "PASS" : "FAIL"} · <strong>Confidence:</strong> ${(Number(claimVerification.confidence) || 0).toFixed(3)}</p><p>${esc(claimVerification.summary || "No verification summary was produced.")}</p><div class="scroll"><table><thead><tr><th>Output</th><th>Exact claim</th><th>Classification</th><th>Status</th><th>Reason/evidence</th><th>Required correction</th></tr></thead><tbody>${verificationRows || "<tr><td colspan=\"6\">No claim-level findings were recorded.</td></tr>"}</tbody></table></div></section>
<section class="panel"><h2>Draft evidence map</h2><p><small>These are claims recorded during research. Their presence is not proof; use the independent verification table above for validation status.</small></p><div class="scroll"><table><thead><tr><th>#</th><th>Source</th><th>Draft factual claim</th><th>Sapiver Forge interpretation</th></tr></thead><tbody>${sourceRows}</tbody></table></div></section>
<section class="panel"><h2>Story summary</h2>${storyCards || "<p>No stories found.</p>"}</section>
<section class="panel"><h2>Social copy</h2>${socialCards}</section>
<section class="panel"><h2>Complete long-form outputs</h2><p>These are the exact full outputs checked by the claim verifier.</p><details><summary><strong>Article — ${report.counts.article_words} words</strong></summary><pre class="copy">${esc(article || "Missing")}</pre></details><details><summary><strong>Feature — ${report.counts.feature_words} words</strong></summary><pre class="copy">${esc(feature || "Missing")}</pre></details><details><summary><strong>Podcast — ${report.counts.podcast_words} words</strong></summary><pre class="copy">${esc(podcastScript || "Missing")}</pre></details></section>
<section class="panel"><h2>Disclosure used after approval</h2><p class="copy">${esc(disclosure)}</p></section>
</main></body></html>`;

const summary = `# Sapiver Forge Release Desk - ${DATE}

**Decision:** ${decision}
**Facts:** ${readiness.facts}
**Structure:** ${readiness.structure}
**Images:** ${readiness.images}
**Automatic publication:** disabled
**Human approval:** required

## Review depth
${reviewDepth}

## Hard stops
${report.hard_stops.length ? report.hard_stops.map((item) => `- ${item}`).join("\n") : "- None detected"}

## Advisory flags
${report.advisory_flags.length ? report.advisory_flags.map((item) => `- ${item}`).join("\n") : "- None detected"}

## Main story
**${clean(structured.headline || "No headline")}**

${clean(structured.dek || "No summary")}

## Evidence map
${sources.length ? sources.map((source, index) => `${index + 1}. [${clean(source.source_name || source.title || "Source")}](${clean(source.url)})
   - Confirmed: ${clean(source.confirmed_fact || "Not recorded")}
   - Interpretation: ${clean(source.interpretation || "Not recorded")}`).join("\n") : "- No sources found"}

## Social copy
### TikTok
${clean(social.tiktok_script || "Not generated")}

### YouTube
${clean(social.youtube_shorts_script || "Not generated")}

### Facebook
${clean(social.facebook_post || "Not generated")}

### Pinterest
**${clean(social.pinterest_title || "Not generated")}**

${clean(social.pinterest_description || "Not generated")}

## What Jim must do
1. Check the claims, source links, flags and social copy above.
2. Download and open \`clearforge-release-desk-${DATE}.html\` only when you need the fuller report.
3. Open full outputs only where flagged or questionable.
4. If satisfied, open [Sapiver Forge Approve and Publish](${approvalWorkflowUrl}) and press **Run workflow**. GitHub will select the newest completed Release Desk.

Nothing publishes from this report automatically.
`;

fs.mkdirSync(draftDir, { recursive: true });
fs.writeFileSync(path.join(draftDir, "release-desk.json"), JSON.stringify(report, null, 2) + "\n");
fs.writeFileSync(path.join(draftDir, `clearforge-release-desk-${DATE}.html`), html);
fs.writeFileSync(path.join(draftDir, "release-summary.md"), summary);
console.log(`Built Sapiver Forge Release Desk for ${DATE}: ${decision}, assurance ${report.assurance_score.toFixed(3)}`);
