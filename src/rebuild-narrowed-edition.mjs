import fs from "node:fs";
import path from "node:path";
import OpenAI from "./gemini-openai-compat.mjs";

const ROOT = process.cwd();
const DATE = process.env.SAPIVER_FORGE_DATE || process.env.CLEARFORGE_DATE || new Intl.DateTimeFormat("sv-SE", {
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
const evidenceText = verified.map((claim) => claim.evidence_passage).join(" ").trim();
const sourceUrl = verified[0].source_url || records[0]?.final_url || data.sources?.[0]?.url || "";
const sourceTitle = records[0]?.page_title || data.sources?.[0]?.title || "Verified AI development";
const existingSocial = data.social || {};
const urls = [...new Set(JSON.stringify(existingSocial).match(/https:\/\/[^\s"\\]+/g) || [])];
const commercialLinks = urls.filter((url) => /sapiver-press\.kit\.com|payhip\.com/.test(url)).join("\n");
const interpretation = "Sapiver Forge interpretation: this development makes workflow design, clear boundaries and human review practical areas to examine before expanding AI use.";

function fallbackEdition() {
  const article = `${factText}\n\nThe retrieved source supports a narrower story than the original draft proposed. It describes AI moving beyond isolated assistance and into redesigned workflows. It does not support the rejected statistics, sample description or comparison, so those claims have been removed.\n\n${interpretation} The useful question is not whether one prompting technique wins. It is where AI enters a real process, what information it can access, which step it performs and where a person checks the result.\n\nFor a creator, freelancer or small team, choose one repeated task and map it from input to final approval. Record what the AI may do, what it must never do automatically and who owns the decision to send, publish or act. Run a limited test and compare correction time as well as apparent speed.\n\nThe Sapiver Forge gate system is designed for that sequence: decide whether AI belongs in the task, define workflow controls, review the specific output before release and then check whether the workflow delivered worthwhile results. This is a practical application of the source-supported workflow shift, not a claim made by the source.\n\nSource: ${sourceUrl}`;
  const tiktok = `${factText} The unsupported statistics in the original angle are not in the source, so the useful story is narrower: AI is moving into redesigned workflows. Sapiver Forge interpretation: map the task, set the boundaries and keep a human release check. That is more useful than chasing a dramatic number the evidence does not support.`;
  const caption = `The source supports a workflow-transformation story, not the rejected statistics. Before AI becomes part of a repeated task, map its access, boundaries and human review point.\n\n${commercialLinks}`.trim();
  return {
    headline: "The verified shift is from AI assistance to redesigned workflows",
    dek: "A narrower, source-supported Sapiver Forge briefing on workflow design, boundaries and human review.",
    main_article: article,
    practical_takeaway: "Map one repeated workflow, name the AI boundary and require a human decision before anything is sent, published or allowed to act.",
    what_to_test_next: "Test one low-risk workflow and record time saved, corrections required, access granted and the person responsible for release.",
    claims_to_verify: [],
    headline_options: [
      "The verified shift is from AI assistance to redesigned workflows",
      "AI workflow design matters more than another unsupported statistic",
      "What Microsoft actually says about AI and redesigned work",
      "A narrower, verified lesson about AI workflow transformation",
      "Before AI enters the workflow, define the human release point"
    ],
    social: {
      tiktok_script: tiktok,
      tiktok_caption: caption,
      tiktok_caption_prompt: caption,
      youtube_shorts_script: tiktok,
      facebook_post: `${article.split("\n\n").slice(0, 4).join("\n\n")}\n\n${commercialLinks}`.trim(),
      pinterest_title: "AI workflow design needs a human release point",
      pinterest_description: `${interpretation} Map the task, permissions, boundaries and approval step before scaling it.\n\n${commercialLinks}`.trim(),
      linkedin_post: `${factText}\n\n${interpretation}\n\nThe practical move is to map one workflow and name the human release decision.\n\n${commercialLinks}`.trim(),
      quote_card_lines: [
        "AI is moving from assistance into redesigned workflows.",
        "A real source is not proof of every claim attached to it.",
        "Map the workflow before you automate the task.",
        "Define what AI may do and where a person decides.",
        "Human review is a release decision, not a vague intention."
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
