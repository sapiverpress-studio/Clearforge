import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATE = process.env.SAPIVER_FORGE_DATE || process.env.CLEARFORGE_DATE || new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(new Date());

const FREE_NOTION_URL = "https://sapiver-press.kit.com/5147ce2817";
const PAID_NOTION_URL = "https://payhip.com/b/o8iQA";
const NOTION_CTA = `Get the Sapiver Forge Notion Workspace free by email: ${FREE_NOTION_URL}\nBuy it directly: ${PAID_NOTION_URL}`;
const draftDir = path.join(ROOT, "drafts", DATE);
const structuredPath = path.join(draftDir, "structured_output.json");
const socialPackPath = path.join(draftDir, "social_pack.md");

if (!fs.existsSync(structuredPath)) throw new Error(`Missing ${structuredPath}`);

const structured = JSON.parse(fs.readFileSync(structuredPath, "utf8"));
const social = structured.social || {};

function stripOldCommercialCta(value) {
  return String(value || "")
    .replace(/https:\/\/payhip\.com\/b\/vGks8/gi, "")
    .replace(/Sapiver Forge AI Output Release Gate\s*[—-]\s*link in bio\.?/gi, "")
    .replace(/\s+$/g, "")
    .trim();
}

function appendNotionCta(value) {
  const base = stripOldCommercialCta(value);
  return base ? `${base}\n\n${NOTION_CTA}` : NOTION_CTA;
}

const captionSource = social.tiktok_caption || social.tiktok_caption_prompt || "Which AI check would make you pause before sending client work?";
social.tiktok_caption = appendNotionCta(captionSource);
social.tiktok_caption_prompt = social.tiktok_caption;

for (const field of ["facebook_post", "pinterest_description", "linkedin_post"]) {
  social[field] = appendNotionCta(social[field]);
}

structured.social = social;
fs.writeFileSync(structuredPath, `${JSON.stringify(structured, null, 2)}\n`, "utf8");

if (fs.existsSync(socialPackPath)) {
  let markdown = fs.readFileSync(socialPackPath, "utf8")
    .replace(/https:\/\/payhip\.com\/b\/vGks8/gi, `${FREE_NOTION_URL}\n${PAID_NOTION_URL}`);

  if (/## TikTok Caption\s*\n/i.test(markdown)) {
    markdown = markdown.replace(/## TikTok Caption\s*\n[\s\S]*?(?=\n## )/i, `## TikTok Caption\n\n${social.tiktok_caption}\n`);
  } else {
    markdown = markdown.replace(/(## TikTok Script\s*\n[\s\S]*?)(?=\n## YouTube Shorts Script)/i, `$1\n## TikTok Caption\n\n${social.tiktok_caption}\n`);
  }

  fs.writeFileSync(socialPackPath, markdown, "utf8");
}

console.log(`Finalised TikTok caption and Notion links for ${DATE}.`);
