import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const apiKey = process.env.BREVO_API_KEY;
const recipientEmail = process.env.CLEARFORGE_REVIEW_EMAIL;
const senderEmail = process.env.BREVO_SENDER_EMAIL || "clearforge@sapiverpress.co.uk";
const senderName = process.env.BREVO_SENDER_NAME || "Clearforge";
const edition = String(process.env.CLEARFORGE_DATE || "").trim();
const candidateId = String(process.env.CLEARFORGE_CANDIDATE_ID || "").trim();
const runUrl = String(process.env.CLEARFORGE_RUN_URL || "").trim();
const dryRun = String(process.env.CLEARFORGE_EMAIL_DRY_RUN || "false").toLowerCase() === "true";
if (!apiKey) throw new Error("Missing BREVO_API_KEY.");
if (!recipientEmail) throw new Error("Missing CLEARFORGE_REVIEW_EMAIL.");
if (!edition || !/^[a-f0-9]{64}$/.test(candidateId)) throw new Error("Missing edition or candidate ID.");

const draftDir = path.join(ROOT, "drafts", edition);
const htmlPath = path.join(draftDir, `human-review-${edition}-${candidateId.slice(0, 12)}.html`);
if (!fs.existsSync(htmlPath)) throw new Error(`Missing review HTML: ${htmlPath}`);
const attachment = fs.readFileSync(htmlPath);
if (attachment.length > 8 * 1024 * 1024) {
  throw new Error("Human review attachment exceeds the 8 MB Clearforge email safety limit.");
}
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
})[character]);
const payload = {
  sender: { name: senderName, email: senderEmail },
  to: [{ email: recipientEmail, name: "Jim" }],
  subject: `Clearforge human review ready — ${edition} — ${candidateId.slice(0, 12)}`,
  htmlContent: `<!doctype html><html><body style="font-family:Arial,sans-serif;line-height:1.5;color:#102437">
    <h1>Clearforge candidate ready for your validation</h1>
    <p><strong>Edition:</strong> ${esc(edition)}</p>
    <p><strong>Candidate:</strong> <code>${esc(candidateId)}</code></p>
    <p>The complete review HTML is attached. Nothing from this candidate has been deployed, syndicated or sent to social channels.</p>
    ${runUrl ? `<p><a href="${esc(runUrl)}">Open the GitHub workflow run and candidate artifact</a></p>` : ""}
    <p>After reviewing it, manually run <strong>Release Human-Validated Clearforge Edition</strong> using this edition and candidate ID.</p>
  </body></html>`,
  attachment: [{ name: path.basename(htmlPath), content: attachment.toString("base64") }]
};
if (dryRun) {
  console.log(JSON.stringify({ edition, candidate_id: candidateId, attachment_bytes: attachment.length }));
  process.exit(0);
}
const response = await fetch("https://api.brevo.com/v3/smtp/email", {
  method: "POST",
  headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
  body: JSON.stringify(payload)
});
const body = await response.text();
if (!response.ok) throw new Error(`Brevo human review email failed (${response.status}): ${body}`);
console.log(`Emailed human review package for ${edition}.`);
