import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATE = String(process.env.CLEARFORGE_DATE || "").trim();
const APPROVER = String(process.env.CLEARFORGE_APPROVER || "").trim();
const CONFIRMATION = String(process.env.CLEARFORGE_CONFIRMATION || "").trim();
if (!DATE) throw new Error("CLEARFORGE_DATE is required.");
if (!APPROVER) throw new Error("CLEARFORGE_APPROVER is required.");
if (CONFIRMATION !== `APPROVE ${DATE}`) throw new Error(`Confirmation must exactly match: APPROVE ${DATE}`);

const draftDir = path.join(ROOT, "drafts", DATE);
const reportPath = path.join(draftDir, "release-desk.json");
if (!fs.existsSync(reportPath)) throw new Error(`Missing release report: ${reportPath}`);
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
if (report.decision === "STOP" || (report.hard_stops || []).length) {
  throw new Error("This edition is STOP and cannot be approved.");
}
const claimVerificationPath = path.join(draftDir, "claim-verification.json");
if (!fs.existsSync(claimVerificationPath)) throw new Error("Claim-verification report is missing.");
const claimVerification = JSON.parse(fs.readFileSync(claimVerificationPath, "utf8"));
if (claimVerification.passed !== true || Number(claimVerification.confidence) < 0.9) {
  throw new Error("Independent claim verification has not passed at confidence 0.90 or higher.");
}

const approval = {
  schema_version: 1,
  edition: DATE,
  approved: true,
  approved_by: APPROVER,
  approved_at: new Date().toISOString(),
  assurance_score_at_approval: report.assurance_score,
  automatic_publication: false,
  confirmation: CONFIRMATION,
  disclosure: "Produced with AI assistance and released with human approval by Sapiver Forge."
};
fs.writeFileSync(path.join(draftDir, "human_approval.json"), JSON.stringify(approval, null, 2) + "\n");
console.log(`Recorded human approval for ${DATE} by ${APPROVER}.`);
