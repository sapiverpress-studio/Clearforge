import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";

const ROOT = process.cwd();
const today = new Date().toISOString().slice(0, 10);
const outDir = path.join(ROOT, "drafts", today);
const configPath = path.join(ROOT, "config", "sources.json");
const promptPath = path.join(ROOT, "prompts", "daily_ai_brief_prompt.md");
const approvalPath = path.join(outDir, "approval.json");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function write(file, content) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, content.endsWith("\n") ? content : `${content}\n`, "utf8");
}

function domainFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function preserveOrCreateApproval() {
  if (fs.existsSync(approvalPath)) return;
  write(approvalPath, JSON.stringify({
    date: today,
    article_approved: false,
    facebook_approved: false,
    pinterest_approved: false,
    youtube_approved: false,
    notes: "Human review required before any publication step."
  }, null, 2));
}

function renderBrief(data) {
  const sourceLines = data.sources.map((s, i) =>
    `${i + 1}. [${s.title}](${s.url}) — ${s.source_name} (${s.published_date})\n   - Confirmed: ${s.confirmed_fact}\n   - Interpretation: ${s.interpretation}`
  ).join("\n\n");

  const summaries = data.story_summaries.map((s) =>
    `### ${s.title}\n\n${s.summary}\n\n**Why it matters:** ${s.why_it_matters}\n\n**Practical angle:** ${s.practical_angle}\n\n**Claim to verify:** ${s.claim_to_verify}`
  ).join("\n\n");

  return `# ${data.headline}\n\nStatus: Draft — human review required\n\n${data.dek}\n\n## Source List\n\n${sourceLines}\n\n## Story Summaries\n\n${summaries}\n\n## Main Article\n\n${data.main_article}\n\n## Practical Takeaway\n\n${data.practical_takeaway}\n\n## What To Test Next\n\n${data.what_to_test_next}\n\n## Claims To Verify Before Publishing\n\n${data.claims_to_verify.map((x) => `- ${x}`).join("\n")}\n`;
}

function renderSocial(data) {
  return `# Clearforge Social Repurpose Pack — ${today}\n\nStatus: Draft — use only after article review\n\n## TikTok Script\n\n${data.social.tiktok_script}\n\n## YouTube Shorts Script\n\n${data.social.youtube_shorts_script}\n\n## Facebook Post\n\n${data.social.facebook_post}\n\n## Pinterest Pin\n\n**Title:** ${data.social.pinterest_title}\n\n**Description:** ${data.social.pinterest_description}\n\n## LinkedIn-Style Post\n\n${data.social.linkedin_post}\n\n## 5 Short Quote/Card Lines\n\n${data.social.quote_card_lines.map((x) => `- ${x}`).join("\n")}\n\n## Suggested Headlines\n\n${data.headline_options.map((x) => `- ${x}`).join("\n")}\n`;
}

const schema = {
  type: "object",
  additionalProperties: false,
  required: [
    "headline", "dek", "sources", "story_summaries", "main_article",
    "practical_takeaway", "what_to_test_next", "claims_to_verify",
    "social", "headline_options"
  ],
  properties: {
    headline: { type: "string" },
    dek: { type: "string" },
    sources: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["source_name", "title", "url", "published_date", "confirmed_fact", "interpretation"],
        properties: {
          source_name: { type: "string" },
          title: { type: "string" },
          url: { type: "string" },
          published_date: { type: "string" },
          confirmed_fact: { type: "string" },
          interpretation: { type: "string" }
        }
      }
    },
    story_summaries: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "summary", "why_it_matters", "practical_angle", "claim_to_verify"],
        properties: {
          title: { type: "string" },
          summary: { type: "string" },
          why_it_matters: { type: "string" },
          practical_angle: { type: "string" },
          claim_to_verify: { type: "string" }
        }
      }
    },
    main_article: { type: "string" },
    practical_takeaway: { type: "string" },
    what_to_test_next: { type: "string" },
    claims_to_verify: { type: "array", items: { type: "string" } },
    social: {
      type: "object",
      additionalProperties: false,
      required: [
        "tiktok_script", "youtube_shorts_script", "facebook_post",
        "pinterest_title", "pinterest_description", "linkedin_post", "quote_card_lines"
      ],
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
    headline_options: { type: "array", minItems: 5, maxItems: 5, items: { type: "string" } }
  }
};

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for automated daily research.");
  }

  ensureDir(outDir);
  preserveOrCreateApproval();

  const config = readJson(configPath);
  const allowedDomains = config.sources.map((s) => domainFromUrl(s.url)).filter(Boolean);
  const prompt = fs.readFileSync(promptPath, "utf8");

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL || "gpt-5.4-mini";

  const response = await client.responses.create({
    model,
    reasoning: { effort: "low" },
    tools: [{
      type: "web_search",
      filters: { allowed_domains: allowedDomains },
      user_location: { type: "approximate", country: "GB", city: "London" }
    }],
    include: ["web_search_call.action.sources"],
    input: [
      {
        role: "system",
        content: "You are the Clearforge Daily AI Brief Builder. Research first. Use only allowed reputable domains. Distinguish confirmed facts from interpretation. Never copy article wording. Never present a draft as published."
      },
      {
        role: "user",
        content: `${prompt}\n\nTODAY: ${today}\n\nResearch the most useful AI developments from roughly the last 36 hours. Select 3 to 5 distinct stories, remove duplicates, prefer primary sources, and only include older stories when there is a clear new development today. The main article must be 700 to 1000 words and practical for creators, small businesses, and AI learners.`
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "clearforge_daily_brief",
        strict: true,
        schema
      }
    }
  });

  if (!response.output_text) throw new Error("OpenAI returned no structured output.");
  const data = JSON.parse(response.output_text);

  write(path.join(outDir, "daily_brief.md"), renderBrief(data));
  write(path.join(outDir, "social_pack.md"), renderSocial(data));
  write(path.join(outDir, "sources.json"), JSON.stringify(data.sources, null, 2));
  write(path.join(outDir, "structured_output.json"), JSON.stringify(data, null, 2));
  write(path.join(outDir, "claims_to_verify.md"), `# Claims To Verify — ${today}\n\n${data.claims_to_verify.map((x) => `- [ ] ${x}`).join("\n")}\n`);
  write(path.join(outDir, "editor_checklist.md"), `# Clearforge Editor Checklist — ${today}\n\n- [ ] Open every source link.\n- [ ] Check publication dates.\n- [ ] Confirm facts against source wording.\n- [ ] Keep interpretation labelled.\n- [ ] Check article is 700–1,000 words.\n- [ ] Check no copied wording.\n- [ ] Check no unsupported claims.\n- [ ] Check no medical/legal/financial advice.\n- [ ] Check social outputs match the article.\n- [ ] Set approval flags only after review.\n`);

  console.log(`Clearforge daily draft created in drafts/${today}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
