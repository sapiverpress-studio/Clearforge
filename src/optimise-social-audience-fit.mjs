import fs from "node:fs";
import path from "node:path";
import OpenAI from "./gemini-openai-compat.mjs";

const ROOT = process.cwd();
const DATE = process.env.SAPIVER_FORGE_DATE || process.env.CLEARFORGE_DATE || new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());
const draftDir = path.join(ROOT, "drafts", DATE);
const structuredPath = path.join(draftDir, "structured_output.json");
const performancePath = path.join(ROOT, "config", "tiktok-performance.json");

if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required for audience-fit optimisation.");
if (!fs.existsSync(structuredPath)) throw new Error(`Missing ${structuredPath}`);

const source = JSON.parse(fs.readFileSync(structuredPath, "utf8"));
const tiktokPerformance = fs.existsSync(performancePath)
  ? JSON.parse(fs.readFileSync(performancePath, "utf8"))
  : null;
const stories = Array.isArray(source.story_summaries) ? source.story_summaries : [];
if (stories.length < 3) throw new Error("Audience-fit optimisation needs at least three verified stories.");
const consideredQuestionEdition =
  String(source.edition_angle || "").toLowerCase().includes("considered") ||
  String(source.edition_mode || "").toLowerCase().includes("considered") ||
  DATE.endsWith("-considered");
const editionSpecificRules = consideredQuestionEdition
  ? `\n\nEVENING CONSIDERED-QUESTION FORMAT:
- This is the evening companion to the morning factual news update, using the same verified research.
- Choose the single story with the strongest evidence-supported second-order consequence, trade-off, missing safeguard or affected group.
- TikTok, YouTube Shorts, Facebook and LinkedIn must all centre that story and consequence so the evening edition has one coherent question.
- Open immediately with a natural specific question such as "Could this affect...?", "What happens if...?" or "Have they considered...?" Use whichever wording sounds natural; do not force the same phrase every day.
- State the confirmed fact separately from the consequence being questioned. Never present the question, inference or possible effect as a confirmed outcome.
- Do not manufacture disagreement, fear or criticism. If no responsible challenge is supported, use a practical trade-off or implementation question instead.
- TikTok must contain one question, one verified fact, one affected audience and one concrete response prompt. Do not use a generic multi-story news opening.`
  : "";

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["story_assessments", "platform_selections", "social", "overall_reasoning"],
  properties: {
    story_assessments: {
      type: "array", minItems: 3, maxItems: 5,
      items: {
        type: "object", additionalProperties: false,
        required: ["story_index", "story_title", "target_audience", "audience_problem_or_desire", "interest_signal", "stop_reason", "promised_payoff", "proof_point", "search_phrases", "scores", "overall_score", "score_reason"],
        properties: {
          story_index: { type: "integer", minimum: 0, maximum: 4 },
          story_title: { type: "string" },
          target_audience: { type: "string" },
          audience_problem_or_desire: { type: "string" },
          interest_signal: { type: "string" },
          stop_reason: { type: "string" },
          promised_payoff: { type: "string" },
          proof_point: { type: "string" },
          search_phrases: { type: "array", minItems: 3, maxItems: 5, items: { type: "string" } },
          scores: {
            type: "object", additionalProperties: false,
            required: ["audience_fit", "practical_consequence", "searchability", "stranger_usefulness", "novelty", "visual_potential", "discussion_potential", "short_form_clarity"],
            properties: {
              audience_fit: { type: "integer", minimum: 1, maximum: 10 },
              practical_consequence: { type: "integer", minimum: 1, maximum: 10 },
              searchability: { type: "integer", minimum: 1, maximum: 10 },
              stranger_usefulness: { type: "integer", minimum: 1, maximum: 10 },
              novelty: { type: "integer", minimum: 1, maximum: 10 },
              visual_potential: { type: "integer", minimum: 1, maximum: 10 },
              discussion_potential: { type: "integer", minimum: 1, maximum: 10 },
              short_form_clarity: { type: "integer", minimum: 1, maximum: 10 }
            }
          },
          overall_score: { type: "integer", minimum: 1, maximum: 10 },
          score_reason: { type: "string" }
        }
      }
    },
    platform_selections: {
      type: "object", additionalProperties: false,
      required: ["tiktok", "youtube", "facebook", "pinterest", "linkedin"],
      properties: Object.fromEntries(["tiktok", "youtube", "facebook", "pinterest", "linkedin"].map((platform) => [platform, {
        type: "object", additionalProperties: false,
        required: ["story_index", "story_title", "target_audience", "format", "opening", "payoff", "selection_reason", "platform_fit_score"],
        properties: {
          story_index: { type: "integer", minimum: 0, maximum: 4 },
          story_title: { type: "string" },
          target_audience: { type: "string" },
          format: { type: "string" },
          opening: { type: "string" },
          payoff: { type: "string" },
          selection_reason: { type: "string" },
          platform_fit_score: { type: "integer", minimum: 7, maximum: 10 }
        }
      }]))
    },
    social: {
      type: "object", additionalProperties: false,
      required: ["tiktok_script", "tiktok_caption_prompt", "youtube_shorts_script", "facebook_post", "pinterest_title", "pinterest_description", "linkedin_post", "quote_card_lines"],
      properties: {
        tiktok_script: { type: "string" },
        tiktok_caption_prompt: { type: "string" },
        youtube_shorts_script: { type: "string" },
        facebook_post: { type: "string" },
        pinterest_title: { type: "string" },
        pinterest_description: { type: "string" },
        linkedin_post: { type: "string" },
        quote_card_lines: { type: "array", minItems: 5, maxItems: 5, items: { type: "string" } }
      }
    },
    overall_reasoning: { type: "string" }
  }
};

