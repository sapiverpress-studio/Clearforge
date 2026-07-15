import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";

const ROOT = process.cwd();
const DATE = process.env.CLEARFORGE_DATE || new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());
const draftDir = path.join(ROOT, "drafts", DATE);
const structuredPath = path.join(draftDir, "structured_output.json");

if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required.");
if (!fs.existsSync(structuredPath)) throw new Error(`Missing ${structuredPath}`);

const sourceData = JSON.parse(fs.readFileSync(structuredPath, "utf8"));
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const model = process.env.OPENAI_MODEL || "gpt-5.4-mini";

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["feature_headline", "feature_dek", "feature_markdown", "seo_description", "tags", "primary_story_index", "editorial_angle"],
  properties: {
    feature_headline: { type: "string" },
    feature_dek: { type: "string" },
    feature_markdown: { type: "string" },
    seo_description: { type: "string" },
    tags: { type: "array", minItems: 3, maxItems: 4, items: { type: "string" } },
    primary_story_index: { type: "integer", minimum: 0, maximum: 4 },
    editorial_angle: { type: "string" }
  }
};

const response = await client.responses.create({
  model,
  reasoning: { effort: "medium" },
  input: [
    {
      role: "system",
      content: "You are the Clearforge long-form features editor. Turn a verified daily AI-news research pack into an original, deeply useful feature. Never invent facts. Distinguish sourced fact from analysis. Do not copy source wording."
    },
    {
      role: "user",
      content: `DATE: ${DATE}\n\nSOURCE RESEARCH PACK:\n${JSON.stringify(sourceData)}\n\nWrite one 1,500–2,500 word feature piece. Choose the strongest unifying angle, not a listicle recap. Requirements:\n- Open with a strong scene, tension, or practical problem.\n- Explain the wider context and why this cluster of developments matters now.\n- Use the strongest story as the spine and weave the other stories in where relevant.\n- Include concrete implications for creators, small businesses, knowledge workers, and AI learners.\n- Include a section on limits, uncertainty, or counterarguments.\n- Include a practical 'What to do next' section.\n- End with a concise conclusion, not hype.\n- Add a final heading written exactly as '## Sources' followed by Markdown links using only URLs from the research pack.\n- Use clear ## section headings.\n- Do not mention being AI-generated.\n- Do not claim the piece is independent reporting; it is analysis based on cited sources.`
    }
  ],
  text: {
    format: {
      type: "json_schema",
      name: "clearforge_full_feature",
      strict: true,
      schema
    }
  }
});

if (!response.output_text) throw new Error("OpenAI returned no full feature output.");
const feature = JSON.parse(response.output_text);
let body = feature.feature_markdown.trim();

// Structured generation can occasionally omit or rename the final source heading.
// Add a deterministic canonical section so validation and readers always receive it.
if (!/^##\s+Sources\s*$/im.test(body)) {
  const sourceLines = (sourceData.sources || [])
    .filter((source) => source?.url)
    .map((source) => `- [${source.title || source.source_name || source.url}](${source.url})`)
    .join("\n");
  body = `${body}\n\n## Sources\n\n${sourceLines || "- Sources are listed in the accompanying research pack."}`;
}

const markdown = `# ${feature.feature_headline}\n\n${feature.feature_dek}\n\n${body}\n`;

fs.writeFileSync(path.join(draftDir, "feature.md"), markdown, "utf8");
fs.writeFileSync(path.join(draftDir, "feature.json"), JSON.stringify({ ...feature, feature_markdown: body }, null, 2) + "\n", "utf8");
console.log(`Generated Clearforge full feature for ${DATE}`);
