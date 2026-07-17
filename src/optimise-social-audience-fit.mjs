import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";

const ROOT = process.cwd();
const DATE = process.env.CLEARFORGE_DATE || new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());
const draftDir = path.join(ROOT, "drafts", DATE);
const structuredPath = path.join(draftDir, "structured_output.json");

if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required for audience-fit optimisation.");
if (!fs.existsSync(structuredPath)) throw new Error(`Missing ${structuredPath}`);

const source = JSON.parse(fs.readFileSync(structuredPath, "utf8"));
const stories = Array.isArray(source.story_summaries) ? source.story_summaries : [];
if (stories.length < 3) throw new Error("Audience-fit optimisation needs at least three verified stories.");

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
      required: ["tiktok_script", "youtube_shorts_script", "facebook_post", "pinterest_title", "pinterest_description", "linkedin_post", "quote_card_lines"],
      properties: {
        tiktok_script: { type: "string" },
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

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const response = await client.responses.create({
  model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
  reasoning: { effort: "medium" },
  input: [
    {
      role: "system",
      content: "You are the Clearforge audience-fit editor. Treat social feeds as interest graphs. Assess every verified story before selecting content. Choose the strongest story independently for each platform; do not force one lead story everywhere. Social assets must provoke a useful response without clickbait: lead with a direct, natural question, give concise verified value, then make replying easy. Use only facts already present in the supplied research pack. Never invent details, urgency, popularity or outcomes. Story indexes are zero-based: the first story is 0, the second is 1, and so on."
    },
    {
      role: "user",
      content: `CLEARFORGE EDITION: ${DATE}\n\nVERIFIED RESEARCH PACK:\n${JSON.stringify(source)}\n\nEvaluate every story on audience specificity, practical consequence, searchability, usefulness to a stranger, novelty, visual potential, discussion potential and whether the payoff can be explained clearly in under 30 seconds. Return exactly one assessment per supplied story, in the same order, using zero-based story_index values 0 through ${stories.length - 1}.\n\nThen choose the best story separately for TikTok, YouTube Shorts, Facebook, Pinterest and LinkedIn. Different platforms may use different stories. Every selected platform concept must score at least 7/10 for platform fit.\n\nWrite final social assets around those platform selections. Rules:\n- Never start with generic phrases such as 'AI news is noisy', 'today in AI', 'here is the latest AI news' or Clearforge branding.\n- TikTok, YouTube Shorts, Facebook and LinkedIn must begin with a short direct question as the very first sentence. No statement, scene-setting, label or brand introduction may come before it. Prefer natural openings such as 'Can your...?', 'Would you...?', 'Which...?', 'What happens when...?' or 'How would you...?'.\n- Keep that opening question under 15 words. It must expose a practical problem, choice, risk or recognisable experience that the selected audience can answer.\n- After the hook, give a concise verified explanation that rewards attention before asking for engagement.\n- End each TikTok, YouTube Shorts, Facebook and LinkedIn asset with a clear prompt to action. First ask one specific, low-effort response question: offer two useful choices where natural, or ask for a concrete experience, test result or decision. Then invite the audience to put their answer in the comments, leave any questions, or suggest a related article Clearforge should investigate next.\n- Vary the closing naturally between comment, question and follow-up-article invitations so posts do not repeat the same boilerplate. Use no more than two invitations in one asset.\n- Never use the generic question 'What do you think?'. The response prompt must invite genuine discussion, not agreement bait, manufactured controversy or unsupported fear.\n- TikTok: 70–130 spoken words, one strong stop reason, one payoff and an easy comment prompt.\n- YouTube Shorts: 80–150 spoken words, question-first searchable problem, clear answer and an easy comment prompt.\n- Facebook: question first, recognisable situation, useful explanation and a meaningful choice or experience prompt.\n- Pinterest: use a searchable question-led title when it reads naturally; otherwise use a practical guide or checklist title. The description must state the benefit and invite one specific action or response.\n- LinkedIn: question first, then a workplace decision, operational consequence or professional lesson, followed by a specific experience or choice prompt.\n- Quote lines must each be a complete useful thought, not a slogan. At least two should be usable as question-led conversation cards.\n- Keep Clearforge calm, practical and human-led.\n- Do not add facts beyond the supplied verified pack.`
    }
  ],
  text: { format: { type: "json_schema", name: "clearforge_audience_fit", strict: true, schema } }
});

if (!response.output_text) throw new Error("OpenAI returned no audience-fit output.");
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
fs.writeFileSync(path.join(draftDir, "audience_fit_report.md"), `# Clearforge Audience-Fit Report — ${DATE}\n\n## Story comparison\n\n${assessmentLines}\n\n## Platform selections\n\n${selectionLines}\n\n## Overall reasoning\n\n${result.overall_reasoning}\n`, "utf8");

const social = result.social;
const theme = source.editorial_theme ? `${source.editorial_theme.day} — ${source.editorial_theme.title}` : "Not specified";
fs.writeFileSync(path.join(draftDir, "social_pack.md"), `# Clearforge Social Repurpose Pack — ${DATE}\n\nStatus: Draft — audience-fit optimised; automatic validation pending\n\nEditorial theme: ${theme}\n\n## Platform Story Selections\n\n${selectionLines}\n\n## TikTok Script\n\n${social.tiktok_script}\n\n## YouTube Shorts Script\n\n${social.youtube_shorts_script}\n\n## Facebook Post\n\n${social.facebook_post}\n\n## Pinterest Pin\n\n**Title:** ${social.pinterest_title}\n\n**Description:** ${social.pinterest_description}\n\n## LinkedIn-Style Post\n\n${social.linkedin_post}\n\n## 5 Short Quote/Card Lines\n\n${social.quote_card_lines.map((line) => `- ${line}`).join("\n")}\n`, "utf8");

console.log(`Audience-fit optimisation completed for ${DATE}.`);
