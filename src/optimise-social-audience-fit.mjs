import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";

const ROOT = process.cwd();
const DATE = process.env.CLEARFORGE_DATE || new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());
const draftDir = path.join(ROOT, "drafts", DATE);
const structuredPath = path.join(draftDir, "structured_output.json");
const performancePath = path.join(ROOT, "config", "tiktok-performance.json");

if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required for audience-fit optimisation.");
if (!fs.existsSync(structuredPath)) throw new Error(`Missing ${structuredPath}`);

const source = JSON.parse(fs.readFileSync(structuredPath, "utf8"));
const TARGET_AUDIENCE = "Freelancers and solo operators using AI for client-facing or public work";
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
        required: ["story_index", "story_title", "target_audience", "audience_problem_or_desire", "interest_signal", "stop_reason", "promised_payoff", "proof_point", "search_phrases", "scores", "overall_score", "score_reason", "release_gate_relevance_score", "release_gate_problem_signal", "release_gate_cta_eligible", "release_gate_reason"],
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
          score_reason: { type: "string" },
          release_gate_relevance_score: { type: "integer", minimum: 0, maximum: 10 },
          release_gate_problem_signal: { type: "string", enum: ["none", "facts_or_citations", "disclosure_or_provenance", "privacy_or_confidentiality", "rights_or_ownership", "handoff_or_human_approval", "connected_tool_error"] },
          release_gate_cta_eligible: { type: "boolean" },
          release_gate_reason: { type: "string" }
        }
      }
    },
    platform_selections: {
      type: "object", additionalProperties: false,
      required: ["tiktok", "youtube", "facebook", "pinterest", "linkedin"],
      properties: Object.fromEntries(["tiktok", "youtube", "facebook", "pinterest", "linkedin"].map((platform) => [platform, {
        type: "object", additionalProperties: false,
        required: ["story_index", "story_title", "target_audience", "format", "opening", "payoff", "selection_reason", "platform_fit_score", "release_gate_cta_strength"],
        properties: {
          story_index: { type: "integer", minimum: 0, maximum: 4 },
          story_title: { type: "string" },
          target_audience: { type: "string" },
          format: { type: "string" },
          opening: { type: "string" },
          payoff: { type: "string" },
          selection_reason: { type: "string" },
          platform_fit_score: { type: "integer", minimum: 7, maximum: 10 },
          release_gate_cta_strength: { type: "string", enum: ["none", "soft", "direct"] }
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

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const response = await client.responses.create({
  model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
  reasoning: { effort: "medium" },
  input: [
    {
      role: "system",
      content: `Use this measured Clearforge TikTok evidence as a binding creative brief:\n${JSON.stringify(tiktokPerformance)}\nThe account receives test distribution, but viewers leave at roughly three seconds. Do not answer that evidence with another multi-story briefing, a presenter-only change, a vague question or a longer explanation. The next TikTok is a controlled single-discovery micro-explainer.`
    },
    {
      role: "system",
      content: `You are the Clearforge audience-fit editor. Treat social feeds as interest graphs. The fixed audience is: ${TARGET_AUDIENCE}. Do not broaden this to businesses, AI users, teams or creators generally. Assess every verified story before selecting content. Choose the strongest story independently for each platform; do not force one lead story everywhere. Social assets must earn attention without clickbait: begin with that audience or a recognisable client-work situation, state one consequence, teach one simple check, then offer an appropriate next step. Do not force every post to begin with a question. Use only facts already present in the supplied research pack. Never invent details, urgency, popularity or outcomes. Story indexes are zero-based: the first story is 0, the second is 1, and so on. Write for AI novices. Keep specialist evidence and legal labels in the internal assessment, but translate public copy into ordinary language. The Clearforge AI Output Release Gate is the current flagship under validation. Score its relevance separately from general audience interest. A story is directly eligible only when verified evidence concerns unchecked facts or citations, disclosure or provenance, privacy or confidentiality, rights or ownership, connected-tool errors, or missing handoff and human approval. Product relevance is Clearforge interpretation, never a sourced fact.`
    },
    {
      role: "user",
      content: `CLEARFORGE EDITION: ${DATE}\n\nVERIFIED RESEARCH PACK:\n${JSON.stringify(source)}${editionSpecificRules}\n\nEvaluate every story on audience specificity, practical consequence, searchability, usefulness to a stranger, novelty, visual potential, discussion potential and whether the payoff can be explained clearly in under 30 seconds. Return exactly one assessment per supplied story, in the same order, using zero-based story_index values 0 through ${stories.length - 1}.\n\nThen choose the best story separately for TikTok, YouTube Shorts, Facebook, Pinterest and LinkedIn. Different platforms may use different stories unless the edition-specific rules require one shared considered-question story. Every selected platform concept must score at least 7/10 for platform fit.\n\nWrite final social assets around those platform selections. Apply the Rule of One to every asset: one audience, one familiar situation, one problem or change, one useful check and one appropriate next step.\n\nPublic-language rules:\n- Write for a novice who uses a familiar AI tool but may not know there is a release problem yet.\n- Never start with generic phrases such as 'AI news is noisy', 'today in AI', 'here is the latest AI news' or Clearforge branding.\n- Open naturally with a recognisable situation, consequence, short question or useful warning. Do not force every post to begin with a question.\n- Make the first sentence understandable without hashtags, prior Clearforge knowledge or specialist AI language.\n- Explain what the reader needs to know, why it may affect their work and the one simple thing they should check.\n- Keep source verification and legal-status distinctions in the internal evidence. Public copy may briefly name the source but must not sound like a research report or compliance notice.\n- Do not use unexplained terms such as governance, provenance, audit trail, human-in-the-loop or regulatory development. Translate them accurately into ordinary language.\n- Never give legal advice or imply that a proposal, regulator statement, voluntary code or platform policy is law.\n- Use a save CTA when teaching a check that will be useful later. Use one simple response question when gathering real experience. Use a direct product CTA only when the evidence clearly shows a pre-send or pre-publication checking problem.\n- Do not use the generic question 'What do you think?' or ask for engagement merely to create comments.\n- TikTok: one situation, one useful fact and one immediate check, in plain language.\n- YouTube Shorts: one problem explained clearly, one practical check and one natural next step.\n- Facebook: sound like a helpful person explaining one issue to another person.\n- Pinterest: use a searchable practical check, guide or answer.\n- LinkedIn: use plain workplace language and one operational lesson.\n- Quote lines must each carry one complete useful idea, not a slogan.\n- Keep Clearforge calm, practical and human-led.\n- Do not add facts beyond the supplied verified pack.`
    },
    {
      role: "system",
      content: "Set release_gate_cta_strength independently for each platform. Use direct only when the selected story has release_gate_relevance_score of at least 8, release_gate_cta_eligible is true and the reader has been shown a clear pre-send or pre-publication problem. A direct CTA must naturally say that the Clearforge AI Output Release Gate is linked in the bio. Use soft for a useful check, normally inviting the reader to save it for later, without naming or linking the product. Use none for unrelated stories. Never add a product CTA to meet a quota or merely because a story mentions AI, work, risk or regulation."
    },
    {
      role: "system",
      content: `Override any longer TikTok instruction above. The measured test format is exactly 18–30 spoken words and 8–12 seconds, covering one story for ${TARGET_AUDIENCE}. The opening sentence must explicitly identify a freelancer, client work, client-facing work or sending work to a client. State a meaningful consequence immediately. Give one supported fact in ordinary language and one check the viewer can use now. Never say "AI updates", "three updates", "today in AI" or "latest AI news". No roundup, spoken brand line, sign-off or spoken engagement request. Return one short, story-specific, low-effort response question separately in social.tiktok_caption_prompt.`
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
  selection.target_audience = TARGET_AUDIENCE;
  if (selection.platform_fit_score < 7) throw new Error(`${platform} platform fit below 7`);
  const assessment = assessmentByIndex.get(selection.story_index);
  if (selection.release_gate_cta_strength === "direct" && (!assessment.release_gate_cta_eligible || assessment.release_gate_relevance_score < 8)) {
    throw new Error(`${platform} used a direct Release Gate CTA without strong, eligible evidence`);
  }
}

const tiktokScript = String(result.social.tiktok_script || "").replace(/\s+/g, " ").trim();
const tiktokOpening = tiktokScript.split(/(?<=[.!?])\s+/)[0] || "";
const tiktokWordCount = tiktokScript.split(/\s+/).filter(Boolean).length;
if (tiktokWordCount < 18 || tiktokWordCount > 30) {
  throw new Error(`TikTok script must contain 18–30 spoken words; received ${tiktokWordCount}.`);
}
if (!/\b(freelanc\w*|client(?:-facing)? work|work (?:for|to) (?:a |your )?client|send(?:ing)? .* client)\b/i.test(tiktokOpening)) {
  throw new Error("TikTok opening does not identify the fixed freelancer/client-work audience.");
}
if (/\b(?:three|four|five|\d+)\s+(?:ai\s+)?updates?\b|today in ai|latest ai news|ai updates? that (?:actually )?matter/i.test(tiktokOpening)) {
  throw new Error("TikTok opening repeats the failed generic update format.");
}
if (!/\b(check|verify|confirm|compare|review|keep|remove|record|open|read|stop|pause|ask|decide|label|mark|ensure|inspect|test)\b|make sure|look for|double[- ]check/i.test(tiktokScript)) {
  throw new Error("TikTok script does not give the audience one immediate practical check.");
}

const platformContent = {
  tiktok: `${result.social.tiktok_script} ${result.social.tiktok_caption_prompt}`,
  youtube: result.social.youtube_shorts_script,
  facebook: result.social.facebook_post,
  pinterest: `${result.social.pinterest_title} ${result.social.pinterest_description}`,
  linkedin: result.social.linkedin_post
};
for (const [platform, selection] of Object.entries(result.platform_selections)) {
  const hasDirectCta = /link(?:ed)? in (?:the|my|our) bio|payhip\.com\/b\/vgks8/i.test(platformContent[platform]);
  if (selection.release_gate_cta_strength === "direct" && !hasDirectCta) {
    console.warn(`${platform} was marked direct without product wording; downgrading to a soft educational CTA.`);
    selection.release_gate_cta_strength = "soft";
  }
  if (selection.release_gate_cta_strength !== "direct" && hasDirectCta) {
    throw new Error(`${platform} included a direct Release Gate CTA without direct eligibility`);
  }
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
  `### ${platform[0].toUpperCase()}${platform.slice(1)}\n\n- Selected story: ${item.story_title}\n- Audience: ${item.target_audience}\n- Format: ${item.format}\n- Opening: ${item.opening}\n- Payoff: ${item.payoff}\n- Platform fit: ${item.platform_fit_score}/10\n- Release Gate CTA: ${item.release_gate_cta_strength}\n- Why selected: ${item.selection_reason}`
).join("\n\n");
const assessmentLines = result.story_assessments.map((item) =>
  `### ${stories[item.story_index].title}\n\n- Audience: ${item.target_audience}\n- Interest signal: ${item.interest_signal}\n- Stop reason: ${item.stop_reason}\n- Payoff: ${item.promised_payoff}\n- Proof: ${item.proof_point}\n- Overall score: ${item.overall_score}/10\n- Release Gate relevance: ${item.release_gate_relevance_score}/10 (${item.release_gate_problem_signal})\n- Direct CTA eligible: ${item.release_gate_cta_eligible ? "yes" : "no"}\n- Release Gate reasoning: ${item.release_gate_reason}\n- Reason: ${item.score_reason}`
).join("\n\n");
fs.writeFileSync(path.join(draftDir, "audience_fit_report.md"), `# Clearforge Audience-Fit Report — ${DATE}\n\n## Story comparison\n\n${assessmentLines}\n\n## Platform selections\n\n${selectionLines}\n\n## Overall reasoning\n\n${result.overall_reasoning}\n`, "utf8");

const social = result.social;
const theme = source.editorial_theme ? `${source.editorial_theme.day} — ${source.editorial_theme.title}` : "Not specified";
fs.writeFileSync(path.join(draftDir, "social_pack.md"), `# Clearforge Social Repurpose Pack — ${DATE}\n\nStatus: Draft — audience-fit optimised; automatic validation pending\n\nEditorial theme: ${theme}\n\n## Platform Story Selections\n\n${selectionLines}\n\n## TikTok Script\n\n${social.tiktok_script}\n\n## YouTube Shorts Script\n\n${social.youtube_shorts_script}\n\n## Facebook Post\n\n${social.facebook_post}\n\n## Pinterest Pin\n\n**Title:** ${social.pinterest_title}\n\n**Description:** ${social.pinterest_description}\n\n## LinkedIn-Style Post\n\n${social.linkedin_post}\n\n## 5 Short Quote/Card Lines\n\n${social.quote_card_lines.map((line) => `- ${line}`).join("\n")}\n`, "utf8");

console.log(`Audience-fit optimisation completed for ${DATE}.`);
