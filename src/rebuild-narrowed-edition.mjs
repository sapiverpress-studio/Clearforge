import fs from "node:fs";
import path from "node:path";
import OpenAI from "./gemini-openai-compat.mjs";

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
const unsupported = records.flatMap((record) => record.unsupported_claims || []);
if (!unsupported.length) {
  console.log("No unsupported atomic claims; narrowed-edition rebuild not required.");
  process.exit(0);
}
const verified = records.flatMap((record) => record.verified_claims || []);
if (!verified.length) throw new Error("No verified factual core remains for a narrowed edition.");

const factText = verified.map((claim) => claim.atomic_claim).join(" ").trim();
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
const sourceUrl = verified[0].source_url || records[0]?.final_url || data.sources?.[0]?.url || "";
const sourceTitle = records[0]?.page_title || data.sources?.[0]?.title || "Verified AI development";
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
    what_to_test_next: "Test one low-risk workflow and record time saved, corrections required, access granted and the person responsible for release.",
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

const schema = {
  type: "object", additionalProperties: false,
  required: ["headline", "dek", "main_article", "practical_takeaway", "what_to_test_next", "headline_options", "social"],
  properties: {
    headline: { type: "string" }, dek: { type: "string" }, main_article: { type: "string" },
    practical_takeaway: { type: "string" }, what_to_test_next: { type: "string" },
    headline_options: { type: "array", minItems: 5, maxItems: 5, items: { type: "string" } },
    social: { type: "object", additionalProperties: false,
      required: ["tiktok_script", "tiktok_caption", "tiktok_caption_prompt", "youtube_shorts_script", "facebook_post", "pinterest_title", "pinterest_description", "linkedin_post", "quote_card_lines"],
      properties: {
        tiktok_script: { type: "string" }, tiktok_caption: { type: "string" }, tiktok_caption_prompt: { type: "string" },
        youtube_shorts_script: { type: "string" }, facebook_post: { type: "string" }, pinterest_title: { type: "string" },
        pinterest_description: { type: "string" }, linkedin_post: { type: "string" },
        quote_card_lines: { type: "array", minItems: 5, maxItems: 5, items: { type: "string" } }
      }
    }
  }
};

let rebuilt = null;
let method = "deterministic_fallback";
let modelError = "";
if (process.env.GEMINI_API_KEY && process.env.NARROWED_REBUILD_DISABLE_MODEL !== "1") {
  try {
    const client = new OpenAI();
    const response = await client.responses.create({
      model: process.env.GEMINI_TEXT_MODEL || "gemini-3.1-flash-lite",
      reasoning: { effort: "high" },
      input: [{ role: "system", content: `Rebuild a complete, commercially useful Sapiver Forge edition using only the supplied verified atomic facts and exact evidence. Unsupported proposed claims have already been rejected. Do not reintroduce them or add any number, company, product, technology, comparison, study description, quotation, legal claim or causal conclusion absent from the verified evidence. Clearly label Sapiver Forge interpretation. Produce a useful short edition rather than padding. Connect the practical workflow lesson to the Sapiver Forge gate system without claiming the source endorses the product. Preserve the supplied commercial links exactly.` },
        { role: "user", content: `EDITION: ${DATE}\nSOURCE TITLE: ${sourceTitle}\nSOURCE URL: ${sourceUrl}\nVERIFIED ATOMIC FACTS:\n${factText}\nEXACT EVIDENCE:\n${evidenceText}\nCOMMERCIAL LINKS:\n${commercialLinks}` }],
      text: { format: { type: "json_schema", name: "sapiver_narrowed_edition", strict: true, schema } }
    });
    rebuilt = JSON.parse(response.output_text);
    method = "gemini_constrained_rebuild";
  } catch (error) { modelError = String(error?.message || error); }
}
if (!rebuilt) rebuilt = fallbackEdition();

Object.assign(data, rebuilt, { claims_to_verify: [], narrowed_from_unsupported_claims: true });
data.sources = (data.sources || []).map((source, index) => ({
  ...source,
  confirmed_fact: (records[index]?.verified_claims || []).map((claim) => claim.atomic_claim).join(" "),
  interpretation,
  evidence_basis: "Retrieved source body text with atomic evidence verification."
}));
if (Array.isArray(data.story_summaries) && data.story_summaries[0]) {
  data.story_summaries[0] = { ...data.story_summaries[0], title: rebuilt.headline, summary: factText, why_it_matters: interpretation, practical_angle: rebuilt.practical_takeaway };
}
fs.writeFileSync(structuredPath, `${JSON.stringify(data, null, 2)}\n`);

const sourceLines = data.sources.map((source) => `- [${source.title || sourceTitle}](${source.url || sourceUrl})\n  - Verified fact: ${source.confirmed_fact}\n  - ${interpretation}`).join("\n");
fs.writeFileSync(path.join(dir, "daily_brief.md"), `# ${rebuilt.headline}\n\nStatus: Draft — human approval required\n\n${rebuilt.dek}\n\n## Verified source and evidence\n\n${sourceLines}\n\n## Main article\n\n${rebuilt.main_article}\n\n## Practical takeaway\n\n${rebuilt.practical_takeaway}\n\n## What to test next\n\n${rebuilt.what_to_test_next}\n\n## Verification status\n\nUnsupported proposed claim components were excluded. Retained material is listed in the evidence ledger.\n`);
fs.writeFileSync(path.join(dir, "social_pack.md"), `# Sapiver Forge Social Pack — ${DATE}\n\nStatus: Draft — human approval required\n\n## TikTok Script\n\n${rebuilt.social.tiktok_script}\n\n## TikTok Caption\n\n${rebuilt.social.tiktok_caption}\n\n## YouTube Shorts Script\n\n${rebuilt.social.youtube_shorts_script}\n\n## Facebook Post\n\n${rebuilt.social.facebook_post}\n\n## Pinterest\n\n**Title:** ${rebuilt.social.pinterest_title}\n\n**Description:** ${rebuilt.social.pinterest_description}\n\n## LinkedIn-Style Post\n\n${rebuilt.social.linkedin_post}\n\n## Quote Cards\n\n${rebuilt.social.quote_card_lines.map((line) => `- ${line}`).join("\n")}\n`);
fs.writeFileSync(reportPath, `${JSON.stringify({ edition: DATE, rebuilt: true, method, model_error: modelError, verified_fact_count: verified.length, excluded_claim_count: unsupported.length }, null, 2)}\n`);
console.log(`Rebuilt narrowed edition using ${method}: ${verified.length} verified fact(s), ${unsupported.length} excluded claim(s).`);
