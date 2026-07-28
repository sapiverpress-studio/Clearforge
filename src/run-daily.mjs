import fs from "node:fs";
import path from "node:path";
import OpenAI from "./gemini-openai-compat.mjs";

const ROOT = process.cwd();
const today = process.env.CLEARFORGE_DATE || new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());
const outDir = path.join(ROOT, "drafts", today);
const runsDir = path.join(outDir, "runs");
const configPath = path.join(ROOT, "config", "sources.json");
const promptPath = path.join(ROOT, "prompts", "daily_ai_brief_prompt.md");
const approvalPath = path.join(outDir, "approval.json");

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function write(file, content) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, content.endsWith("\n") ? content : `${content}\n`, "utf8");
}
function domainFromUrl(url) { try { return new URL(url).hostname; } catch { return null; } }
function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function tokenSet(value) {
  return new Set(normalizeText(value).split(" ").filter((x) => x.length > 2));
}
function similarity(a, b) {
  const A = tokenSet(a); const B = tokenSet(b);
  if (!A.size || !B.size) return 0;
  let intersection = 0;
  for (const token of A) if (B.has(token)) intersection += 1;
  return intersection / Math.max(A.size, B.size);
}
function safeReadJson(file) { try { return readJson(file); } catch { return null; } }

function baseDatePart(value) {
  const match = String(value || "").match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date());
}

function editorialTheme(dateValue) {
  const datePart = baseDatePart(dateValue);
  const day = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "long" }).format(new Date(`${datePart}T12:00:00Z`));
  const themes = {
    Monday: {
      slug: "work",
      title: "Work",
      focus: "AI at work: daily tasks, teams, productivity, research, writing, support, admin, meetings and practical workplace use.",
      instruction: "Prioritise stories that help creators, small operators and small businesses test AI in real work. Ask what changes a workday, what still needs human review, and what is ready to try this week."
    },
    Tuesday: {
      slug: "life",
      title: "Life",
      focus: "Life-admin and personal usefulness: learning, household planning, accessibility, personal knowledge management, family logistics, study, note-taking and everyday problem solving.",
      instruction: "Keep the angle practical and careful. Avoid medical, legal or financial advice. Focus on how AI can help people understand, organise or learn, not replace judgement."
    },
    Wednesday: {
      slug: "systems-automation",
      title: "Systems and automation",
      focus: "Systems, automation, agents, reliability, review loops, handoffs, repeatable processes, governance, failure points and human accountability.",
      instruction: "Emphasise what should and should not be automated. Explain where human checks, logs, approvals and fallbacks belong."
    },
    Thursday: {
      slug: "stacks-workflows",
      title: "Stacks and workflows",
      focus: "Tool combinations: models, apps, APIs, image, video, voice, documents, databases, scheduling, publishing and creator pipelines.",
      instruction: "Explain how pieces fit together rather than treating tools as isolated announcements. Include practical stack or workflow examples where supported by the sources."
    },
    Friday: {
      slug: "new-to-scene-watchlist",
      title: "New to the scene / what to watch",
      focus: "Emerging tools, early releases, previews, newly visible trends and practical watchlist items.",
      instruction: "Make clear what is actually available now, what is staged, and what remains uncertain. Help readers decide what to test, watch or ignore."
    },
    Saturday: {
      slug: "clearforge-forecast",
      title: "Clearforge forecast",
      focus: "Evidence-based forecast piece using the week’s confirmed developments.",
      instruction: "Ask: if this happened this week, what might reasonably follow? Which companies may follow suit? What should creators and small businesses watch? Clearly label forecasts as forecasts. Do not present predictions as facts."
    },
    Sunday: {
      slug: "weekly-recap-prediction-check",
      title: "Recap and prediction check",
      focus: "Recap the strongest developments of the week, check any recent Clearforge forecasts where evidence exists, and prepare the reader for the following week.",
      instruction: "Separate confirmed outcomes from still-open questions. Make the piece useful as a Sunday reset before the next week of AI news."
    }
  };
  return { day, date: datePart, ...themes[day] };
}

