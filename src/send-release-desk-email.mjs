import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const apiKey = process.env.BREVO_API_KEY;
const recipientEmail = process.env.CLEARFORGE_REVIEW_EMAIL;
const senderEmail = process.env.BREVO_SENDER_EMAIL || "clearforge@sapiverpress.co.uk";
const senderName = process.env.BREVO_SENDER_NAME || "Clearforge";
const edition = process.env.CLEARFORGE_DATE || new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());
const runUrl = process.env.CLEARFORGE_RUN_URL || "";
const draftDir = path.join(ROOT, "drafts", edition);
const summaryPath = path.join(draftDir, "release-summary.md");
const reportPath = path.join(draftDir, "release-desk.json");
const htmlPath = path.join(draftDir, `clearforge-release-desk-${edition}.html`);

if (!apiKey) throw new Error("Missing BREVO_API_KEY.");
if (!recipientEmail) throw new Error("Missing CLEARFORGE_REVIEW_EMAIL.");

function readText(file, fallback = "") {
  try { return fs.readFileSync(file, "utf8").trim(); } catch { return fallback; }
}
function readJson(file, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  })[character]);
}

const summary = readText(summaryPath);
const report = readJson(reportPath);
const hasReleaseDesk = summary && fs.existsSync(htmlPath);
const decision = hasReleaseDesk ? String(report.decision || "HUMAN REVIEW") : "RUN FAILED";
const assurance = Number.isFinite(Number(report.assurance_score))
  ? Number(report.assurance_score).toFixed(3)
  : "not available";
const hardStops = Array.isArray(report.hard_stops) ? report.hard_stops : [];
const flags = Array.isArray(report.advisory_flags) ? report.advisory_flags : [];

const subject = hasReleaseDesk
  ? `Clearforge review ready — ${decision} — ${edition}`
  : `Clearforge run needs attention — ${edition}`;

const summaryHtml = hasReleaseDesk
  ? `<p><strong>Decision:</strong> ${esc(decision)}</p>
     <p><strong>Release assurance:</strong> ${esc(assurance)}</p>
     <h2>Hard stops</h2>
     ${hardStops.length ? `<ul>${hardStops.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>` : "<p>None detected.</p>"}
     <h2>Advisory flags</h2>
     ${flags.length ? `<ul>${flags.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>` : "<p>None detected.</p>"}
     <p>The complete Daily Release Desk is attached. Nothing has been approved or published.</p>`
  : `<p>The Clearforge draft run did not produce a Daily Release Desk.</p>
     <p>No content was approved or published. Open the workflow run to inspect the failure.</p>`;

const runLink = runUrl
  ? `<p><a href="${esc(runUrl)}">Open the GitHub workflow run</a></p>`
  : "";

const payload = {
  sender: { name: senderName, email: senderEmail },
  to: [{ email: recipientEmail, name: "Jim" }],
  subject,
  htmlContent: `<!doctype html><html><body style="font-family:Arial,sans-serif;line-height:1.5;color:#102437">
    <h1>Clearforge Daily Review</h1>
    <p><strong>Edition:</strong> ${esc(edition)}</p>
    ${summaryHtml}
    ${runLink}
    <p style="color:#607080">Produced with AI assistance. Human approval is still required before release.</p>
  </body></html>`
};

if (hasReleaseDesk) {
  const attachment = fs.readFileSync(htmlPath);
  if (attachment.length > 8 * 1024 * 1024) {
    throw new Error("Release Desk attachment exceeds the 8 MB Clearforge email safety limit.");
  }
  payload.attachment = [{
    name: path.basename(htmlPath),
    content: attachment.toString("base64")
  }];
}

const response = await fetch("https://api.brevo.com/v3/smtp/email", {
  method: "POST",
  headers: {
    "api-key": apiKey,
    "content-type": "application/json",
    accept: "application/json"
  },
  body: JSON.stringify(payload)
});
const responseText = await response.text();
if (!response.ok) {
  throw new Error(`Brevo release email failed (${response.status}): ${responseText}`);
}

console.log(hasReleaseDesk
  ? `Emailed Clearforge Release Desk for ${edition} to the configured review address.`
  : `Emailed Clearforge run-failure notice for ${edition} to the configured review address.`);
