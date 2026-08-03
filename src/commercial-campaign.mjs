import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, "config", "output-release-validation-campaign.json");

export function loadCommercialCampaign() {
  if (!fs.existsSync(CONFIG_PATH)) return null;
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
}

export function campaignIsActive(date, campaign = loadCommercialCampaign()) {
  const value = String(date || "").slice(0, 10);
  return Boolean(campaign?.enabled && value >= campaign.start_date && value <= campaign.end_date);
}

export function campaignLink(platform, edition, campaign = loadCommercialCampaign()) {
  if (!campaign?.product_url) return "";
  const url = new URL(campaign.product_url);
  url.searchParams.set("utm_source", String(platform || "unknown").toLowerCase());
  url.searchParams.set("utm_medium", "organic_social");
  url.searchParams.set("utm_campaign", campaign.id);
  url.searchParams.set("utm_content", String(edition || "daily"));
  return url.toString();
}

export function classifyReleaseProblem(value, campaign = loadCommercialCampaign()) {
  const corpus = String(value || "").toLowerCase();
  const matches = [];
  for (const [theme, phrases] of Object.entries(campaign?.themes || {})) {
    const evidence = phrases.filter((phrase) => corpus.includes(String(phrase).toLowerCase()));
    if (evidence.length) matches.push({ theme, evidence });
  }
  return matches;
}

export function writeCampaignRecord(draftDir, patch) {
  const file = path.join(draftDir, "commercial-validation-record.json");
  const existing = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  fs.mkdirSync(draftDir, { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify({ ...existing, ...patch, updated_at: new Date().toISOString() }, null, 2)}\n`);
}