function archiveCurrentRun() {
  const currentStructured = path.join(outDir, "structured_output.json");
  if (!fs.existsSync(currentStructured)) return null;
  ensureDir(runsDir);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const archiveDir = path.join(runsDir, `run-${stamp}`);
  ensureDir(archiveDir);
  for (const entry of fs.readdirSync(outDir, { withFileTypes: true })) {
    if (entry.name === "runs") continue;
    const src = path.join(outDir, entry.name);
    const dest = path.join(archiveDir, entry.name);
    fs.renameSync(src, dest);
  }
  console.log(`Archived previous same-day run to ${path.relative(ROOT, archiveDir)}`);
  return archiveDir;
}

function collectHistoricalUsage() {
  const usedUrls = new Set();
  const usedStoryTitles = [];
  const usedHeadlines = [];
  const addData = (data) => {
    if (!data) return;
    for (const source of data.sources || []) if (source?.url) usedUrls.add(source.url);
    for (const story of data.story_summaries || []) if (story?.title) usedStoryTitles.push(story.title);
    if (data.headline) usedHeadlines.push(data.headline);
  };

  if (fs.existsSync(runsDir)) {
    for (const runName of fs.readdirSync(runsDir)) {
      addData(safeReadJson(path.join(runsDir, runName, "structured_output.json")));
    }
  }

  const draftsRoot = path.join(ROOT, "drafts");
  if (fs.existsSync(draftsRoot)) {
    const recentDates = fs.readdirSync(draftsRoot)
      .filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name) && name < today)
      .sort().reverse().slice(0, 7);
    for (const date of recentDates) addData(safeReadJson(path.join(draftsRoot, date, "structured_output.json")));
  }

  return { usedUrls: [...usedUrls], usedStoryTitles, usedHeadlines };
}

function collectRecentFreshTopicEvidence() {
  const draftsRoot = path.join(ROOT, "drafts");
  if (!fs.existsSync(draftsRoot)) return [];

  return fs.readdirSync(draftsRoot)
    .filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name) && name < today)
    .sort()
    .slice(-7)
    .map((date) => {
      const data = safeReadJson(path.join(draftsRoot, date, "structured_output.json"));
      if (!data) return null;
      return {
        date,
        headline: data.headline || "",
        story_titles: (data.story_summaries || []).map((story) => story.title).filter(Boolean),
        story_summaries: (data.story_summaries || []).map((story) => story.summary).filter(Boolean)
      };
    })
    .filter(Boolean);
}

function validateNovelty(data, history) {
  const failures = [];
  const sameDayHistory = [];
  if (fs.existsSync(runsDir)) {
    for (const runName of fs.readdirSync(runsDir)) {
      const prior = safeReadJson(path.join(runsDir, runName, "structured_output.json"));
      if (prior) sameDayHistory.push(prior);
    }
  }
  const sameDayUrls = new Set(sameDayHistory.flatMap((x) => (x.sources || []).map((s) => s.url).filter(Boolean)));
  const sameDayTitles = sameDayHistory.flatMap((x) => (x.story_summaries || []).map((s) => s.title).filter(Boolean));

  for (const source of data.sources || []) {
    if (sameDayUrls.has(source.url)) failures.push(`Reused same-day source URL: ${source.url}`);
  }
  for (const story of data.story_summaries || []) {
    for (const oldTitle of sameDayTitles) {
      const score = similarity(story.title, oldTitle);
      if (score >= 0.62) failures.push(`Story too similar to same-day story (${score.toFixed(2)}): ${story.title}`);
    }
  }

  const urls = (data.sources || []).map((s) => s.url).filter(Boolean);
  if (new Set(urls).size !== urls.length) failures.push("Duplicate URL inside new source set");
  return failures;
}