const client = new OpenAI();
const response = await client.responses.create({
  model: process.env.GEMINI_TEXT_MODEL || "gemini-3.1-flash-lite",
  reasoning: { effort: "medium" },
  input: [
    {
      role: "system",
      content: `Use this measured Sapiver Forge TikTok evidence as a binding creative brief:\n${JSON.stringify(tiktokPerformance)}\nThe account receives test distribution, but viewers leave at roughly three seconds. Do not answer that evidence with another multi-story briefing, a presenter-only change, a vague question or a longer explanation. The next TikTok is a controlled single-discovery micro-explainer.`
    },
    {
      role: "system",
      content: "You are the Sapiver Forge Release Gate social editor. The only social audience for this test is freelancers and solo operators using AI for work that may reach a client. The only commercial product is the £19 Sapiver Forge AI Output Release Gate. Do not market AI governance, systems, gates as abstract concepts, or general AI news. Begin with the recognisable five seconds before someone sends, publishes or delivers AI-assisted work. The core question is: 'You've checked the AI output—but did you check the right things?' Use only facts already present in the supplied research pack. Never invent details, urgency, popularity or outcomes. Story indexes are zero-based."
    },
    {
      role: "user",
      content: `SAPIVER FORGE EDITION: ${DATE}\n\nVERIFIED RESEARCH PACK:\n${JSON.stringify(source)}${editionSpecificRules}\n\nEvaluate every story on audience specificity, practical consequence, searchability, usefulness to a stranger, novelty, visual potential, discussion potential and whether the payoff can be explained clearly in under 30 seconds. Return exactly one assessment per supplied story, in the same order, using zero-based story_index values 0 through ${stories.length - 1}.\n\nThen choose the best story separately for TikTok, YouTube Shorts, Facebook, Pinterest and LinkedIn. Different platforms may use different stories unless the edition-specific rules require one shared considered-question story. Every selected platform concept must score at least 7/10 for platform fit.\n\nWrite final social assets around those platform selections. Rules:\n- Never start with generic phrases such as 'AI news is noisy', 'today in AI', 'here is the latest AI news' or Sapiver Forge branding.\n- TikTok, YouTube Shorts, Facebook and LinkedIn must begin with a short direct question as the very first sentence. No statement, scene-setting, label or brand introduction may come before it. Prefer natural openings such as 'Can your...?', 'Would you...?', 'Which...?', 'What happens when...?' or 'How would you...?'.\n- Keep that opening question under 15 words. It must expose a practical problem, choice, risk or recognisable experience that the selected audience can answer.\n- After the hook, give a concise verified explanation that rewards attention before asking for engagement.\n- End each TikTok, YouTube Shorts, Facebook and LinkedIn asset with a clear prompt to action. First ask one specific, low-effort response question: offer two useful choices where natural, or ask for a concrete experience, test result or decision. Then invite the audience to put their answer in the comments, leave any questions, or suggest a related article Sapiver Forge should investigate next.\n- Vary the closing naturally between comment, question and follow-up-article invitations so posts do not repeat the same boilerplate. Use no more than two invitations in one asset.\n- Never use the generic question 'What do you think?'. The response prompt must invite genuine discussion, not agreement bait, manufactured controversy or unsupported fear.\n- TikTok: 35–55 spoken words and four compact beats: a question under 15 words, one verified fact, one practical personal consequence, then one easy either/or or concrete-experience comment prompt. Aim for 12–18 seconds when spoken. Use plain language and only one selected story.\n- YouTube Shorts: 80–150 spoken words, question-first searchable problem, clear answer and an easy comment prompt.\n- Facebook: question first, recognisable situation, useful explanation and a meaningful choice or experience prompt.\n- Pinterest: use a searchable question-led title when it reads naturally; otherwise use a practical guide or checklist title. The description must state the benefit and invite one specific action or response.\n- LinkedIn: question first, then a workplace decision, operational consequence or professional lesson, followed by a specific experience or choice prompt.\n- Quote lines must each be a complete useful thought, not a slogan. At least two should be usable as question-led conversation cards.\n- Keep Sapiver Forge calm, practical and human-led.\n- Do not add facts beyond the supplied verified pack.`
    },
    {
      role: "system",
      content: "Binding commercial override: assess stories only for whether they support a truthful pre-send lesson for freelancers or solo operators using AI for client-facing work. Relevant problems are invented sources, incorrect names or figures, unsupported claims, privacy leaks, unclear image rights, misleading context, wrong automated actions and polished work that is not safe to send. Use one problem per asset. If no source directly supports one, write a clearly hypothetical ordinary client-work example and do not imply that the source proves it. Every asset must teach one concrete check. Facebook, Pinterest and LinkedIn must end with https://payhip.com/b/vGks8. YouTube must invite viewers to the Sapiver Forge AI Output Release Gate through the description. TikTok must put 'Sapiver Forge AI Output Release Gate — link in bio' only in the separate caption prompt. Use ordinary customer language; never use AI governance, compliance framework, operational control or responsible-AI system. The product explanation is: reading AI work twice is not the same as knowing what to check."
    },
    {
      role: "system",
      content: "The TikTok format is exactly 18–30 spoken words and 8–12 seconds. Open with the pre-send situation, expose one hidden mistake or check, and stop. No roundup, brand line, sign-off or spoken sales pitch. The separate social.tiktok_caption_prompt must contain one natural response question followed by 'Sapiver Forge AI Output Release Gate — link in bio.'"
    }
  ],
  text: { format: { type: "json_schema", name: "sapiver_forge_audience_fit", strict: true, schema } }
});

