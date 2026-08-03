import fs from "node:fs";
import path from "node:path";
import { campaignIsActive, classifyReleaseProblem } from "./commercial-campaign.mjs";

const ROOT = process.cwd();
const DATE = process.env.SAPIVER_FORGE_DATE || process.env.SAPIVER_FORGE_DATE || new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());
const draftDir = path.join(ROOT, "drafts", DATE);
const structuredPath = path.join(draftDir, "structured_output.json");
const socialPackPath = path.join(draftDir, "social_pack.md");
const audienceReportPath = path.join(draftDir, "audience_fit_report.json");
const warningPath = path.join(draftDir, "social-optimisation-warning.txt");

if (!fs.existsSync(structuredPath)) throw new Error(`Missing ${structuredPath}`);
const originalStructured = fs.readFileSync(structuredPath, "utf8");
const data = JSON.parse(originalStructured);
const stories = Array.isArray(data.story_summaries) ? data.story_summaries : [];
if (!stories.length) throw new Error("Social production requires at least one verified story.");
const campaignActive = campaignIsActive(DATE);
const releaseMatches = classifyReleaseProblem(JSON.stringify({ sources: data.sources, story_summaries: stories }));

if (campaignActive && !releaseMatches.length) {
  try {
    await import("./generate-podcast-socials.mjs");
    fs.writeFileSync(audienceReportPath, `${JSON.stringify({ generated_at: new Date().toISOString(), mode: "podcast_general", verified_story_count: stories.length, release_problem_matches: [], action: "Generated general social assets from the verified broad AI podcast because no story honestly supported the Output Release Gate campaign." }, null, 2)}\n`);
    process.exit(0);
  } catch (error) {
    data.social_mode = "podcast_general";
    data.social_source = "verified_broad_research_fallback";
    fs.writeFileSync(structuredPath, `${JSON.stringify(data, null, 2)}\n`);
    console.warn(`Podcast-derived social generation failed; preserving the verified broad social pack: ${error?.message || error}`);
    process.exit(0);
  }
}

function snapshot(file) {
  return fs.existsSync(file) ? fs.readFileSync(file) : null;
}
function restore(file, value) {
  if (value === null) fs.rmSync(file, { force: true });
  else fs.writeFileSync(file, value);
}
function writePreservationReport(reason) {
  const report = {
    generated_at: new Date().toISOString(),
    mode: stories.length >= 3 ? "optimisation_fallback" : stories.length === 1 ? "single_story_depth_first" : "two_story_depth_first",
    verified_story_count: stories.length,
    action: "Preserved the complete pre-existing social pack. Optional audience-fit optimisation did not replace or remove usable social output.",
    warning: reason,
    selected_story: stories[0]?.title || ""
  };
  fs.writeFileSync(audienceReportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(warningPath, `${reason}\nThe existing TikTok, YouTube, Facebook, Pinterest and other social materials were preserved.\n`, "utf8");
}

if (stories.length >= 3) {
  const originalSocialPack = snapshot(socialPackPath);
  const originalAudienceReport = snapshot(audienceReportPath);
  try {
    await import("./optimise-social-audience-fit.mjs");
    fs.rmSync(warningPath, { force: true });
    console.log(`Audience-fit optimisation completed for ${stories.length} verified stories.`);
  } catch (error) {
    restore(structuredPath, Buffer.from(originalStructured));
    restore(socialPackPath, originalSocialPack);
    restore(audienceReportPath, originalAudienceReport);
    const message = `Optional audience-fit optimisation was skipped: ${error instanceof Error ? error.message : String(error)}`;
    if (campaignActive) {
      try {
        await import("./generate-podcast-socials.mjs");
        fs.writeFileSync(warningPath, `${message}\nThe campaign optimiser failed, so verified podcast-derived socials were generated without forcing a product claim.\n`, "utf8");
        process.exit(0);
      } catch (podcastError) {
        const restored = JSON.parse(fs.readFileSync(structuredPath, "utf8"));
        restored.social_mode = "podcast_general";
        restored.social_source = "verified_broad_research_fallback";
        fs.writeFileSync(structuredPath, `${JSON.stringify(restored, null, 2)}\n`, "utf8");
        console.warn(`Podcast social fallback also failed; preserving broad verified copy: ${podcastError?.message || podcastError}`);
      }
    }
    writePreservationReport(message);
    console.warn(message);
    console.warn("Continuing with the complete social pack generated before the optional optimisation pass.");
  }
  process.exit(0);
}

const required = ["tiktok_script", "youtube_shorts_script", "facebook_post", "pinterest_title", "pinterest_description", "linkedin_post", "quote_card_lines"];
for (const key of required) {
  if (key === "quote_card_lines") {
    if (!Array.isArray(data.social?.[key]) || data.social[key].length !== 5) throw new Error("Depth-first rebuild did not produce five quote/card lines.");
  } else if (!String(data.social?.[key] || "").trim()) {
    throw new Error(`Depth-first rebuild did not produce social.${key}.`);
  }
}

const report = {
  generated_at: new Date().toISOString(),
  mode: stories.length === 1 ? "single_story_depth_first" : "two_story_depth_first",
  verified_story_count: stories.length,
  action: "Preserved the complete social pack generated by the depth-first rebuild. The three-story comparative audience optimiser was intentionally skipped.",
  selected_story: stories[0]?.title || ""
};
fs.writeFileSync(audienceReportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
fs.rmSync(warningPath, { force: true });
console.log(`Preserved full Sapiver Forge social pack from ${stories.length} verified ${stories.length === 1 ? "story" : "stories"}.`);
