import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const CODE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATE = process.env.SAPIVER_FORGE_DATE || new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());
const dir = path.join(ROOT, "drafts", DATE);
const structuredPath = path.join(dir, "structured_output.json");
const reportPath = path.join(dir, "output-usability-report.json");
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
    quote_card_count: Array.isArray(social.quote_card_lines) ? social.quote_card_lines.filter((line) => String(line).trim()).length : 0
  };
  const failures = [];
  if (checks.article_words < 650) failures.push("narrowed daily article below 650 words");
  if (checks.tiktok_words < 18 || checks.tiktok_words > 120) failures.push(`TikTok script outside 18–120 words (${checks.tiktok_words})`);
  if (checks.tiktok_caption_words < 8 || checks.tiktok_caption_words > 100) failures.push(`TikTok caption outside 8–100 words (${checks.tiktok_caption_words})`);
  if (checks.youtube_words < 18 || checks.youtube_words > 140) failures.push(`YouTube Shorts script outside 18–140 words (${checks.youtube_words})`);
  if (checks.facebook_words < 25 || checks.facebook_words > 220) failures.push(`Facebook post outside 25–220 words (${checks.facebook_words})`);
  if (checks.pinterest_title_words < 4 || checks.pinterest_title_words > 18) failures.push(`Pinterest title outside 4–18 words (${checks.pinterest_title_words})`);
  if (checks.pinterest_description_words < 20 || checks.pinterest_description_words > 120) failures.push(`Pinterest description outside 20–120 words (${checks.pinterest_description_words})`);
  if (checks.quote_card_count !== 5) failures.push("quote-card pack does not contain exactly five lines");

  const publicCopy = [data.main_article, social.tiktok_script, social.tiktok_caption, social.youtube_shorts_script,
    social.facebook_post, social.pinterest_title, social.pinterest_description].join("\n");
  if (/retrieved evidence supports|original draft claimed|deterministic fallback/i.test(publicCopy)) failures.push("internal recovery wording leaked into public output");
  if (/output-release-30-day-validation|payhip\.com\/b\/pkSEY/i.test(publicCopy)) failures.push("abandoned Output Release campaign leaked into public output");
  if (/\bClear\s*Forge\b/i.test(publicCopy)) failures.push("old Clearforge branding leaked into public output");
  const boilerplateHits = ["skip to content", "log in", "create account", "add reaction", "jump to comments", "copy link", "share to facebook", "share share on twitter", "twitter linkedin email", "report abuse"]
    .filter((phrase) => publicCopy.toLowerCase().includes(phrase));
  if (boilerplateHits.length >= 2) failures.push(`retrieval boilerplate leaked into public output: ${boilerplateHits.join(", ")}`);
  if (/https?:\/\/[^\s]+\.\s+[^\s]+/i.test(publicCopy)) failures.push("URL contains whitespace after the domain dot");
  return { checks, failures };
}

let result = inspect();
let restored = false;
if (result.failures.length) {
  const rebuild = spawnSync(process.execPath, [path.join(CODE_ROOT, "src", "rebuild-narrowed-edition.mjs")], {
    cwd: ROOT, stdio: "inherit", env: { ...process.env, NARROWED_REBUILD_DISABLE_MODEL: "1" }
  });
  if (rebuild.status !== 0) throw new Error("Depth-first narrowed-edition usability recovery failed.");
  const enforce = spawnSync(process.execPath, [path.join(CODE_ROOT, "src", "enforce-locked-facts.mjs")], { cwd: ROOT, stdio: "inherit", env: process.env });
  if (enforce.status !== 0) throw new Error("Evidence enforcement failed after usability recovery.");
  const links = spawnSync(process.execPath, [path.join(CODE_ROOT, "src", "finalise-social-links.mjs")], { cwd: ROOT, stdio: "inherit", env: process.env });
  if (links.status !== 0) throw new Error("Social CTA finalisation failed after usability recovery.");
  restored = true;
  result = inspect();
}

fs.writeFileSync(reportPath, `${JSON.stringify({ edition: DATE, passed: result.failures.length === 0, restored_verified_fallback: restored, checks: result.checks, failures: result.failures }, null, 2)}\n`);
if (result.failures.length) throw new Error(`Required active-channel outputs remain unusable: ${result.failures.join("; ")}`);
console.log(`Output usability passed for ${DATE}${restored ? " after restoring the verified fallback" : ""}.`);
