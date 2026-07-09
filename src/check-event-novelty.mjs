import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";

const ROOT = process.cwd();
const DATE = process.env.CLEARFORGE_DATE || new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());
const draftDir = path.join(ROOT, "drafts", DATE);
const runsDir = path.join(draftDir, "runs");
const currentPath = path.join(draftDir, "structured_output.json");
const reportPath = path.join(draftDir, "event_novelty_report.json");

if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required for event novelty checking.");
if (!fs.existsSync(currentPath)) throw new Error(`Missing ${currentPath}`);

const current = JSON.parse(fs.readFileSync(currentPath, "utf8"));
const priorRuns = [];

if (fs.existsSync(runsDir)) {
  for (const runName of fs.readdirSync(runsDir).sort()) {
    const file = path.join(runsDir, runName, "structured_output.json");
    if (!fs.existsSync(file)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(file, "utf8"));
      priorRuns.push({ run_name: runName, data });
    } catch {}
  }
}

if (!priorRuns.length) {
  fs.writeFileSync(reportPath, JSON.stringify({
    date: DATE,
    passed: true,
    prior_run_count: 0,
    duplicate_events: [],
    note: "No earlier same-day run exists."
  }, null, 2) + "\n");
  console.log("Event novelty passed: no earlier same-day run exists.");
  process.exit(0);
}

const priorStories = priorRuns.flatMap((run) => (run.data.story_summaries || []).map((story, index) => ({
  run_name: run.run_name,
  story_index: index,
  title: story.title,
  summary: story.summary,
  why_it_matters: story.why_it_matters,
  practical_angle: story.practical_angle,
  sources: (run.data.sources || []).map((s) => ({ source_name: s.source_name, title: s.title, url: s.url }))
})));

const currentStories = (current.story_summaries || []).map((story, index) => ({
  story_index: index,
  title: story.title,
  summary: story.summary,
  why_it_matters: story.why_it_matters,
  practical_angle: story.practical_angle,
  sources: (current.sources || []).map((s) => ({ source_name: s.source_name, title: s.title, url: s.url }))
}));

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["comparisons", "duplicate_events", "overall_pass"],
  properties: {
    comparisons: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["current_story_index", "prior_story_title", "same_underlying_event", "confidence", "reason"],
        properties: {
          current_story_index: { type: "integer", minimum: 0 },
          prior_story_title: { type: "string" },
          same_underlying_event: { type: "boolean" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          reason: { type: "string" }
        }
      }
    },
    duplicate_events: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["current_story_index", "current_story_title", "prior_story_title", "confidence", "reason"],
        properties: {
          current_story_index: { type: "integer", minimum: 0 },
          current_story_title: { type: "string" },
          prior_story_title: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          reason: { type: "string" }
        }
      }
    },
    overall_pass: { type: "boolean" }
  }
};

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const model = process.env.OPENAI_MODEL || "gpt-5.4-mini";
const response = await client.responses.create({
  model,
  reasoning: { effort: "medium" },
  input: [
    {
      role: "system",
      content: "You are a strict news-event deduplication editor. Decide whether a new story and a prior story concern the same underlying real-world event, announcement, launch, model release, policy action, research result, partnership, funding event, safety change, outage, or company decision. Ignore headline wording and publisher differences. A follow-up with genuinely new facts may be distinct only when the new development materially changes what happened."
    },
    {
      role: "user",
      content: `DATE: ${DATE}\n\nNEW STORIES:\n${JSON.stringify(currentStories)}\n\nEARLIER SAME-DAY STORIES:\n${JSON.stringify(priorStories)}\n\nCompare every new story against the earlier same-day set. Mark same_underlying_event=true whenever the core event is the same even if:\n- the headline is completely different,\n- a different publisher reports it,\n- one story focuses on business impact and another on technical details,\n- one source is primary and another secondary,\n- the article uses different product/model/company wording.\n\nTreat a story as distinct only when the underlying event is genuinely different. Put all duplicate matches with confidence >= 0.75 into duplicate_events. overall_pass must be false when duplicate_events is non-empty.`
    }
  ],
  text: {
    format: {
      type: "json_schema",
      name: "clearforge_event_novelty_check",
      strict: true,
      schema
    }
  }
});

if (!response.output_text) throw new Error("OpenAI returned no event novelty result.");
const result = JSON.parse(response.output_text);
const duplicates = (result.duplicate_events || []).filter((item) => item.confidence >= 0.75);
const passed = duplicates.length === 0 && result.overall_pass === true;

const report = {
  date: DATE,
  passed,
  prior_run_count: priorRuns.length,
  current_story_count: currentStories.length,
  prior_story_count: priorStories.length,
  duplicate_events: duplicates,
  comparisons: result.comparisons || []
};
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");

if (!passed) {
  const summary = duplicates.map((d) => `${d.current_story_title} ~= ${d.prior_story_title} (${d.confidence})`).join("; ");
  throw new Error(`Event novelty failed: ${summary || "model marked overall_pass false"}`);
}

console.log(`Event novelty passed against ${priorStories.length} earlier same-day stories.`);
