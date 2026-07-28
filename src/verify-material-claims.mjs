import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";

const ROOT = process.cwd();
const DATE = process.env.CLEARFORGE_DATE || new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());
const draftDir = path.join(ROOT, "drafts", DATE);
const structuredPath = path.join(draftDir, "structured_output.json");
const reportPath = path.join(draftDir, process.env.CLAIM_VERIFICATION_FILE || "claim-verification.json");

if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required for claim verification.");
if (!fs.existsSync(structuredPath)) throw new Error(`Missing ${structuredPath}`);

function readText(file) {
  try { return fs.readFileSync(file, "utf8").trim(); } catch { return ""; }
}

const structured = JSON.parse(fs.readFileSync(structuredPath, "utf8"));
const material = {
  structured_output: structured,
  daily_article: readText(path.join(draftDir, "daily_brief.md")),
  full_feature: readText(path.join(draftDir, "feature.md")),
  podcast_script: readText(path.join(draftDir, "podcast", "COPY_PASTE_INTO_ELEVENLABS.txt"))
};

function collectNumericOccurrences(value, output, occurrences) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  const pattern = /\b\d+(?:\.\d+)?%/g;
  for (const match of text.matchAll(pattern)) {
    occurrences.push({
      id: `numeric-${occurrences.length + 1}`,
      output,
      value: match[0],
      context: text.slice(Math.max(0, match.index - 140), Math.min(text.length, match.index + 220))
    });
  }
}
const numericOccurrences = [];
for (const [output, value] of Object.entries(material)) collectNumericOccurrences(value, output, numericOccurrences);

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["overall_pass", "confidence", "checked_outputs", "numeric_claim_audit", "findings", "summary"],
  properties: {
    overall_pass: { type: "boolean" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    checked_outputs: {
      type: "array",
      items: { type: "string", enum: ["structured_output", "daily_article", "full_feature", "podcast_script"] }
    },
    numeric_claim_audit: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["occurrence_id", "status", "reason", "source_url"],
        properties: {
          occurrence_id: { type: "string" },
          status: { type: "string", enum: ["supported_in_context", "misused", "unsupported"] },
          reason: { type: "string" },
          source_url: { type: "string" }
        }
      }
    },
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "output", "exact_claim", "classification", "status", "severity",
          "reason", "required_correction", "source_url"
        ],
        properties: {
          output: { type: "string", enum: ["structured_output", "daily_article", "full_feature", "podcast_script"] },
          exact_claim: { type: "string" },
          classification: {
            type: "string",
            enum: ["verified_fact", "vendor_claim", "logical_inference", "unknown_or_unverifiable", "internal_provenance"]
          },
          status: {
            type: "string",
            enum: ["supported", "needs_qualification", "unsupported", "unverifiable", "not_applicable"]
          },
          severity: { type: "string", enum: ["info", "warning", "blocking"] },
          reason: { type: "string" },
          required_correction: { type: "string" },
          source_url: { type: "string" }
        }
      }
    },
    summary: { type: "string" }
  }
};

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const model = process.env.OPENAI_MODEL || "gpt-5.4-mini";
const response = await client.responses.create({
  model,
  reasoning: { effort: "high" },
  tools: [{ type: "web_search" }],
  input: [
    {
      role: "system",
      content: `You are Clearforge's independent pre-publication claim verifier.

Check the complete supplied outputs, not samples. Use web search to open the cited original sources and, where needed, authoritative primary material. A URL existing is not proof that the wording accurately represents it.

For every material factual, numerical, date, availability, survey, research, quotation, legal, product or attribution claim:
- verify the exact meaning, population, denominator, date, availability qualification and source type;
- distinguish verified fact, vendor claim, logical inference and unknown/unverifiable;
- treat a commissioned survey as a commissioned survey and record who commissioned/conducted it;
- do not allow a statistic answering one question to support copy about a different question;
- do not turn message classifications, survey responses or vendor descriptions into established real-world outcomes;
- keep Clearforge interpretation explicitly separate from source conclusions;
- inspect every supplied social field and the complete article, feature and podcast;
- audit every supplied percentage occurrence in its exact surrounding context; a true statistic used to imply a different conclusion is a blocking misuse;
- treat Clearforge's own AI-assistance disclosure, human-approval statement, product CTA and brand description as internal provenance, not externally sourced news claims; mark them not_applicable and never block them merely for lacking an external citation;
- mark missing outputs as blocking;
- mark any material overstatement, unsupported implication, inaccurate paraphrase or unresolved high-consequence claim as blocking.

overall_pass may be true only when there are no blocking findings and confidence is at least 0.90. Do not rely on the draft's own claim_to_verify or claims_to_verify fields as evidence.`
    },
    {
      role: "user",
      content: `EDITION: ${DATE}

CITED SOURCE URLS:
${JSON.stringify((structured.sources || []).map((source) => source.url).filter(Boolean))}

COMPLETE MATERIAL TO VERIFY:
${JSON.stringify(material)}

NUMERIC OCCURRENCES TO AUDIT INDIVIDUALLY:
${JSON.stringify(numericOccurrences)}

Return exactly one numeric_claim_audit entry for every supplied occurrence_id. Check whether each statistic supports the conclusion drawn in its surrounding sentence and CTA, not merely whether the number appears somewhere in the source. Return a concise finding for every problem and each important availability claim. For supported claims, required_correction must be an empty string. For problems, give replacement-ready correction guidance and the best supporting source URL.`
    }
  ],
  text: {
    format: {
      type: "json_schema",
      name: "clearforge_material_claim_verification",
      strict: true,
      schema
    }
  }
});

if (!response.output_text) throw new Error("Claim verifier returned no result.");
const result = JSON.parse(response.output_text);
const requiredOutputs = ["structured_output", "daily_article", "full_feature", "podcast_script"];
const checked = new Set(result.checked_outputs || []);
const findings = Array.isArray(result.findings) ? result.findings : [];
const numericAudit = Array.isArray(result.numeric_claim_audit) ? result.numeric_claim_audit : [];
const auditedIds = new Set(numericAudit.map((item) => item.occurrence_id));
const missingNumericAudits = numericOccurrences.filter((item) => !auditedIds.has(item.id));
const badNumericAudits = numericAudit.filter((item) => item.status !== "supported_in_context");
const blocking = findings.filter((item) => item.severity === "blocking");
const missingOutputs = requiredOutputs.filter((name) => !checked.has(name) || !String(material[name] || "").trim());
const passed = result.overall_pass === true &&
  Number(result.confidence) >= 0.9 &&
  blocking.length === 0 &&
  badNumericAudits.length === 0 &&
  missingNumericAudits.length === 0 &&
  missingOutputs.length === 0;

const report = {
  schema_version: 1,
  edition: DATE,
  generated_at: new Date().toISOString(),
  passed,
  confidence: Number(result.confidence) || 0,
  checked_outputs: [...checked],
  missing_outputs: missingOutputs,
  blocking_findings: blocking,
  numeric_claim_audit: numericAudit,
  missing_numeric_audits: missingNumericAudits,
  failed_numeric_audits: badNumericAudits,
  findings,
  summary: result.summary || ""
};

fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
console.log(`Claim verification ${passed ? "passed" : "failed"} for ${DATE}: ${blocking.length} blocking finding(s).`);
if (!passed) process.exit(2);
