import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";

const ROOT = process.cwd();
const londonDate = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());
const DATE = process.env.CLEARFORGE_DATE || `${londonDate}-alt`;
const BASE_DATE = process.env.CLEARFORGE_BASE_DATE || DATE.replace(/-alt$/, "");
const outDir = path.join(ROOT, "drafts", DATE);
const baseDir = path.join(ROOT, "drafts", BASE_DATE);
const runsDir = path.join(outDir, "runs");
const baseRunsDir = path.join(baseDir, "runs");
const approvalPath = path.join(outDir, "approval.json");
const structuredPath = path.join(outDir, "structured_output.json");
const baseStructuredPath = path.join(baseDir, "structured_output.json");
const angle = process.env.CLEARFORGE_ANGLE || "creator_workflow";

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function write(file, content) { ensureDir(path.dirname(file)); fs.writeFileSync(file, content.endsWith("\n") ? content : `${content}\n`, "utf8"); }
function safeReadJson(file) { try { return readJson(file); } catch { return null; } }

function baseDatePart(value) {
  const match = String(value || "").match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : londonDate;
}

function editorialTheme(dateValue) {
  const datePart = baseDatePart(dateValue);
  const day = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "long" }).format(new Date(`${datePart}T12:00:00Z`));
  const themes = {
    Monday: { slug: "work", title: "Work", focus: "AI at work: daily tasks, teams, productivity, research, writing, support, admin, meetings and practical workplace use.", instruction: "Prioritise what creators, small operators and small businesses can test in real work this week." },
    Tuesday: { slug: "life", title: "Life", focus: "Life-admin and personal usefulness: learning, household planning, accessibility, personal knowledge management, family logistics, study, note-taking and everyday problem solving.", instruction: "Keep the angle practical and careful. Avoid medical, legal or financial advice." },
    Wednesday: { slug: "systems-automation", title: "Systems and automation", focus: "Systems, automation, agents, reliability, review loops, handoffs, repeatable processes, governance, failure points and human accountability.", instruction: "Emphasise what should and should not be automated, and where human review belongs." },
    Thursday: { slug: "stacks-workflows", title: "Stacks and workflows", focus: "Tool combinations: models, apps, APIs, image, video, voice, documents, databases, scheduling, publishing and creator pipelines.", instruction: "Explain how pieces fit together rather than treating tools as isolated announcements." },
    Friday: { slug: "new-to-scene-watchlist", title: "New to the scene / what to watch", focus: "Emerging tools, early releases, previews, newly visible trends and practical watchlist items.", instruction: "Make clear what is available now, what is staged, and what remains uncertain." },
    Saturday: { slug: "clearforge-forecast", title: "Clearforge forecast", focus: "Evidence-based forecast piece using the week’s confirmed developments.", instruction: "Label forecasts as forecasts. Ask what might reasonably follow and who may follow suit, without presenting predictions as facts." },
    Sunday: { slug: "weekly-recap-prediction-check", title: "Recap and prediction check", focus: "Recap the strongest developments of the week, check recent forecasts where evidence exists, and prepare the reader for the following week.", instruction: "Separate confirmed outcomes from still-open questions." }
  };
  return { day, date: datePart, ...themes[day] };
}

function archiveCurrentRun(label = "alternate-angle-previous") {
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
  console.log(`Archived current alternate edition to ${path.relative(ROOT, archiveDir)}`);
  return archiveDir;
}

function findResearchBase() {
  const candidates = [];
  if (fs.existsSync(baseStructuredPath)) candidates.push({ name: `base-current-${BASE_DATE}`, file: baseStructuredPath });
  if (fs.existsSync(baseRunsDir)) {
    for (const runName of fs.readdirSync(baseRunsDir).sort().reverse()) {
      const file = path.join(baseRunsDir, runName, "structured_output.json");
      if (fs.existsSync(file)) candidates.push({ name: `base-archive-${runName}`, file });
    }
  }
  for (const candidate of candidates) {
    const data = safeReadJson(candidate.file);
    if (data?.sources?.length >= 3 && data?.story_summaries?.length >= 3) return { ...candidate, data };
  }
  throw new Error(`No usable research base found for ${BASE_DATE}. Run a fresh edition first.`);
}

