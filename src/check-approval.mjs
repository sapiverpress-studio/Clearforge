import fs from "node:fs";
import path from "node:path";

const today = process.env.CLEARFORGE_DATE || new Date().toISOString().slice(0, 10);
const approvalPath = path.join(process.cwd(), "drafts", today, "approval.json");
const target = process.argv[2] || "article";

const keyMap = {
  article: "article_approved",
  facebook: "facebook_approved",
  pinterest: "pinterest_approved",
  youtube: "youtube_approved"
};

if (!keyMap[target]) {
  console.error(`Unknown approval target: ${target}`);
  console.error(`Use one of: ${Object.keys(keyMap).join(", ")}`);
  process.exit(2);
}

if (!fs.existsSync(approvalPath)) {
  console.error(`Approval file missing: ${approvalPath}`);
  process.exit(1);
}

const approval = JSON.parse(fs.readFileSync(approvalPath, "utf8"));
const approved = approval[keyMap[target]] === true;

if (!approved) {
  console.error(`Blocked: ${target} is not approved in ${approvalPath}`);
  process.exit(1);
}

console.log(`Approved: ${target}`);
