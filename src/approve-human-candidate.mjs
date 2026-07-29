import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const edition = String(process.env.CLEARFORGE_DATE || "").trim();
const expectedId = String(process.env.CLEARFORGE_CANDIDATE_ID || "").trim();
const approver = String(process.env.CLEARFORGE_APPROVER || "").trim();
const confirmation = String(process.env.CLEARFORGE_CONFIRMATION || "").trim();
if (!edition || !/^[a-f0-9]{64}$/.test(expectedId)) throw new Error("Missing edition or candidate ID.");
if (!approver) throw new Error("CLEARFORGE_APPROVER is required.");
if (confirmation !== `APPROVE ${edition}`) throw new Error(`Confirmation must exactly match: APPROVE ${edition}`);

const manifestPath = path.join(ROOT, "drafts", edition, "candidate-manifest.json");
if (!fs.existsSync(manifestPath)) throw new Error(`Missing candidate manifest: ${manifestPath}`);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
if (manifest.edition !== edition || manifest.candidate_id !== expectedId) {
  throw new Error("The downloaded candidate does not match the requested edition and candidate ID.");
}
for (const file of manifest.files || []) {
  const absolute = path.join(ROOT, file.path);
  if (!fs.existsSync(absolute)) throw new Error(`Candidate file is missing: ${file.path}`);
  const actual = crypto.createHash("sha256").update(fs.readFileSync(absolute)).digest("hex");
  if (actual !== file.sha256) throw new Error(`Candidate file changed after review: ${file.path}`);
}
const approval = {
  schema_version: 2,
  edition,
  candidate_id: expectedId,
  approved: true,
  approved_by: approver,
  approved_at: new Date().toISOString(),
  confirmation,
  disclosure: "Produced with AI assistance and released with human approval by Clearforge."
};
fs.writeFileSync(
  path.join(ROOT, "drafts", edition, "human_approval.json"),
  `${JSON.stringify(approval, null, 2)}\n`
);
console.log(`Verified and approved candidate ${expectedId} for ${edition}.`);
