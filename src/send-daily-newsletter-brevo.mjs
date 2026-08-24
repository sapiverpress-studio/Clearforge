import fs from "node:fs";
import path from "node:path";
import { resolveBrevoListId } from "./brevo-list-resolver.mjs";
import { isBrevoEmptyRecipientsError } from "./brevo-campaign-errors.mjs";

const ROOT = process.cwd();
const date = String(process.env.NEWS_INTELLIGENCE_DATE || new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date())).trim();
const mode = String(process.env.BREVO_SEND_MODE || "draft").toLowerCase();
const approved = String(process.env.NEWSLETTER_APPROVED || "false").toLowerCase() === "true";
const apiKey = process.env.BREVO_API_KEY;
const fallbackListId = Number(process.env.BREVO_LIST_ID);
const targetListName = process.env.BREVO_TARGET_LIST_NAME || "Sapiver Forge Daily Brief";
const senderEmail = process.env.BREVO_SENDER_EMAIL || "clearforge@sapiverpress.co.uk";
const senderName = process.env.BREVO_SENDER_NAME || "Sapiver Forge";
const dir = path.join(ROOT, "news-intelligence", date);
const htmlPath = path.join(dir, "newsletter.html");
const metaPath = path.join(dir, "newsletter-metadata.json");

if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("NEWS_INTELLIGENCE_DATE must use YYYY-MM-DD.");
if (!new Set(["none", "draft", "send"]).has(mode)) throw new Error("BREVO_SEND_MODE must be none, draft or send.");
if (mode === "none") {
  console.log("Brevo step disabled for this run.");
  process.exit(0);
}
if (!apiKey) throw new Error("Missing BREVO_API_KEY.");
if (!Number.isInteger(fallbackListId) || fallbackListId < 1) throw new Error("BREVO_LIST_ID must be a positive integer.");
if (!fs.existsSync(htmlPath) || !fs.existsSync(metaPath)) throw new Error(`Missing daily intelligence newsletter in ${dir}.`);

const metadata = JSON.parse(fs.readFileSync(metaPath, "utf8"));
if (metadata.status === "blocked") throw new Error("Newsletter is blocked because the intelligence edition did not meet verification thresholds.");
if (mode === "send" && !approved) throw new Error("Live newsletter send blocked: NEWSLETTER_APPROVED=true is required from an explicit human release run.");
if (metadata.status === "sent") {
  console.log(`Daily Brief ${date} is already marked sent; refusing duplicate delivery.`);
  process.exit(0);
}

const listId = await resolveBrevoListId({ apiKey, fallbackListId, targetListName });
const htmlContent = fs.readFileSync(htmlPath, "utf8");
const headers = { "api-key": apiKey, "content-type": "application/json", accept: "application/json" };
let campaignId = Number(metadata.brevo_campaign_id || 0) || null;

if (!campaignId) {
  const createResponse = await fetch("https://api.brevo.com/v3/emailCampaigns", {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: `Sapiver Forge Daily Brief ${date}`,
      subject: metadata.subject || `Sapiver Forge Daily Brief — ${date}`,
      sender: { name: senderName, email: senderEmail },
      type: "classic",
      htmlContent,
      recipients: { listIds: [listId] },
      inlineImageActivation: false,
      mirrorActive: true,
      footer: "You received this because you subscribed to the Sapiver Forge Daily Brief."
    })
  });
  const createText = await createResponse.text();

  if (!createResponse.ok && isBrevoEmptyRecipientsError(createResponse.status, createText)) {
    Object.assign(metadata, {
      status: "ready_no_subscribers",
      brevo_campaign_id: null,
      recipient_list_id: listId,
      email_skipped_reason: "no_daily_brief_subscribers",
      email_skipped_at: new Date().toISOString()
    });
    fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2) + "\n");
    console.log(`No contacts are currently subscribed to ${targetListName}; Brevo draft/send skipped without failing the Daily Brief run.`);
    process.exit(0);
  }

  if (!createResponse.ok) throw new Error(`Brevo campaign creation failed (${createResponse.status}): ${createText}`);
  const campaign = JSON.parse(createText);
  if (!campaign.id) throw new Error("Brevo did not return a campaign id.");
  campaignId = campaign.id;
  Object.assign(metadata, {
    status: "brevo_draft",
    brevo_campaign_id: campaignId,
    recipient_list_id: listId,
    campaign_created_at: new Date().toISOString(),
    email_skipped_reason: null,
    email_skipped_at: null
  });
  fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2) + "\n");
  console.log(`Created Brevo draft campaign ${campaignId} for Sapiver Forge Daily Brief ${date}.`);
}

if (mode === "draft") {
  console.log(`Brevo campaign ${campaignId} remains a draft pending human approval.`);
  process.exit(0);
}

const sendResponse = await fetch(`https://api.brevo.com/v3/emailCampaigns/${campaignId}/sendNow`, {
  method: "POST",
  headers
});
const sendText = await sendResponse.text();
if (!sendResponse.ok) throw new Error(`Brevo campaign send failed (${sendResponse.status}): ${sendText}`);

Object.assign(metadata, {
  status: "sent",
  approved: true,
  sent_at: new Date().toISOString(),
  brevo_campaign_id: campaignId,
  recipient_list_id: listId,
  email_skipped_reason: null,
  email_skipped_at: null
});
fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2) + "\n");
console.log(`Sent Sapiver Forge Daily Brief ${date} through Brevo campaign ${campaignId}.`);