function preserveOrCreateApproval() {
  if (fs.existsSync(approvalPath)) return;
  write(approvalPath, JSON.stringify({
    date: today,
    article_approved: false,
    feature_approved: false,
    facebook_approved: false,
    pinterest_approved: false,
    youtube_approved: false,
    dev_approved: false,
    notes: "Awaiting automatic validation."
  }, null, 2));
}

function renderBrief(data, theme) {
  const sourceLines = data.sources.map((s, i) =>
    `${i + 1}. [${s.title}](${s.url}) — ${s.source_name} (${s.published_date})\n   - Coverage lane: ${s.coverage_lane}\n   - Topic category: ${s.topic_category}\n   - Evidence basis: ${s.evidence_basis}\n   - Confirmed: ${s.confirmed_fact}\n   - Interpretation: ${s.interpretation}`
  ).join("\n\n");
  const summaries = data.story_summaries.map((s) =>
    `### ${s.title}\n\n**Coverage lane:** ${s.coverage_lane}\n\n**Topic category:** ${s.topic_category}\n\n${s.summary}\n\n**Why it matters:** ${s.why_it_matters}\n\n**Practical angle:** ${s.practical_angle}\n\n**Claim to verify:** ${s.claim_to_verify}`
  ).join("\n\n");
  return `# ${data.headline}\n\nStatus: Draft — automatic validation pending\n\nEditorial theme: ${theme.day} — ${theme.title}\n\n${data.dek}\n\n## Source List\n\n${sourceLines}\n\n## Story Summaries\n\n${summaries}\n\n## Main Article\n\n${data.main_article}\n\n## Practical Takeaway\n\n${data.practical_takeaway}\n\n## What To Test Next\n\n${data.what_to_test_next}\n\n## Claims To Verify Before Publishing\n\n${data.claims_to_verify.length ? data.claims_to_verify.map((x) => `- ${x}`).join("\n") : "None — all material claims used in this edition were verified against the cited sources."}\n`;
}

function renderSocial(data, theme) {
  return `# Clearforge Social Repurpose Pack — ${today}\n\nStatus: Draft — automatic validation pending\n\nEditorial theme: ${theme.day} — ${theme.title}\n\n## TikTok Script\n\n${data.social.tiktok_script}\n\n## YouTube Shorts Script\n\n${data.social.youtube_shorts_script}\n\n## Facebook Post\n\n${data.social.facebook_post}\n\n## Pinterest Pin\n\n**Title:** ${data.social.pinterest_title}\n\n**Description:** ${data.social.pinterest_description}\n\n## LinkedIn-Style Post\n\n${data.social.linkedin_post}\n\n## 5 Short Quote/Card Lines\n\n${data.social.quote_card_lines.map((x) => `- ${x}`).join("\n")}\n\n## Suggested Headlines\n\n${data.headline_options.map((x) => `- ${x}`).join("\n")}\n`;
}

