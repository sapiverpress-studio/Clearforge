import fs from "node:fs";
import path from "node:path";
import OpenAI from "./gemini-openai-compat.mjs";

const ROOT = process.cwd();
const weekEnd = process.env.SAPIVER_FORGE_WEEK_END || new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());
const end = new Date(`${weekEnd}T12:00:00Z`);
const start = new Date(end); start.setUTCDate(start.getUTCDate() - 6);
const iso = (d) => d.toISOString().slice(0, 10);
const weekStart = iso(start);
const outDir = path.join(ROOT, "weekly-campaigns", weekEnd);
fs.mkdirSync(outDir, { recursive: true });

if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required.");

const editions = [];
const draftsDir = path.join(ROOT, "drafts");
for (const date of fs.existsSync(draftsDir) ? fs.readdirSync(draftsDir).sort() : []) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < weekStart || date > weekEnd) continue;
  const dir = path.join(draftsDir, date);
  const approvalPath = path.join(dir, "approval.json");
  const structuredPath = path.join(dir, "structured_output.json");
  if (!fs.existsSync(approvalPath) || !fs.existsSync(structuredPath)) continue;
  const approval = JSON.parse(fs.readFileSync(approvalPath, "utf8"));
  if (approval.article_approved !== true) continue;
  const structured = JSON.parse(fs.readFileSync(structuredPath, "utf8"));
  const featurePath = path.join(dir, "feature.json");
  const feature = fs.existsSync(featurePath) ? JSON.parse(fs.readFileSync(featurePath, "utf8")) : null;
  editions.push({ date, structured, feature });
}

if (!editions.length) throw new Error(`No approved editions found from ${weekStart} to ${weekEnd}.`);

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["week_start", "week_end", "recommended_route", "problem", "evidence", "commercial_score", "product", "free_resource", "content_plan", "guardrails"],
  properties: {
    week_start: { type: "string" },
    week_end: { type: "string" },
    recommended_route: { type: "string", enum: ["new_pack", "existing_product_extension", "existing_product_update", "monthly_bundle_component", "free_resource_only"] },
    problem: {
      type: "object", additionalProperties: false,
      required: ["title", "statement", "affected_audience", "practical_consequence", "why_now", "evergreen_value", "confidence"],
      properties: {
        title: { type: "string" }, statement: { type: "string" }, affected_audience: { type: "string" }, practical_consequence: { type: "string" }, why_now: { type: "string" }, evergreen_value: { type: "string" }, confidence: { type: "string", enum: ["high", "medium", "low"] }
      }
    },
    evidence: { type: "array", minItems: 2, maxItems: 10, items: { type: "object", additionalProperties: false, required: ["date", "headline", "problem_signal", "source_basis"], properties: { date: { type: "string" }, headline: { type: "string" }, problem_signal: { type: "string" }, source_basis: { type: "string" } } } },
    commercial_score: { type: "object", additionalProperties: false, required: ["total", "multiple_stories", "audience_fit", "repeatable_failure", "pack_solvability", "longevity", "demonstrability", "library_fit", "decision"], properties: { total: { type: "integer", minimum: 0, maximum: 35 }, multiple_stories: { type: "integer", minimum: 0, maximum: 5 }, audience_fit: { type: "integer", minimum: 0, maximum: 5 }, repeatable_failure: { type: "integer", minimum: 0, maximum: 5 }, pack_solvability: { type: "integer", minimum: 0, maximum: 5 }, longevity: { type: "integer", minimum: 0, maximum: 5 }, demonstrability: { type: "integer", minimum: 0, maximum: 5 }, library_fit: { type: "integer", minimum: 0, maximum: 5 }, decision: { type: "string" } } },
    product: { type: "object", additionalProperties: false, required: ["name", "promise", "target_customer", "outcome", "contents", "worked_example", "suggested_price_gbp", "main_objection", "demonstration", "bundle_destination"], properties: { name: { type: "string" }, promise: { type: "string" }, target_customer: { type: "string" }, outcome: { type: "string" }, contents: { type: "array", minItems: 4, maxItems: 10, items: { type: "string" } }, worked_example: { type: "string" }, suggested_price_gbp: { type: "string" }, main_objection: { type: "string" }, demonstration: { type: "string" }, bundle_destination: { type: "string" } } },
    free_resource: { type: "object", additionalProperties: false, required: ["name", "purpose", "contents", "cta"], properties: { name: { type: "string" }, purpose: { type: "string" }, contents: { type: "array", minItems: 3, maxItems: 7, items: { type: "string" } }, cta: { type: "string" } } },
    content_plan: { type: "array", minItems: 7, maxItems: 7, items: { type: "object", additionalProperties: false, required: ["day", "editorial_lane", "title", "angle", "format", "product_connection", "cta_strength"], properties: { day: { type: "string" }, editorial_lane: { type: "string" }, title: { type: "string" }, angle: { type: "string" }, format: { type: "string" }, product_connection: { type: "string" }, cta_strength: { type: "string", enum: ["none", "soft", "direct"] } } } },
    guardrails: { type: "array", minItems: 3, maxItems: 8, items: { type: "string" } }
  }
};

