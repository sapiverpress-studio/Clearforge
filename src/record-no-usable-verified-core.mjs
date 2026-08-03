import fs from "node:fs";
import path from "node:path";
import { campaignIsActive, loadCommercialCampaign, writeCampaignRecord } from "./commercial-campaign.mjs";

const ROOT = process.cwd();
const DATE = process.env.SAPIVER_FORGE_DATE || process.env.SAPIVER_FORGE_DATE || "";
const draftDir = path.join(ROOT, "drafts", DATE);
const reportPath = path.join(draftDir, "source-integrity-report.json");
const campaign = loadCommercialCampaign();

if (!campaignIsActive(DATE, campaign) || !fs.existsSync(reportPath)) process.exit(1);
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
if (Number(report.survivor_count || 0) > 0) process.exit(1);

const reason = "Retrieved sources left no meaningful, authoritative verified factual core.";
fs.writeFileSync(path.join(draftDir, "no-public-content.json"), `${JSON.stringify({
  edition: DATE, status: "no_public_content", reason, verification_completed: true,
  media_generation_started: false, candidate_sealing_started: false
}, null, 2)}\n`);
writeCampaignRecord(draftDir, {
  edition: DATE, campaign_id: campaign.id, status: "rejected_after_verification", reason,
  content_rejected_before_publication: 1
});
console.log(`Campaign recorded a clean skipped day: ${reason}`);
