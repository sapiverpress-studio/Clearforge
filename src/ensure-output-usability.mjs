import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { campaignIsActive } from "./commercial-campaign.mjs";

const ROOT = process.cwd();
const CODE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATE = process.env.SAPIVER_FORGE_DATE || process.env.SAPIVER_FORGE_DATE || new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());
const dir = path.join(ROOT, "drafts", DATE);
const structuredPath = path.join(dir, "structured_output.json");
const reportPath = path.join(dir, "output-usability-report.json");
const campaignActive = campaignIsActive(DATE);
if (!fs.existsSync(structuredPath)) throw new Error("Output usability requires structured_output.json.");
if (!fs.existsSync(path.join(dir, "narrowed-edition-rebuild.json"))) {
  fs.writeFileSync(reportPath, `${JSON.stringify({ edition: DATE, passed: true, applicable: false, reason: "Edition was not narrowed by evidence verification." }, null, 2)}\n`);
  console.log("Output usability recovery is not applicable to a non-narrowed edition.");
  process.exit(0);
}

const words = (value) => String(value || "").trim().split(/\s+/).filter(Boolean).length;
function inspect() {
  const data = JSON.parse(fs.readFileSync(structuredPath, "utf8"));
  const social = data.social || {};
  const checks = {
    article_words: words(data.main_article),
    tiktok_words: words(social.tiktok_script),
    tiktok_caption_words: words(social.tiktok_caption),
    youtube_words: words(social.youtube_shorts_script),
    facebook_words: words(social.facebook_post),
    pinterest_title_words: words(social.pinterest_title),
    pinterest_description_words: words(social.pinterest_description),
    linkedin_words: words(social.linkedin_post),
    quote_card_count: Array.isArray(social.quote_card_lines) ? social.quote_card_lines.filter((line) => String(line).trim()).length : 0
  };
  const failures = [];
  if (checks.article_words < 150) failures.push("daily article below 150 words");
  if (checks.tiktok_words < 18) failures.push("TikTok script below 18 words");
  if (checks.tiktok_words > 60) failures.push("TikTok script above 60 words");
  if (checks.tiktok_caption_words < 12) failures.push("TikTok caption below 12 words");
  if (checks.youtube_words < 18) failures.push("YouTube Shorts script below 18 words");
  if (checks.facebook_words < 30) failures.push("Facebook post below 30 words");
  if (checks.pinterest_title_words < 4) failures.push("Pinterest title below 4 words");
  if (checks.pinterest_description_words < 12) failures.push("Pinterest description below 12 words");
  if (checks.linkedin_words < 25) failures.push("LinkedIn-style post below 25 words");
  if (checks.quote_card_count !== 5) failures.push("quote-card pack does not contain exactly five lines");
  const publicCopy = [data.main_article, social.tiktok_script, social.tiktok_caption, social.youtube_shorts_script,
    social.facebook_post, social.pinterest_title, social.pinterest_description, social.linkedin_post].join("\n");
  const boilerplateHits = ["skip to content", "log in", "create account", "add reaction", "jump to comments", "copy link", "share to facebook", "share share on twitter", "twitter linkedin email", "report abuse"]
    .filter((phrase) => publicCopy.toLowerCase().includes(phrase));
  if (boilerplateHits.length >= 2) failures.push(`retrieval boilerplate leaked into public output: ${boilerplateHits.join(", ")}`);
  if (/https?:\/\/[^\s]+\.\s+[^\s]+/i.test(publicCopy)) failures.push("URL contains whitespace after the domain dot");
  if (campaignActive && data.social_mode !== "podcast_general") {
    for (const [field, value] of Object.entries({ tiktok_caption: social.tiktok_caption, facebook_post: social.facebook_post, pinterest_description: social.pinterest_description, linkedin_post: social.linkedin_post })) {
      if (!String(value || "").includes("https://payhip.com/b/pkSEY")) failures.push(`${field} is missing the Output Release Gate campaign link`);
    }
  }
  return { data, checks, failures };
}

let result = inspect();
let restored = false;
if (result.failures.length && fs.existsSync(path.join(dir, "narrowed-edition-rebuild.json"))) {
  const rebuild = spawnSync(process.execPath, [path.join(CODE_ROOT, "src", "rebuild-narrowed-edition.mjs")], {
    cwd: ROOT, stdio: "inherit", env: { ...process.env, NARROWED_REBUILD_DISABLE_MODEL: "1" }
  });
  if (rebuild.status !== 0) throw new Error("Deterministic narrowed-edition usability recovery failed.");
  const enforce = spawnSync(process.execPath, [path.join(CODE_ROOT, "src", "enforce-locked-facts.mjs")], { cwd: ROOT, stdio: "inherit", env: process.env });
  if (enforce.status !== 0) throw new Error("Evidence enforcement failed after usability recovery.");
  const links = spawnSync(process.execPath, [path.join(CODE_ROOT, "src", "finalise-social-links.mjs")], { cwd: ROOT, stdio: "inherit", env: process.env });
  if (links.status !== 0) throw new Error("Social CTA finalisation failed after usability recovery.");
  restored = true;
  result = inspect();
}

fs.writeFileSync(reportPath, `${JSON.stringify({ edition: DATE, passed: result.failures.length === 0, restored_verified_fallback: restored, checks: result.checks, failures: result.failures }, null, 2)}\n`);
if (result.failures.length) throw new Error(`Required commercial outputs remain unusable: ${result.failures.join("; ")}`);
console.log(`Output usability passed for ${DATE}${restored ? " after restoring the verified fallback" : ""}.`);