const client = new OpenAI();
const response = await client.responses.create({
  model: process.env.GEMINI_TEXT_MODEL || "gemini-3.1-flash-lite",
  reasoning: { effort: "medium" },
  input: [
    { role: "system", content: "You are Sapiver Forge's commercial editorial analyst. Analyse only the supplied approved research. The current flagship under validation is the £19 Sapiver Forge AI Output Release Gate. Its job is to help creators, freelancers and small teams check AI-assisted work before publication, client delivery or action, record a named human reviewer, and reach a Release, Revise or Stop decision. Do not invent a different paid product merely to fill a weekly plan. First test whether the week's evidence supports this flagship, a small update or extension to it, or a free diagnostic that leads naturally to it. Never force the flagship onto unrelated evidence. Recommend a new pack only when at least three distinct credible sources reveal a separate, urgent, repeatable problem that the Release Gate and Workflow Control Kit cannot reasonably solve. Never invent demand, statistics, testimonials, or facts." },
    { role: "user", content: `WEEK: ${weekStart} to ${weekEnd}\n\nAPPROVED EDITIONS:\n${JSON.stringify(editions)}\n\nCreate one weekly opportunity brief. Follow the locked Sapiver Forge editorial lanes in this exact order: Monday weekend roundup; Tuesday AI at work; Wednesday AI in everyday life; Thursday systems and automation; Friday new tools, stacks and workflows; Saturday prediction and outlook; Sunday recap and preparation. Use the seven content ideas to test and explain one genuine problem from different angles. Do not schedule an artificial Friday product launch: the Release Gate already exists. Choose the CTA from the reader's awareness level and the evidence. Use a save CTA when introducing a useful check, a simple response CTA when gathering audience language, and a direct Release Gate CTA only where the evidence naturally demonstrates a pre-send or pre-publication checking problem. Do not require a fixed number of product CTAs. Score the opportunity out of 35. A score below 22 should choose free_resource_only or an update/extension rather than a weak new pack. A new_pack route requires at least 30/35 and three distinct credible evidence items for a problem outside the scope of the Release Gate and Workflow Control Kit. Distinguish sourced evidence from inference. Avoid hype and income promises.` }
  ],
  text: { format: { type: "json_schema", name: "sapiver-forge_weekly_opportunity", strict: true, schema } }
});

if (!response.output_text) throw new Error("Gemini returned no weekly opportunity output.");
const opportunity = JSON.parse(response.output_text);
opportunity.week_start = weekStart;
opportunity.week_end = weekEnd;
const directCtaDays = opportunity.content_plan.filter((item) => item.cta_strength === "direct").length;
if (directCtaDays > 3) {
  throw new Error(`Weekly plan overuses direct product CTAs; received ${directCtaDays}.`);
}
if (opportunity.recommended_route === "new_pack" && (opportunity.commercial_score.total < 30 || opportunity.evidence.length < 3)) {
  throw new Error("A new paid pack requires at least 30/35 and three distinct credible evidence items.");
}