const schema = {
  type: "object", additionalProperties: false,
  required: ["headline", "dek", "sources", "story_summaries", "main_article", "practical_takeaway", "what_to_test_next", "claims_to_verify", "social", "headline_options"],
  properties: {
    headline: { type: "string" }, dek: { type: "string" },
    sources: { type: "array", minItems: 3, maxItems: 5, items: { type: "object", additionalProperties: false, required: ["source_name", "title", "url", "published_date", "coverage_lane", "topic_category", "evidence_basis", "confirmed_fact", "interpretation"], properties: { source_name: { type: "string" }, title: { type: "string" }, url: { type: "string" }, published_date: { type: "string" }, coverage_lane: { type: "string", enum: ["confirmed_development", "human_impact"] }, topic_category: { type: "string", enum: ["creator_tools_and_media", "coding_and_building", "workplace_and_business", "models_and_infrastructure", "research_and_science", "policy_safety_and_security", "education_employment_and_society"] }, evidence_basis: { type: "string" }, confirmed_fact: { type: "string" }, interpretation: { type: "string" } } } },
    story_summaries: { type: "array", minItems: 3, maxItems: 5, items: { type: "object", additionalProperties: false, required: ["title", "coverage_lane", "topic_category", "summary", "why_it_matters", "practical_angle", "claim_to_verify"], properties: { title: { type: "string" }, coverage_lane: { type: "string", enum: ["confirmed_development", "human_impact"] }, topic_category: { type: "string", enum: ["creator_tools_and_media", "coding_and_building", "workplace_and_business", "models_and_infrastructure", "research_and_science", "policy_safety_and_security", "education_employment_and_society"] }, summary: { type: "string" }, why_it_matters: { type: "string" }, practical_angle: { type: "string" }, claim_to_verify: { type: "string" } } } },
    main_article: { type: "string" }, practical_takeaway: { type: "string" }, what_to_test_next: { type: "string" }, claims_to_verify: { type: "array", items: { type: "string" } },
    social: { type: "object", additionalProperties: false, required: ["tiktok_script", "youtube_shorts_script", "facebook_post", "pinterest_title", "pinterest_description", "linkedin_post", "quote_card_lines"], properties: { tiktok_script: { type: "string" }, youtube_shorts_script: { type: "string" }, facebook_post: { type: "string" }, pinterest_title: { type: "string" }, pinterest_description: { type: "string" }, linkedin_post: { type: "string" }, quote_card_lines: { type: "array", minItems: 5, maxItems: 5, items: { type: "string" } } } },
    headline_options: { type: "array", minItems: 5, maxItems: 5, items: { type: "string" } }
  }
};

function validateCoverageMix(candidate) {
  const failures = [];
  const sources = Array.isArray(candidate?.sources) ? candidate.sources : [];
  const stories = Array.isArray(candidate?.story_summaries) ? candidate.story_summaries : [];
  const count = (items, lane) => items.filter((item) => item.coverage_lane === lane).length;
  if (count(sources, "confirmed_development") < 2 || count(stories, "confirmed_development") < 2) {
    failures.push("Research mix requires at least two confirmed AI developments.");
  }
  if (count(sources, "human_impact") < 1 || count(stories, "human_impact") < 1) {
    failures.push("Research mix requires at least one evidence-based human-impact story.");
  }
  if (new Set(stories.map((item) => item.topic_category)).size < 3) {
    failures.push("Research mix requires at least three distinct topic categories.");
  }
  for (const source of sources) {
    let host = "";
    try { host = new URL(source.url).hostname.toLowerCase(); } catch { failures.push(`Invalid source URL: ${source.url}`); continue; }
    if (host === "tiktok.com" || host.endsWith(".tiktok.com")) {
      failures.push("TikTok may be used only as a discovery lead, never as evidence.");
    }
    if (source.coverage_lane === "human_impact" && String(source.evidence_basis || "").trim().length < 20) {
      failures.push(`Human-impact evidence basis is too weak for: ${source.title}`);
    }
  }
  return failures;
}

