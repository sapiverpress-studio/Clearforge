import fs from "node:fs";
import path from "node:path";
import { hasUsableEvidenceLocation, isMeaningfulEvidencePassage, isUsableAtomicClaim, verifyAtomicClaim } from "./evidence-verification.mjs";

const wordCount = (value) => String(value || "").trim().split(/\s+/).filter(Boolean).length;
const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();

function claimIsLockable(claim, record) {
  let publisher = "";
  try { publisher = new URL(claim.source_url || record?.final_url).hostname.split(".").find((part) => !/^(?:www|com|org|net|co|uk)$/i.test(part)) || ""; } catch {}
  const context = `${publisher ? `${publisher} published this report. ` : ""}${record?.page_title || ""} ${claim?.evidence_passage || ""}`;
  return claim?.verification_status === "verified"
    && isUsableAtomicClaim(claim.atomic_claim)
    && isMeaningfulEvidencePassage(claim.evidence_passage)
    && hasUsableEvidenceLocation(claim.evidence_location)
    && verifyAtomicClaim(claim.atomic_claim, context).supported;
}

function attributedClaim({ claim, record }) {
  const original = clean(claim?.atomic_claim);
  if (!/^Our results\b/i.test(original)) return original;
  let publisher = "The cited source";
  try {
    const host = new URL(claim.source_url || record?.final_url).hostname.replace(/^www\./, "");
    publisher = host.split(".")[0].replace(/(^|[-_])([a-z])/g, (_, prefix, letter) => `${prefix}${letter.toUpperCase()}`);
  } catch {}
  const candidate = `${publisher} reports that ${original.replace(/^Our results\s*/i, "its results ")}`;
  const context = `${publisher} published this report. ${record?.page_title || ""} ${claim?.evidence_passage || ""}`;
  return verifyAtomicClaim(candidate, context).supported ? candidate : original;
}

function headlineFrom(title, claim) {
  const sourceTitle = clean(title).replace(/\s*[|—–-]\s*[^|—–-]{1,40}$/u, "");
  if (sourceTitle && !/^(?:home|article|news|research|verified source)$/i.test(sourceTitle)) return sourceTitle.slice(0, 110);
  const words = clean(claim).split(/\s+/).slice(0, 14).join(" ");
  return words ? `${words}${/[.!?]$/.test(words) ? "" : ": what it means in practice"}` : "A source-backed AI workflow decision";
}

function buildArticle(factText, sourceUrl) {
  const analysis = [
    "Sapiver Forge interpretation: the evidence should be treated as a prompt for a bounded decision, not as permission to automate a whole operation. Start by identifying one repeated task, the person who owns the outcome and the point at which a mistake would become costly or difficult to reverse. This keeps the practical question narrow enough to test and prevents a general AI claim from being stretched beyond what the source actually established.",
    "Sapiver Forge interpretation: define the current method before introducing AI. Record what is done now, how long it takes, what information is used, which judgement calls matter and where errors are normally caught. Without that baseline, faster output can look like progress even when correction work, supervision and uncertainty have simply moved elsewhere in the process.",
    "Sapiver Forge interpretation: separate assistance from authority. An AI system may draft, classify, summarise or suggest, while a named person remains responsible for approval, release or action. That boundary should be explicit. If nobody can state who makes the final decision, the workflow is not controlled enough to expand, regardless of how impressive the generated output appears.",
    "Sapiver Forge interpretation: access should be limited to what the task genuinely requires. Review the files, accounts, personal information, client material and connected services involved. Remove unnecessary access before testing. A useful workflow does not need broad permissions by default, and a small productivity gain does not justify avoidable exposure of confidential or operational information.",
    "Sapiver Forge interpretation: decide what must be checked before any output leaves the workflow. Accuracy, completeness, tone, permissions, privacy, destination and version control are separate checks. A generic instruction to review the result is too weak. The reviewer needs a short, repeatable release step that reflects the actual harm a bad output could cause.",
    "Sapiver Forge interpretation: measure the full cost of the experiment. Include setup time, prompting, supervision, correction, failed attempts and the effort required to maintain the process. Also record useful output and time genuinely saved. A workflow that looks efficient during generation may still be worse than the previous method once checking and repair are included.",
    "Sapiver Forge interpretation: use a stop rule before the trial begins. Define the conditions that mean the test should pause, return to the previous method or be redesigned. Examples include repeated factual errors, unclear ownership, excessive correction work, inappropriate access or outputs that cannot be reviewed reliably. A reversible test is safer and cheaper than continuing because time has already been invested.",
    "Sapiver Forge interpretation: expansion should follow evidence from the trial, not enthusiasm about the tool. Keep the workflow narrow until the results are consistent, the review burden is understood and responsibility remains clear. Only then consider a larger scope. This protects working methods that are already reliable and makes any change easier to explain to customers, collaborators or staff.",
    "Sapiver Forge interpretation: the practical value of the source lies in the decision it helps frame. The source does not endorse Sapiver Forge, and Sapiver Forge is not adding new factual claims to it. The role of this briefing is to turn a verified development into a controlled question: where could it help, what could go wrong, who must decide and what evidence would justify keeping it?"
  ];
  return `${factText}\n\n${analysis.join("\n\n")}\n\nSource: ${sourceUrl}`;
}

