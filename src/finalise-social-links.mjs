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
const OLD_PRODUCT_URL = "https://payhip.com/b/vGks8";
const NOTION_CTA = `Get the Sapiver Forge Notion Workspace free by email: ${FREE_NOTION_URL}\nBuy it directly: ${PAID_NOTION_URL}`;
const draftDir = path.join(ROOT, "drafts", DATE);
const structuredPath = path.join(draftDir, "structured_output.json");
const socialPackPath = path.join(draftDir, "social_pack.md");

if (!fs.existsSync(structuredPath)) throw new Error(`Missing ${structuredPath}`);

const structured = JSON.parse(fs.readFileSync(structuredPath, "utf8"));
const social = structured.social || {};

function cleanCommercialCopy(value) {
  return String(value || "")
    .replace(/Get the Sapiver Forge Notion Workspace free by email:\s*https:\/\/sapiver-press\.kit\.com\/5147ce2817\s*Buy it directly:\s*https:\/\/payhip\.com\/b\/o8iQA/gi, "")
    .replace(/Get the Sapiver Forge Notion Workspace free by email:\s*/gi, "")
    .replace(/Buy it directly:\s*/gi, "")
    .replaceAll(FREE_NOTION_URL, "")
    .replaceAll(PAID_NOTION_URL, "")
    .replaceAll(OLD_PRODUCT_URL, "")
    .replace(/[^.!?\n]*\bSapiver Forge AI Output Release Gate\b[^.!?\n]*[.!?]?/gi, "")
    .replace(/\b(?:here|at|via)\s*:\s*[.!?]?/gi, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([.!?])\1+/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function appendNotionCta(value) {
  const base = cleanCommercialCopy(value).replace(/\s{2,}/g, " ").trim();
  return base ? `${base}\n\n${NOTION_CTA}` : NOTION_CTA;
}

function replaceMarkdownSection(markdown, heading, content) {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`## ${escapedHeading}\\s*\\n[\\s\\S]*?(?=\\n## |$)`, "i");
  const replacement = `## ${heading}\n\n${content}\n`;
  if (pattern.test(markdown)) return markdown.replace(pattern, replacement);
  return `${markdown.trimEnd()}\n\n${replacement}`;
}

const captionSource = social.tiktok_caption || social.tiktok_caption_prompt || "Which AI check would make you pause before sending client work?";
social.tiktok_caption = appendNotionCta(captionSource);
social.tiktok_caption_prompt = social.tiktok_caption;

for (const field of ["facebook_post", "pinterest_description", "linkedin_post"]) {
  social[field] = appendNotionCta(social[field]);
}

if (social.youtube_shorts_script) {
  social.youtube_shorts_script = cleanCommercialCopy(social.youtube_shorts_script)
    .replace(/Check the description for\s*$/i, "See the description for the Sapiver Forge Notion Workspace.")
    .trim();
}

structured.social = social;
fs.writeFileSync(structuredPath, `${JSON.stringify(structured, null, 2)}\n`, "utf8");

if (fs.existsSync(socialPackPath)) {
  let markdown = fs.readFileSync(socialPackPath, "utf8");
  markdown = replaceMarkdownSection(markdown, "TikTok Caption", social.tiktok_caption);
  markdown = replaceMarkdownSection(markdown, "YouTube Shorts Script", social.youtube_shorts_script || "Not generated");
  markdown = replaceMarkdownSection(markdown, "Facebook Post", social.facebook_post || "Not generated");
  markdown = replaceMarkdownSection(
    markdown,
    "Pinterest Pin",
    `**Title:** ${social.pinterest_title || "Not generated"}\n\n**Description:** ${social.pinterest_description || "Not generated"}`
  );
  markdown = replaceMarkdownSection(markdown, "LinkedIn-Style Post", social.linkedin_post || "Not generated");
  fs.writeFileSync(socialPackPath, markdown, "utf8");
}

const publicCopy = JSON.stringify({
  tiktok_caption: social.tiktok_caption,
  youtube_shorts_script: social.youtube_shorts_script,
  facebook_post: social.facebook_post,
  pinterest_description: social.pinterest_description,
  linkedin_post: social.linkedin_post
});

const failures = [];
if (publicCopy.includes(OLD_PRODUCT_URL)) failures.push("retired Output Release Gate URL remains");
if (/Sapiver Forge AI Output Release Gate/i.test(publicCopy)) failures.push("old Output Release Gate CTA wording remains");
if (/:\s*[.!?](?:[\s\"}]|$)/.test(publicCopy)) failures.push("malformed empty CTA punctuation remains");
for (const [field, value] of Object.entries({
  tiktok_caption: social.tiktok_caption,
  facebook_post: social.facebook_post,
  pinterest_description: social.pinterest_description,
  linkedin_post: social.linkedin_post
})) {
  if (!String(value || "").includes(FREE_NOTION_URL)) failures.push(`${field} is missing the free Notion link`);
  if (!String(value || "").includes(PAID_NOTION_URL)) failures.push(`${field} is missing the paid Notion link`);
  if ((String(value || "").match(new RegExp(FREE_NOTION_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length !== 1) failures.push(`${field} must contain the free Notion link exactly once`);
  if ((String(value || "").match(new RegExp(PAID_NOTION_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length !== 1) failures.push(`${field} must contain the paid Notion link exactly once`);
}
if (failures.length) throw new Error(`Social CTA finalisation failed: ${failures.join("; ")}`);

console.log(`Finalised and validated public-ready Notion CTAs for ${DATE}.`);
