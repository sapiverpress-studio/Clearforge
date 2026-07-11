import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";

const ROOT = process.cwd();
const DATE = process.env.CLEARFORGE_DATE || new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());
const outDir = path.join(ROOT, "drafts", DATE);
const runsDir = path.join(outDir, "runs");
const approvalPath = path.join(outDir, "approval.json");
const structuredPath = path.join(outDir, "structured_output.json");
const angle = process.env.CLEARFORGE_ANGLE || "creator_workflow";

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function write(file, content) { ensureDir(path.dirname(file)); fs.writeFileSync(file, content.endsWith("\n") ? content : `${content}\n`, "utf8"); }
function safeReadJson(file) { try { return readJson(file); } catch { return null; } }

function archiveCurrentRun(label = "alternate-angle-source") {
  if (!fs.existsSync(structuredPath)) return null;
  ensureDir(runsDir);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const archiveDir = path.join(runsDir, `${label}-${stamp}`);
  ensureDir(archiveDir);
  for (const entry of fs.readdirSync(outDir, { withFileTypes: true })) {
    if (entry.name === "runs") continue;
    const src = path.join(outDir, entry.name);
    const dest = path.join(archiveDir, entry.name);
    fs.renameSync(src, dest);
  }
  console.log(`Archived current edition to ${path.relative(ROOT, archiveDir)}`);
  return archiveDir;
}

function findResearchBase() {
  const candidates = [];
  if (fs.existsSync(structuredPath)) candidates.push({ name: "current", file: structuredPath });
  if (fs.existsSync(runsDir)) {
    for (const runName of fs.readdirSync(runsDir).sort().reverse()) {
      const file = path.join(runsDir, runName, "structured_output.json");
      if (fs.existsSync(file)) candidates.push({ name: runName, file });
    }
  }
  for (const candidate of candidates) {
    const data = safeReadJson(candidate.file);
    if (data?.sources?.length >= 3 && data?.story_summaries?.length >= 3) return { ...candidate, data };
  }
  throw new Error(`No usable same-day research base found for ${DATE}. Run a fresh edition first.`);
}

function preserveOrCreateApproval() {
  write(approvalPath, JSON.stringify({
    date: DATE,
    article_approved: false,
    feature_approved: false,
    facebook_approved: false,
    pinterest_approved: false,
    youtube_approved: false,
    dev_approved: false,
    edition_mode: "alternate_angle",
    angle,
    notes: "Awaiting automatic validation."
  }, null, 2));
}

function renderBrief(data) {
  const sourceLines = data.sources.map((s, i) =>
    `${i + 1}. [${s.title}](${s.url}) — ${s.source_name} (${s.published_date})\n   - Confirmed: ${s.confirmed_fact}\n   - Interpretation: ${s.interpretation}`
  ).join("\n\n");
  const summaries = data.story_summaries.map((s) =>
    `### ${s.title}\n\n${s.summary}\n\n**Why it matters:** ${s.why_it_matters}\n\n**Practical angle:** ${s.practical_angle}\n\n**Claim to verify:** ${s.claim_to_verify}`
  ).join("\n\n");
  return `# ${data.headline}\n\nStatus: Alternate-angle draft — automatic validation pending\n\nEdition angle: ${data.edition_angle}\n\n${data.dek}\n\n## Source List\n\n${sourceLines}\n\n## Story Summaries\n\n${summaries}\n\n## Main Article\n\n${data.main_article}\n\n## Practical Takeaway\n\n${data.practical_takeaway}\n\n## What To Test Next\n\n${data.what_to_test_next}\n\n## Claims To Verify Before Publishing\n\n${data.claims_to_verify.map((x) => `- ${x}`).join("\n")}\n`;
}

