import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATE = process.env.SAPIVER_FORGE_DATE || new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(new Date());

const FREE_NOTION_URL = "https://sapiver-press.kit.com/5147ce2817";
const PAID_NOTION_URL = "https://payhip.com/b/o8iQA";
const OLD_PRODUCT_URLS = ["https://payhip.com/b/vGks8", "https://payhip.com/b/pkSEY"];
const PODCAST_URL = "https://sapiverforge-daily-brief.netlify.app/podcast/";
const NOTION_CTA = `Get the Sapiver Forge Notion Workspace free by email: ${FREE_NOTION_URL}\nBuy it directly: ${PAID_NOTION_URL}`;
const draftDir = path.join(ROOT, "drafts", DATE);
const structuredPath = path.join(draftDir, "structured_output.json");
const socialPackPath = path.join(draftDir, "social_pack.md");
if (!fs.existsSync(structuredPath)) throw new Error(`Missing ${structuredPath}`);

const structured = JSON.parse(fs.readFileSync(structuredPath, "utf8"));
const social = structured.social || {};
const podcastGeneral = structured.social_mode === "podcast_general";

function cleanCommercialCopy(value) {
  let copy = String(value || "");
  for (const url of [...OLD_PRODUCT_URLS, FREE_NOTION_URL, PAID_NOTION_URL, PODCAST_URL]) copy = copy.replaceAll(url, "");
  return copy
    .replace(/Get the Sapiver Forge Notion Workspace free by email:\s*/gi, "")
    .replace(/Buy it directly:\s*/gi, "")
    .replace(/Hear the full Sapiver Forge AI Briefing:\s*/gi, "")
    .replace(/[^.!?\n]*\bSapiver Forge AI Output Release Gate\b[^.!?\n]*[.!?]?/gi, "")
    .replace(/(?:^|\s)\?(?=\s|$)/g, " ")
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

function appendPodcastCta(value) {
  const base = cleanCommercialCopy(value).replace(/\s{2,}/g, " ").trim();
  const cta = `Hear the full Sapiver Forge AI Briefing: ${PODCAST_URL}`;
  return base ? `${base}\n\n${cta}` : cta;
}

function replaceMarkdownSection(markdown, heading, content) {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`## ${escapedHeading}\\s*\\n[\\s\\S]*?(?=\\n## |$)`, "i");
  const replacement = `## ${heading}\n\n${content}\n`;
  if (pattern.test(markdown)) return markdown.replace(pattern, replacement);
  return `${markdown.trimEnd()}\n\n${replacement}`;
}

function removeMarkdownSection(markdown, heading) {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return markdown.replace(new RegExp(`\\n?## ${escapedHeading}\\s*\\n[\\s\\S]*?(?=\\n## |$)`, "i"), "\n").replace(/\n{3,}/g, "\n\n");
}

const captionSource = social.tiktok_caption || social.tiktok_caption_prompt || "Which AI check would make you pause before sending client work?";
social.tiktok_caption = podcastGeneral ? appendPodcastCta(captionSource) : appendNotionCta(captionSource);
social.tiktok_caption_prompt = social.tiktok_caption;
for (const field of ["facebook_post", "pinterest_description"]) {
  social[field] = podcastGeneral ? appendPodcastCta(social[field]) : appendNotionCta(social[field]);
}
delete social.linkedin_post;

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
  markdown = replaceMarkdownSection(markdown, "Pinterest Pin", `**Title:** ${social.pinterest_title || "Not generated"}\n\n**Description:** ${social.pinterest_description || "Not generated"}`);
  markdown = removeMarkdownSection(markdown, "LinkedIn-Style Post");
  fs.writeFileSync(socialPackPath, markdown, "utf8");
}

const activeFields = {
  tiktok_caption: social.tiktok_caption,
  facebook_post: social.facebook_post,
  pinterest_description: social.pinterest_description
};
const publicCopy = JSON.stringify(activeFields);
const failures = [];
for (const oldUrl of OLD_PRODUCT_URLS) if (publicCopy.includes(oldUrl)) failures.push(`retired product URL remains: ${oldUrl}`);
if (/Sapiver Forge AI Output Release Gate/i.test(publicCopy)) failures.push("old Output Release Gate CTA wording remains");
if (/:\s*[.!?](?:[\s\"}]|$)/.test(publicCopy)) failures.push("malformed empty CTA punctuation remains");
for (const [field, value] of Object.entries(activeFields)) {
  const text = String(value || "");
  if (podcastGeneral) {
    if ((text.match(/https:\/\/sapiverforge-daily-brief\.netlify\.app\/podcast\//g) || []).length !== 1) failures.push(`${field} must contain the podcast link exactly once`);
  } else {
    if ((text.match(new RegExp(FREE_NOTION_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length !== 1) failures.push(`${field} must contain the free Notion link exactly once`);
    if ((text.match(new RegExp(PAID_NOTION_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length !== 1) failures.push(`${field} must contain the paid Notion link exactly once`);
  }
}
if (failures.length) throw new Error(`Social CTA finalisation failed: ${failures.join("; ")}`);
console.log(`Finalised and validated ${podcastGeneral ? "podcast" : "Notion"} CTAs for ${DATE}.`);
