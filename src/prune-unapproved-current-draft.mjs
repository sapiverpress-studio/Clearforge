import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATE = process.env.CLEARFORGE_DATE || new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());
const draftDir = path.join(ROOT, "drafts", DATE);
const approvalPath = path.join(draftDir, "approval.json");

if (!fs.existsSync(draftDir)) {
  console.log("No current draft folder to prune.");
  process.exit(0);
}

let approved = false;
if (fs.existsSync(approvalPath)) {
  try {
    const approval = JSON.parse(fs.readFileSync(approvalPath, "utf8"));
    approved = approval.article_approved === true && approval.feature_approved === true;
  } catch {
    approved = false;
  }
}

if (approved) {
  console.log("Current same-day edition is approved; preserving it for normal archival and novelty protection.");
  process.exit(0);
}

let removed = 0;
for (const entry of fs.readdirSync(draftDir, { withFileTypes: true })) {
  if (entry.name === "runs") continue;
  fs.rmSync(path.join(draftDir, entry.name), { recursive: true, force: true });
  removed += 1;
}
console.log(`Removed ${removed} unapproved current-draft item(s) before research so they cannot be archived as novelty history.`);