const evidenceMd = opportunity.evidence.map((x) => `- **${x.date} — ${x.headline}:** ${x.problem_signal} _Basis: ${x.source_basis}_`).join("\n");
const score = opportunity.commercial_score;
const contentMd = opportunity.content_plan.map((x) => `### ${x.day}: ${x.title}\n- **Lane:** ${x.editorial_lane}\n- **Format:** ${x.format}\n- **Angle:** ${x.angle}\n- **Product connection:** ${x.product_connection}\n- **CTA:** ${x.cta_strength}`).join("\n\n");
const markdown = `# Sapiver Forge Weekly Opportunity Brief — ${weekEnd}\n\n## Recommended route\n\n**${opportunity.recommended_route}**\n\n## Genuine audience problem\n\n### ${opportunity.problem.title}\n\n${opportunity.problem.statement}\n\n- **Affected audience:** ${opportunity.problem.affected_audience}\n- **Practical consequence:** ${opportunity.problem.practical_consequence}\n- **Why now:** ${opportunity.problem.why_now}\n- **Evergreen value:** ${opportunity.problem.evergreen_value}\n- **Confidence:** ${opportunity.problem.confidence}\n\n## Evidence from this week's approved research\n\n${evidenceMd}\n\n## Commercial score: ${score.total}/35\n\n| Criterion | Score |\n|---|---:|\n| Multiple credible stories | ${score.multiple_stories}/5 |\n| Sapiver Forge audience fit | ${score.audience_fit}/5 |\n| Repeatable task or failure | ${score.repeatable_failure}/5 |\n| Solvable with a practical pack | ${score.pack_solvability}/5 |\n| Longevity | ${score.longevity}/5 |\n| Demonstrability | ${score.demonstrability}/5 |\n| Existing-library fit | ${score.library_fit}/5 |\n\n**Decision:** ${score.decision}\n\n## Recommended product\n\n### ${opportunity.product.name}\n\n**Promise:** ${opportunity.product.promise}\n\n**Target customer:** ${opportunity.product.target_customer}\n\n**Outcome:** ${opportunity.product.outcome}\n\n**Minimum viable contents:**\n${opportunity.product.contents.map((x) => `- ${x}`).join("\n")}\n\n- **Worked example:** ${opportunity.product.worked_example}\n- **Suggested price:** ${opportunity.product.suggested_price_gbp}\n- **Main objection:** ${opportunity.product.main_objection}\n- **Demonstration:** ${opportunity.product.demonstration}\n- **Bundle destination:** ${opportunity.product.bundle_destination}\n\n## Free entry resource\n\n### ${opportunity.free_resource.name}\n\n${opportunity.free_resource.purpose}\n\n${opportunity.free_resource.contents.map((x) => `- ${x}`).join("\n")}\n\n**CTA:** ${opportunity.free_resource.cta}\n\n## Seven-day campaign\n\n${contentMd}\n\n## Editorial guardrails\n\n${opportunity.guardrails.map((x) => `- ${x}`).join("\n")}\n`;

fs.writeFileSync(path.join(outDir, "opportunity-brief.json"), JSON.stringify(opportunity, null, 2) + "\n");
fs.writeFileSync(path.join(outDir, "opportunity-brief.md"), markdown);
fs.writeFileSync(path.join(outDir, "product-brief.json"), JSON.stringify(opportunity.product, null, 2) + "\n");
fs.writeFileSync(path.join(outDir, "content-plan.json"), JSON.stringify(opportunity.content_plan, null, 2) + "\n");
fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify({ week_start: weekStart, week_end: weekEnd, status: "human_review_required", route: opportunity.recommended_route, score: score.total, files: ["opportunity-brief.json", "opportunity-brief.md", "product-brief.json", "content-plan.json"] }, null, 2) + "\n");
console.log(`Generated weekly opportunity and seven-day campaign for ${weekStart} to ${weekEnd}.`);