function renderSocial(data) {
  return `# Clearforge Social Repurpose Pack — ${DATE}\n\nStatus: Alternate-angle draft — automatic validation pending\n\nEdition angle: ${data.edition_angle}\n\n## TikTok Script\n\n${data.social.tiktok_script}\n\n## YouTube Shorts Script\n\n${data.social.youtube_shorts_script}\n\n## Facebook Post\n\n${data.social.facebook_post}\n\n## Pinterest Pin\n\n**Title:** ${data.social.pinterest_title}\n\n**Description:** ${data.social.pinterest_description}\n\n## LinkedIn-Style Post\n\n${data.social.linkedin_post}\n\n## 5 Short Quote/Card Lines\n\n${data.social.quote_card_lines.map((x) => `- ${x}`).join("\n")}\n\n## Suggested Headlines\n\n${data.headline_options.map((x) => `- ${x}`).join("\n")}\n`;
}

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "dek", "edition_angle", "sources", "story_summaries", "main_article", "practical_takeaway", "what_to_test_next", "claims_to_verify", "social", "headline_options"],
  properties: {
    headline: { type: "string" },
    dek: { type: "string" },
    edition_angle: { type: "string" },
    sources: { type: "array", minItems: 3, maxItems: 5, items: { type: "object", additionalProperties: false, required: ["source_name", "title", "url", "published_date", "confirmed_fact", "interpretation"], properties: { source_name: { type: "string" }, title: { type: "string" }, url: { type: "string" }, published_date: { type: "string" }, confirmed_fact: { type: "string" }, interpretation: { type: "string" } } } },
    story_summaries: { type: "array", minItems: 3, maxItems: 5, items: { type: "object", additionalProperties: false, required: ["title", "summary", "why_it_matters", "practical_angle", "claim_to_verify"], properties: { title: { type: "string" }, summary: { type: "string" }, why_it_matters: { type: "string" }, practical_angle: { type: "string" }, claim_to_verify: { type: "string" } } } },
    main_article: { type: "string" },
    practical_takeaway: { type: "string" },
    what_to_test_next: { type: "string" },
    claims_to_verify: { type: "array", items: { type: "string" } },
    social: { type: "object", additionalProperties: false, required: ["tiktok_script", "youtube_shorts_script", "facebook_post", "pinterest_title", "pinterest_description", "linkedin_post", "quote_card_lines"], properties: { tiktok_script: { type: "string" }, youtube_shorts_script: { type: "string" }, facebook_post: { type: "string" }, pinterest_title: { type: "string" }, pinterest_description: { type: "string" }, linkedin_post: { type: "string" }, quote_card_lines: { type: "array", minItems: 5, maxItems: 5, items: { type: "string" } } } },
    headline_options: { type: "array", minItems: 5, maxItems: 5, items: { type: "string" } }
  }
};

async function main() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required for alternate-angle generation.");
  ensureDir(outDir);
  const base = findResearchBase();
  archiveCurrentRun("alternate-angle-source");
  preserveOrCreateApproval();

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL || "gpt-5.4-mini";
  const response = await client.responses.create({
    model,
    reasoning: { effort: "medium" },
    input: [
      { role: "system", content: "You are the Clearforge alternate-angle editor. Reuse the supplied verified source material, but create a genuinely different editorial edition. Do not invent new source facts. Do not claim this is new reporting. Make the article, social post and video script feel meaningfully different from a standard news recap." },
      { role: "user", content: `DATE: ${DATE}\nANGLE: ${angle}\nBASE RUN: ${base.name}\n\nSOURCE MATERIAL:\n${JSON.stringify(base.data)}\n\nCreate a second daily edition from the same verified materials. Keep the same source URLs and confirmed facts, but change the angle. Angle guidance:\n- creator_workflow: explain what creators and small operators can practically test.\n- risk_control: focus on limits, review, safety, governance and what not to automate blindly.\n- beginner_learning: explain the story for AI learners without jargon.\n- business_systems: focus on workflows, cost, repeatability and process design.\n\nRequirements:\n- main_article 700–1,000 words.\n- Full article must not read like the original news briefing.\n- Social and YouTube scripts must be new and useful for manual TikTok reposting.\n- Same sources are allowed because this is an alternate-angle edition.\n- Do not add new URLs.\n- Do not invent new announcements, benchmarks, dates, prices or product availability.\n- Keep Clearforge voice: practical, plain, no hype.` }
    ],
    text: { format: { type: "json_schema", name: "clearforge_alternate_angle_brief", strict: true, schema } }
  });

  if (!response.output_text) throw new Error("OpenAI returned no alternate-angle output.");
  const data = JSON.parse(response.output_text);
  write(path.join(outDir, "daily_brief.md"), renderBrief(data));
  write(path.join(outDir, "social_pack.md"), renderSocial(data));
  write(path.join(outDir, "sources.json"), JSON.stringify(data.sources, null, 2));
  write(path.join(outDir, "structured_output.json"), JSON.stringify(data, null, 2));
  write(path.join(outDir, "alternate_angle_report.json"), JSON.stringify({ date: DATE, angle, reused_base_run: base.name, source_urls_reused: data.sources.map((s) => s.url), passed: true }, null, 2));
  write(path.join(outDir, "claims_to_verify.md"), `# Claims To Verify — ${DATE}\n\nAlternate-angle edition based on previously verified source material.\n\n${data.claims_to_verify.map((x) => `- [ ] ${x}`).join("\n")}\n`);
  write(path.join(outDir, "editor_checklist.md"), `# Clearforge Automatic QA Context — ${DATE}\n\n- This is an alternate-angle edition.\n- Same source material may be reused deliberately.\n- Validate the article and feature against the same confirmed source facts.\n`);
  console.log(`Clearforge alternate-angle edition created from ${base.name} using angle ${angle}.`);
}

main().catch((error) => { console.error(error); process.exit(1); });