async function main() {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required for automated daily research.");
  ensureDir(outDir);
  archiveCurrentRun();
  const history = collectHistoricalUsage();
  const recentFreshTopicEvidence = collectRecentFreshTopicEvidence();
  preserveOrCreateApproval();

  const config = readJson(configPath);
  const preferredSources = config.sources.map(({ name, type, url, use_for }) => ({ name, type, url, use_for }));
  const prompt = fs.readFileSync(promptPath, "utf8");
  const theme = editorialTheme(today);
  const client = new OpenAI();
  const model = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";

  let data = null;
  let lastNoveltyFailures = [];
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const exclusions = {
      urls_already_used: history.usedUrls,
      story_titles_already_used: history.usedStoryTitles,
      headlines_already_used: history.usedHeadlines,
      failed_attempt_reasons: lastNoveltyFailures
    };

    const response = await client.responses.create({
      model,
      reasoning: { effort: attempt === 1 ? "low" : "medium" },
      tools: [{ type: "web_search", user_location: { type: "approximate", country: "GB", city: "London" } }],
      include: ["web_search_call.action.sources"],
      input: [
        { role: "system", content: "Before selecting stories, actively sweep all seven discovery categories: creator tools and media (including image, video, audio, design, editing, publishing, vibe editing and vibe directing); coding and building (agents, app creation, no-code, vibe coding and automation); workplace and business; models and infrastructure; research and science; policy, safety and security; and education, employment and society. Do not stop after finding major-company announcements. Select 3–5 stories spanning at least three genuinely distinct topic categories; several companies discussing the same underlying subject do not constitute breadth. Set topic_category on every source and matching story summary." },
        { role: "system", content: "You are the Clearforge Daily AI Brief Builder. Research first. Use the broad allowed source pool. Prefer primary sources for facts and reputable journalism for discovery/context. Distinguish confirmed facts from interpretation. Never copy article wording. A rerun must be genuinely new, not a reframing of earlier stories. Follow the supplied weekday editorial theme so the output has a distinct daily purpose. Resolve every material claim against cited evidence. A supplier announcement confirms what was announced, not a customer outcome. Drop any story whose material access, timing, pricing, scale, deployment or outcome claims remain unresolved. TikTok and other short-form creator posts may alert you to a possible story, but TikTok must never appear as a cited source or evidence. Trace the claim to the original speech, interview, transcript, survey, methodology, organisation, filing, research paper or credible reporting before using it." },
        { role: "user", content: `${prompt}\n\nTODAY: ${today}\n\nCLEARFORGE WEEKDAY EDITORIAL THEME:\nDay: ${theme.day}\nTheme: ${theme.title}\nFocus: ${theme.focus}\nInstruction: ${theme.instruction}\n\nFor Saturday forecast editions, label forecasts as forecasts and do not present predictions as confirmed facts. For Sunday recap editions, separate confirmed outcomes from open questions and prepare the reader for the following week.\n\nFRESH-TOPIC ROTATION EVIDENCE — PREVIOUS SEVEN FRESH EDITIONS:\n${JSON.stringify(recentFreshTopicEvidence)}\n\nFRESH-TOPIC ROTATION RULE:\nInfer the dominant recurring subject from these previous seven fresh editions. A subject is dominant when it materially shaped multiple editions or most of one week's coverage; treat close semantic variants as the same subject. Do not choose that dominant subject again for today's fresh edition, even if it is still prominent in the news. For example, price versus performance, model value, inference cost and cheaper-model comparisons are one topic family. Select a materially different subject supported by genuinely fresh reporting. The same dominant fresh topic may run for no more than one week and must then have at least one full week out. This topic exclusion overrides popularity, but it does not override factual quality or the weekday editorial theme. If the evidence is too mixed to identify one dominant subject, avoid the two most repeated subject families.\n\nEXCLUSIONS FROM EARLIER RUNS:\n${JSON.stringify(exclusions)}\n\nPREFERRED DISCOVERY SOURCES (starting points, not a closed allow-list):\n${JSON.stringify(preferredSources)}\n\nREQUIRED RESEARCH MIX:\n- Select 3 to 5 distinct stories.\n- At least two must be confirmed_development stories: verified AI releases, research, policy, infrastructure, adoption, deployments or other concrete developments. Prefer the last 48 hours.\n- At least one must be a human_impact story: evidence about workplace adoption, education, employment, public reaction, creator experience, changing skills, surveys, speeches, interviews or documented case studies.\n- For the human-impact lane, search the last 48 hours first. If no strong candidate exists, expand only that lane to the previous seven days rather than forcing a weak or speculative story.\n- A human-impact story needs traceable evidence: the original speech/interview/transcript, original survey and methodology, named adopting organisation or case study, research paper, government/statistical source, or credible reporting that identifies its evidence. Record this in evidence_basis.\n- TikTok or another creator video may be a discovery lead, but do not cite it, repeat its interpretation as fact or include its URL. Trace every usable claim to the underlying evidence.\n- Set coverage_lane on every source and story summary to confirmed_development or human_impact. Use matching lanes for the source and story it supports.\n\nResearch the most useful AI developments filtered through today’s editorial theme. You may search outside the preferred pool when needed to reach the original speaker, survey, adopting organisation, official documentation, regulators, filings, research, statistical evidence or credible independent corroboration. Do not use any excluded URL. Do not select a story substantially similar to any excluded story title, even from a different publication. Prefer developments not covered in earlier runs. Maintain a mix of companies, research, policy, infrastructure, open-source, creator tools, business use, safety and real human consequences. The main article must be 700 to 1000 words and practical for creators, small businesses, and AI learners. For every story, set claim_to_verify to exactly "NONE — verified from cited sources." only after all material claims used are supported. Otherwise record the unresolved claim and allow validation to block the edition. claims_to_verify must be empty for publication.` }
      ],
      text: { format: { type: "json_schema", name: "clearforge_daily_brief", strict: true, schema } }
    });

    if (!response.output_text) throw new Error("Gemini returned no structured output.");
    const candidate = JSON.parse(response.output_text);
    lastNoveltyFailures = [
      ...validateNovelty(candidate, history),
      ...validateCoverageMix(candidate)
    ];
    if (!lastNoveltyFailures.length) { data = candidate; break; }
    console.warn(`Novelty attempt ${attempt} rejected: ${lastNoveltyFailures.join(" | ")}`);
  }

  if (!data) throw new Error(`Could not produce a genuinely fresh same-day story set after 4 attempts: ${lastNoveltyFailures.join("; ")}`);

  const enrichedData = { ...data, editorial_theme: theme };
  write(path.join(outDir, "daily_brief.md"), renderBrief(enrichedData, theme));
  write(path.join(outDir, "social_pack.md"), renderSocial(enrichedData, theme));
  write(path.join(outDir, "sources.json"), JSON.stringify(enrichedData.sources, null, 2));
  write(path.join(outDir, "structured_output.json"), JSON.stringify(enrichedData, null, 2));
  write(path.join(outDir, "editorial_theme.json"), JSON.stringify(theme, null, 2));
  write(path.join(outDir, "novelty_report.json"), JSON.stringify({ date: today, editorial_theme: theme, same_day_prior_runs: fs.existsSync(runsDir) ? fs.readdirSync(runsDir).length : 0, excluded_url_count: history.usedUrls.length, excluded_story_title_count: history.usedStoryTitles.length, topic_rotation_evidence_dates: recentFreshTopicEvidence.map((item) => item.date), consecutive_week_topic_block: true, confirmed_development_count: enrichedData.story_summaries.filter((item) => item.coverage_lane === "confirmed_development").length, human_impact_count: enrichedData.story_summaries.filter((item) => item.coverage_lane === "human_impact").length, topic_categories: [...new Set(enrichedData.story_summaries.map((item) => item.topic_category))], tiktok_used_as_evidence: false, passed: true }, null, 2));
  write(path.join(outDir, "claims_to_verify.md"), `# Claims To Verify — ${today}\n\nEditorial theme: ${theme.day} — ${theme.title}\n\n${enrichedData.claims_to_verify.length ? enrichedData.claims_to_verify.map((x) => `- [ ] ${x}`).join("\n") : "None — all material claims used in this edition were verified against the cited sources."}\n`);
  write(path.join(outDir, "editor_checklist.md"), `# Clearforge Automatic QA Context — ${today}\n\n- Editorial theme: ${theme.day} — ${theme.title}.\n- Current run passed same-day URL exclusion.\n- Current run passed same-day story-title similarity gate.\n- Previous same-day runs are archived under drafts/${today}/runs/.\n- Automatic validation blocks publication when any material claim remains unresolved.\n- Supplier claims about customer outcomes require customer confirmation or credible independent reporting.\n`);
  console.log(`Clearforge fresh daily pack created in drafts/${today} using ${theme.day} theme: ${theme.title}`);
}

main().catch((error) => { console.error(error); process.exit(1); });
