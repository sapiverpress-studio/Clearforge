import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const apiKey = process.env.BREVO_API_KEY;
const listId = Number(process.env.BREVO_LIST_ID);
const senderEmail = process.env.BREVO_SENDER_EMAIL || "clearforge@sapiverpress.co.uk";
const senderName = process.env.BREVO_SENDER_NAME || "Clearforge";
const weekEnd = process.env.CLEARFORGE_WEEK_END || new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());
const testOnly = String(process.env.BREVO_TEST_ONLY || "false").toLowerCase() === "true";
const dir = path.join(ROOT, "newsletters", weekEnd);
const htmlPath = path.join(dir, "email.html");
const metaPath = path.join(dir, "metadata.json");

if (!apiKey) throw new Error("Missing BREVO_API_KEY.");
if (!Number.isInteger(listId) || listId < 1) throw new Error("BREVO_LIST_ID must be a positive integer.");
if (!fs.existsSync(htmlPath) || !fs.existsSync(metaPath)) throw new Error(`Missing generated newsletter in ${dir}.`);

const htmlContent = fs.readFileSync(htmlPath, "utf8");
const metadata = JSON.parse(fs.readFileSync(metaPath, "utf8"));
if (metadata.status === "sent" && !testOnly) throw new Error(`Newsletter ${weekEnd} is already marked sent.`);

const headers = { "api-key": apiKey, "content-type": "application/json", accept: "application/json" };
const createResponse = await fetch("https://api.brevo.com/v3/emailCampaigns", {
  method: "POST",
  headers,
  body: JSON.stringify({
    name: `Clearforge Weekly Digest ${weekEnd}${testOnly ? " TEST" : ""}`,
    subject: metadata.subject,
    sender: { name: senderName, email: senderEmail },
    type: "classic",
    htmlContent,
    recipients: { listIds: [listId] },
    inlineImageActivation: false,
    mirrorActive: true,
    footer: "You received this because you subscribed to the Clearforge Weekly Digest."
  })
});

const createText = await createResponse.text();
if (!createResponse.ok) throw new Error(`Brevo campaign creation failed (${createResponse.status}): ${createText}`);
const campaign = JSON.parse(createText);
if (!campaign.id) throw new Error("Brevo did not return a campaign id.");

const sendResponse = await fetch(`https://api.brevo.com/v3/emailCampaigns/${campaign.id}/sendNow`, {
  method: "POST",
  headers
});
const sendText = await sendResponse.text();
if (!sendResponse.ok) throw new Error(`Brevo campaign send failed (${sendResponse.status}): ${sendText}`);

const sentAt = new Date().toISOString();
const updated = {
  ...metadata,
  status: "sent",
  sent_at: sentAt,
  brevo_campaign_id: campaign.id,
  recipient_list_id: listId,
  test_run: testOnly
};
fs.writeFileSync(metaPath, JSON.stringify(updated, null, 2) + "\n");
console.log(`Sent Clearforge Weekly Digest ${weekEnd} through Brevo campaign ${campaign.id} to list ${listId}.`);