export function rebuildNarrowedEdition(root, edition) {
  const dir = path.join(root, "drafts", edition);
  const structuredPath = path.join(dir, "structured_output.json");
  const evidencePath = path.join(dir, "source-evidence.json");
  if (!fs.existsSync(structuredPath) || !fs.existsSync(evidencePath)) throw new Error("Narrowed rebuild requires structured output and verified source evidence.");

  const data = JSON.parse(fs.readFileSync(structuredPath, "utf8"));
  const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
  const records = Array.isArray(evidence.records) ? evidence.records : [];
  const rejected = records.flatMap((record) => (record.verified_claims || []).filter((claim) => !claimIsLockable(claim, record)));
  const unsupported = [...records.flatMap((record) => record.unsupported_claims || []), ...rejected];
  if (!unsupported.length) return { rebuilt: false, reason: "no_unsupported_claims" };

  const verifiedEntries = records.flatMap((record) => (record.verified_claims || []).filter((claim) => claimIsLockable(claim, record)).map((claim) => ({ claim, record })));
  if (!verifiedEntries.length) throw new Error("No verified factual core remains for a narrowed edition.");

  const primary = verifiedEntries[0];
  const sourceUrl = primary.claim.source_url || primary.record.final_url || "";
  const sourceTitle = primary.record.page_title || "Verified source";
  const factText = verifiedEntries.map(attributedClaim).join("\n\n");
  const primaryFact = attributedClaim(primary);
  const headline = headlineFrom(sourceTitle, primaryFact);
  const article = buildArticle(factText, sourceUrl);
  if (wordCount(article) < 650) throw new Error(`Depth-first narrowed rebuild produced only ${wordCount(article)} words.`);

  const interpretation = "Sapiver Forge interpretation: test the development through one bounded workflow, explicit access limits, a named human release decision and recorded evidence of whether the process improved.";
  const practical = "Choose one repeated, low-risk task. Write down the current method, the information involved, what AI may and may not do, who reviews the result and the condition that would stop the trial. Measure useful output, correction time, avoidable errors and the reviewer effort before deciding whether to keep or expand it.";
  const next = "Run the workflow on a small sample using real but non-sensitive material. Compare it with the current method, record every correction and confirm that the named reviewer can reliably decide whether each output is ready to use.";
  const tiktok = `${primaryFact} The practical question is not whether to automate everything. Test one bounded task, limit access, measure corrections and keep a named person responsible for release.`;
  const caption = `${primaryFact} Test the claim against one real workflow before expanding it.`;

  const rebuilt = {
    headline,
    dek: "A source-backed Sapiver Forge briefing that separates the verified development from the decisions required before using it in a real workflow.",
    main_article: article,
    practical_takeaway: practical,
    what_to_test_next: next,
    claims_to_verify: [],
    headline_options: [headline, `What ${sourceTitle} means for a controlled AI test`, "How to test this AI development without over-automating", "Define the human decision before expanding this workflow", "Turn the evidence into a bounded operational trial"],
    social: {
      tiktok_script: tiktok,
      tiktok_caption: caption,
      tiktok_caption_prompt: caption,
      youtube_shorts_script: tiktok,
      facebook_post: `${primaryFact}\n\n${interpretation}\n\nWhich part of the workflow would still need a person to make the final decision?`,
      pinterest_title: "Test this AI workflow before scaling",
      pinterest_description: `${interpretation} Map the current method, permissions, review step, stop rule and evidence needed before expanding the workflow.`,
      quote_card_lines: [
        "Test one bounded workflow before expanding AI use.",
        "Define what the system may access and change.",
        "Keep a named person responsible for release.",
        "Measure corrections as well as time saved.",
        "Expand only after reviewing the actual outcome."
      ]
    }
  };

  Object.assign(data, rebuilt, { narrowed_from_unsupported_claims: true });
  delete data.audience_fit;
  delete data.social_mode;
  delete data.social_source;
  const previousSources = Array.isArray(data.sources) ? data.sources : [];
  data.sources = verifiedEntries.map(({ claim, record }) => {
    const previous = previousSources.find((item) => item.acquisition_id && item.acquisition_id === record.acquisition_id)
      || previousSources.find((item) => item.url === record.final_url || item.url === record.requested_url) || {};
    return {
      ...previous,
      source_name: previous.source_name || new URL(record.final_url || claim.source_url).hostname,
      title: record.page_title || previous.title || "Verified source",
      url: claim.source_url || record.final_url,
      published_date: String(record.publication_date || previous.published_date || edition).slice(0, 10),
      confirmed_fact: claim.atomic_claim,
      interpretation,
      evidence_basis: "Retrieved source body text with atomic evidence verification."
    };
  });
  data.story_summaries = data.sources.map((source) => ({
    title: source.title,
    summary: source.confirmed_fact,
    why_it_matters: interpretation,
    practical_angle: practical,
    coverage_lane: source.coverage_lane || "confirmed_development",
    topic_category: source.topic_category || "workplace_and_business",
    claim_to_verify: "NONE — verified from cited source evidence."
  }));
  fs.writeFileSync(structuredPath, `${JSON.stringify(data, null, 2)}\n`);

  const sourceLines = data.sources.map((source) => `- [${source.title}](${source.url})\n  - Verified fact: ${source.confirmed_fact}\n  - ${interpretation}`).join("\n");
  fs.writeFileSync(path.join(dir, "daily_brief.md"), `# ${headline}\n\nStatus: Draft — human approval required\n\n${rebuilt.dek}\n\n## Verified source and evidence\n\n${sourceLines}\n\n## Main article\n\n${article}\n\n## Practical takeaway\n\n${practical}\n\n## What to test next\n\n${next}\n`);
  fs.writeFileSync(path.join(dir, "social_pack.md"), `# Sapiver Forge Social Pack — ${edition}\n\nStatus: Draft — human approval required\n\n## TikTok Script\n\n${rebuilt.social.tiktok_script}\n\n## TikTok Caption\n\n${rebuilt.social.tiktok_caption}\n\n## YouTube Shorts Script\n\n${rebuilt.social.youtube_shorts_script}\n\n## Facebook Post\n\n${rebuilt.social.facebook_post}\n\n## Pinterest Pin\n\n**Title:** ${rebuilt.social.pinterest_title}\n\n**Description:** ${rebuilt.social.pinterest_description}\n\n## Quote Cards\n\n${rebuilt.social.quote_card_lines.map((line) => `- ${line}`).join("\n")}\n`);
  const report = { edition, rebuilt: true, method: "depth_first_verified_rebuild", article_words: wordCount(article), verified_fact_count: verifiedEntries.length, excluded_claim_count: unsupported.length };
  fs.writeFileSync(path.join(dir, "narrowed-edition-rebuild.json"), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const root = process.cwd();
  const edition = process.env.SAPIVER_FORGE_DATE || new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const result = rebuildNarrowedEdition(root, edition);
  console.log(result.rebuilt ? `Rebuilt ${edition} with ${result.article_words} words.` : "Narrowed-edition rebuild not required.");
}
