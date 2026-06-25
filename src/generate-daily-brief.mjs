import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";

const ROOT = process.cwd();
const today = new Date().toISOString().slice(0, 10);
const outDir = path.join(ROOT, "drafts", today);
const manualSourcesPath = path.join(ROOT, "inputs", `${today}-sources.md`);
const promptPath = path.join(ROOT, "prompts", "daily_ai_brief_prompt.md");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readIfExists(filePath, fallback = "") {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : fallback;
}

function write(fileName, content) {
  fs.writeFileSync(path.join(outDir, fileName), content.trim() + "\n", "utf8");
}

function buildFallbackDraft() {
  return `# Clearforge Daily AI Brief — ${today}

Status: Draft — sources needed

## Source List

Add 3 to 5 reputable AI source links to inputs/${today}-sources.md, then run:

\`npm run draft\`

## Story Summaries

No source links were supplied yet.

## Main Article

Draft not generated. Add source links first.

## Practical Takeaway

The workflow is installed. The next move is to test it with real source links.

## What To Test Next

1. Create inputs/${today}-sources.md.
2. Add 3 to 5 AI news links with short notes.
3. Run npm run draft.
4. Review the output in drafts/${today}/.

## Claims To Verify Before Publishing

- No claims yet.

## Human Review

Approved: false
`;
}

function buildSocialFallback() {
  return `# Clearforge Social Pack — ${today}

Status: Draft — waiting for approved article.

## TikTok Script

Not generated yet.

## YouTube Shorts Script

Not generated yet.

## Facebook Post

Not generated yet.

## Pinterest Pin

Not generated yet.

## LinkedIn-Style Post

Not generated yet.

## 5 Short Quote/Card Lines

Not generated yet.
`;
}

function buildChecklist() {
  return `# Clearforge Editor Checklist — ${today}

Before publishing, confirm:

- [ ] Source links open correctly.
- [ ] Source dates are checked.
- [ ] Confirmed facts are separated from interpretation.
- [ ] No copied source wording.
- [ ] No unsupported claims.
- [ ] No AI hype or fear framing.
- [ ] No medical/legal/financial advice.
- [ ] Article has practical takeaway.
- [ ] What-to-test-next section is specific.
- [ ] Social posts match the approved article.
- [ ] Human reviewer approved publication.
`;
}

function buildApprovalFile() {
  return JSON.stringify({
    date: today,
    article_approved: false,
    facebook_approved: false,
    pinterest_approved: false,
    youtube_approved: false,
    notes: "Set approval flags manually after human review. Publishing scripts must refuse to run unless the relevant flag is true."
  }, null, 2);
}

async function generateWithOpenAI(sourceNotes) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const prompt = readIfExists(promptPath);
  const client = new OpenAI({ apiKey });

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content: "You create Clearforge draft content only. Do not claim anything is published. Do not copy wording from sources. Keep facts and interpretation separate."
      },
      {
        role: "user",
        content: `${prompt}\n\nSOURCE LINKS AND NOTES:\n${sourceNotes}`
      }
    ]
  });

  return response.output_text || null;
}

async function main() {
  ensureDir(outDir);
  ensureDir(path.join(ROOT, "inputs"));
  ensureDir(path.join(ROOT, "approval"));

  const sourceNotes = readIfExists(manualSourcesPath).trim();

  write("editor_checklist.md", buildChecklist());
  write("approval.json", buildApprovalFile());

  if (!sourceNotes) {
    write("daily_brief.md", buildFallbackDraft());
    write("social_pack.md", buildSocialFallback());
    write("sources.json", JSON.stringify({ date: today, sources_supplied: false, path_expected: `inputs/${today}-sources.md` }, null, 2));
    console.log(`Created fallback draft folder: drafts/${today}`);
    console.log(`Add source links to inputs/${today}-sources.md then run npm run draft again.`);
    return;
  }

  write("sources.json", JSON.stringify({ date: today, sources_supplied: true, source_notes_path: `inputs/${today}-sources.md` }, null, 2));

  const aiDraft = await generateWithOpenAI(sourceNotes);

  if (!aiDraft) {
    write("daily_brief.md", `# Clearforge Daily AI Brief — ${today}\n\nStatus: Draft — OpenAI key not configured\n\n## Supplied Sources\n\n${sourceNotes}\n\n## Next Step\n\nSet OPENAI_API_KEY in your local environment or GitHub Actions secrets, then run npm run draft again.`);
    write("social_pack.md", buildSocialFallback());
    console.log("Sources found, but OPENAI_API_KEY is not configured. Created source-holding draft.");
    return;
  }

  write("daily_brief.md", aiDraft);
  write("social_pack.md", `# Clearforge Social Pack — ${today}\n\nStatus: Draft\n\nUse templates/social_repurpose_template.md to repurpose the approved article.\n\nDo not publish until daily_brief.md has passed human review.`);

  console.log(`Generated draft folder: drafts/${today}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