if (!response.output_text) throw new Error("Gemini returned no audience-fit output.");
const result = JSON.parse(response.output_text);

function normaliseTitle(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function resolveStoryIndex(item) {
  const byTitle = stories.findIndex((story) => normaliseTitle(story.title) === normaliseTitle(item.story_title));
  if (byTitle >= 0) return byTitle;
  const raw = Number(item.story_index);
  if (Number.isInteger(raw) && raw >= 0 && raw < stories.length) return raw;
  if (Number.isInteger(raw) && raw >= 1 && raw <= stories.length) return raw - 1;
  return -1;
}

result.story_assessments = result.story_assessments.map((item) => ({
  ...item,
  story_index: resolveStoryIndex(item)
}));
for (const selection of Object.values(result.platform_selections)) {
  selection.story_index = resolveStoryIndex(selection);
}

const assessmentByIndex = new Map();
for (const item of result.story_assessments) {
  if (item.story_index < 0 || item.story_index >= stories.length) continue;
  if (!assessmentByIndex.has(item.story_index)) assessmentByIndex.set(item.story_index, item);
}
if (assessmentByIndex.size !== stories.length) {
  const missing = [];
  for (let i = 0; i < stories.length; i += 1) if (!assessmentByIndex.has(i)) missing.push(i);
  throw new Error(`Audience-fit response did not cover every story. Missing indexes: ${missing.join(", ")}`);
}
result.story_assessments = [...assessmentByIndex.entries()]
  .sort(([a], [b]) => a - b)
  .map(([, item]) => item);

for (const [platform, selection] of Object.entries(result.platform_selections)) {
  if (selection.story_index < 0 || selection.story_index >= stories.length) throw new Error(`${platform} selected an unavailable story`);
  selection.story_title = stories[selection.story_index].title;
  if (selection.platform_fit_score < 7) throw new Error(`${platform} platform fit below 7`);
}

const enriched = {
  ...source,
  social: result.social,
  audience_fit: {
    generated_at: new Date().toISOString(),
    story_assessments: result.story_assessments,
    platform_selections: result.platform_selections,
    overall_reasoning: result.overall_reasoning
  }
};
fs.writeFileSync(structuredPath, JSON.stringify(enriched, null, 2) + "\n", "utf8");
fs.writeFileSync(path.join(draftDir, "audience_fit_report.json"), JSON.stringify(enriched.audience_fit, null, 2) + "\n", "utf8");

const selectionLines = Object.entries(result.platform_selections).map(([platform, item]) =>
  `### ${platform[0].toUpperCase()}${platform.slice(1)}\n\n- Selected story: ${item.story_title}\n- Audience: ${item.target_audience}\n- Format: ${item.format}\n- Opening: ${item.opening}\n- Payoff: ${item.payoff}\n- Platform fit: ${item.platform_fit_score}/10\n- Why selected: ${item.selection_reason}`
).join("\n\n");
const assessmentLines = result.story_assessments.map((item) =>
  `### ${stories[item.story_index].title}\n\n- Audience: ${item.target_audience}\n- Interest signal: ${item.interest_signal}\n- Stop reason: ${item.stop_reason}\n- Payoff: ${item.promised_payoff}\n- Proof: ${item.proof_point}\n- Overall score: ${item.overall_score}/10\n- Reason: ${item.score_reason}`
).join("\n\n");
fs.writeFileSync(path.join(draftDir, "audience_fit_report.md"), `# Sapiver Forge Audience-Fit Report — ${DATE}\n\n## Story comparison\n\n${assessmentLines}\n\n## Platform selections\n\n${selectionLines}\n\n## Overall reasoning\n\n${result.overall_reasoning}\n`, "utf8");

const social = result.social;
const theme = source.editorial_theme ? `${source.editorial_theme.day} — ${source.editorial_theme.title}` : "Not specified";
fs.writeFileSync(path.join(draftDir, "social_pack.md"), `# Sapiver Forge Social Repurpose Pack — ${DATE}\n\nStatus: Draft — audience-fit optimised; automatic validation pending\n\nEditorial theme: ${theme}\n\n## Platform Story Selections\n\n${selectionLines}\n\n## TikTok Script\n\n${social.tiktok_script}\n\n## YouTube Shorts Script\n\n${social.youtube_shorts_script}\n\n## Facebook Post\n\n${social.facebook_post}\n\n## Pinterest Pin\n\n**Title:** ${social.pinterest_title}\n\n**Description:** ${social.pinterest_description}\n\n## LinkedIn-Style Post\n\n${social.linkedin_post}\n\n## 5 Short Quote/Card Lines\n\n${social.quote_card_lines.map((line) => `- ${line}`).join("\n")}\n`, "utf8");

console.log(`Audience-fit optimisation completed for ${DATE}.`);
