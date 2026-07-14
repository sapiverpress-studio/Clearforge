import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATE = process.env.CLEARFORGE_DATE || new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());
const runsDir = path.join(ROOT, "drafts", DATE, "runs");

if (!fs.existsSync(runsDir)) {
  console.log("No same-day archived runs to prune.");
  process.exit(0);
}

let removed = 0;
let kept = 0;
for (const name of fs.readdirSync(runsDir)) {
  const dir = path.join(runsDir, name);
  if (!fs.statSync(dir).isDirectory()) continue;
  const approvalPath = path.join(dir, "approval.json");
  let published = false;
  try {
    const approval = JSON.parse(fs.readFileSync(approvalPath, "utf8"));
    published = approval.article_approved === true || approval.feature_approved === true || approval.facebook_approved === true || approval.youtube_approved === true || approval.pinterest_approved === true;
  } catch {
    published = false;
  }
  if (published) {
    kept += 1;
  } else {
    fs.rmSync(dir, { recursive: true, force: true });
    removed += 1;
  }
}

console.log(`Novelty history cleanup: removed ${removed} unpublished test run(s); kept ${kept} approved/published run(s).`);