function preserveOrCreateApproval() {
  write(approvalPath, JSON.stringify({
    date: DATE,
    base_date: BASE_DATE,
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
  const themeLine = data.editorial_theme ? `\n\nEditorial theme: ${data.editorial_theme.day} — ${data.editorial_theme.title}` : "";
  return `# ${data.headline}\n\nStatus: Alternate-angle draft — automatic validation pending\n\nEdition ID: ${DATE}\n\nSource edition: ${BASE_DATE}\n\nEdition angle: ${data.edition_angle}${themeLine}\n\n${data.dek}\n\n## Source List\n\n${sourceLines}\n\n## Story Summaries\n\n${summaries}\n\n## Main Article\n\n${data.main_article}\n\n## Practical Takeaway\n\n${data.practical_takeaway}\n\n## What To Test Next\n\n${data.what_to_test_next}\n\n## Claims To Verify Before Publishing\n\n${data.claims_to_verify.length ? data.claims_to_verify.map((x) => `- ${x}`).join("\n") : "None — all material claims used in this edition were verified against the cited sources."}\n`;
}

function renderSocial(data) {
  const themeLine = data.editorial_theme ? `\n\nEditorial theme: ${data.editorial_theme.day} — ${data.editorial_theme.title}` : "";
  return `# Clearforge Social Repurpose Pack — ${DATE}\n\nStatus: Alternate-angle draft — automatic validation pending\n\nSource edition: ${BASE_DATE}\n\nEdition angle: ${data.edition_angle}${themeLine}\n\n## TikTok Script\n\n${data.social.tiktok_script}\n\n## YouTube Shorts Script\n\n${data.social.youtube_shorts_script}\n\n## Facebook Post\n\n${data.social.facebook_post}\n\n## Pinterest Pin\n\n**Title:** ${data.social.pinterest_title}\n\n**Description:** ${data.social.pinterest_description}\n\n## LinkedIn-Style Post\n\n${data.social.linkedin_post}\n\n## 5 Short Quote/Card Lines\n\n${data.social.quote_card_lines.map((x) => `- ${x}`).join("\n")}\n\n## Suggested Headlines\n\n${data.headline_options.map((x) => `- ${x}`).join("\n")}\n`;
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
  archiveCurrentRun("alternate-angle-previous");
  preserveOrCreateApproval();

  const theme = base.data.editorial_theme || editorialTheme(BASE_DATE);
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL || "gpt-5.4-mini";
  const response = await client.responses.create({
    model,
    reasoning: { effort: "medium" },
    input: [
      { role: "system", content: "You are the Clearforge alternate-angle editor. Reuse the supplied verified source material, but create a genuinely different editorial edition. Do not invent new source facts. Do not claim this is new reporting. Make the article, social post and video script feel meaningfully different from a standard news recap. Preserve the day’s editorial theme while applying the selected alternate lens. Do not introduce or amplify any claim that is unresolved in the source edition. Every story must retain support from the cited source material." },
      { role: "user", content: `EDITION ID: ${DATE}\nSOURCE DATE: ${BASE_DATE}\nANGLE: ${angle}\nBASE RUN: ${base.name}\n\nWEEKDAY EDITORIAL THEME:\nDay: ${theme.day}\nTheme: ${theme.title}\nFocus: ${theme.focus}\nInstruction: ${theme.instruction}\n\nSOURCE MATERIAL:\n${JSON.stringify(base.data)}\n\nCreate a second daily edition from the same verified materials. Keep the same source URLs and confirmed facts, but change the angle. Preserve the weekday theme so the edition still fits the Clearforge weekly rhythm. Angle guidance:\n- creator_workflow: explain what creators and small operators can practically test.\n- risk_control: focus on limits, review, safety, governance and what not to automate blindly.\n- beginner_learning: explain the story for AI learners without jargon.\n- business_systems: focus on workflows, cost, repeatability and process design.\n\nRequirements:\n- main_article 700–1,000 words.\n- Full article must not read like the original news briefing.\n- Social and YouTube scripts must be new and useful for manual TikTok reposting.\n- Same sources are allowed because this is an alternate-angle edition.\n- Do not add new URLs.\n- Do not invent new announcements, benchmarks, dates, prices or product availability.\n- Keep Clearforge voice: practical, plain, no hype.\n- Set every story claim_to_verify to exactly "NONE — verified from cited sources." only when the reused source material supports every material claim used.\n- Keep claims_to_verify empty for publication. If the alternate framing creates an unsupported implication, record it there so validation blocks the edition.\n- For Saturday forecast editions, label forecasts as forecasts. For Sunday recap editions, separate confirmed outcomes from still-open questions.` }
    ],
    text: { format: { type: "json_schema", name: "clearforge_alternate_angle_brief", strict: true, schema } }
  });

  if (!response.output_text) throw new Error("OpenAI returned no alternate-angle output.");
  const data = JSON.parse(response.output_text);
  const enrichedData = { ...data, editorial_theme: theme, edition_id: DATE, base_date: BASE_DATE, edition_mode: "alternate_angle" };
  write(path.join(outDir, "daily_brief.md"), renderBrief(enrichedData));
  write(path.join(outDir, "social_pack.md"), renderSocial(enrichedData));
  write(path.join(outDir, "sources.json"), JSON.stringify(enrichedData.sources, null, 2));
  write(path.join(outDir, "structured_output.json"), JSON.stringify(enrichedData, null, 2));
  write(path.join(outDir, "editorial_theme.json"), JSON.stringify(theme, null, 2));
  write(path.join(outDir, "alternate_angle_report.json"), JSON.stringify({ date: DATE, base_date: BASE_DATE, angle, editorial_theme: theme, reused_base_run: base.name, source_urls_reused: enrichedData.sources.map((s) => s.url), passed: true }, null, 2));
  write(path.join(outDir, "claims_to_verify.md"), `# Claims To Verify — ${DATE}\n\nAlternate-angle edition based on previously verified source material from ${BASE_DATE}.\n\nEditorial theme: ${theme.day} — ${theme.title}\n\n${enrichedData.claims_to_verify.length ? enrichedData.claims_to_verify.map((x) => `- [ ] ${x}`).join("\n") : "None — all material claims used in this edition were verified against the cited sources."}\n`);
  write(path.join(outDir, "editor_checklist.md"), `# Clearforge Automatic QA Context — ${DATE}\n\n- This is an alternate-angle edition.\n- Source edition: ${BASE_DATE}.\n- Editorial theme: ${theme.day} — ${theme.title}.\n- Same source material may be reused deliberately.\n- Validate the article and feature against the same confirmed source facts.\n`);
  console.log(`Clearforge alternate-angle edition ${DATE} created from ${BASE_DATE}/${base.name} using angle ${angle} and ${theme.day} theme.`);
}

main().catch((error) => { console.error(error); process.exit(1); });
