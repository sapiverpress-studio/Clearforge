const required = ["NETLIFY_AUTH_TOKEN", "BREVO_API_KEY", "BREVO_LIST_ID", "NETLIFY_SITE_ID"];
for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing required environment variable: ${name}`);
}

const netlifyToken = process.env.NETLIFY_AUTH_TOKEN;
const brevoKey = process.env.BREVO_API_KEY;
const listId = Number(process.env.BREVO_LIST_ID);
const siteId = process.env.NETLIFY_SITE_ID;
const targetForm = process.env.NETLIFY_FORM_NAME || "clearforge-weekly-digest";

if (!Number.isInteger(listId) || listId <= 0) throw new Error("BREVO_LIST_ID must be a positive integer.");

async function jsonRequest(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${url} failed (${response.status}): ${typeof body === "string" ? body : JSON.stringify(body)}`);
  }
  return body;
}

const submissions = await jsonRequest(`https://api.netlify.com/api/v1/sites/${encodeURIComponent(siteId)}/submissions`, {
  headers: { Authorization: `Bearer ${netlifyToken}` }
});

const relevant = (Array.isArray(submissions) ? submissions : []).filter((submission) => {
  const formName = submission.form_name || submission.form?.name || submission.data?.["form-name"];
  const email = submission.email || submission.data?.email;
  const consent = String(submission.data?.consent || "").toLowerCase();
  return formName === targetForm && typeof email === "string" && email.includes("@") && consent === "yes";
});

const unique = new Map();
for (const submission of relevant) {
  const email = String(submission.email || submission.data.email).trim().toLowerCase();
  if (!unique.has(email)) unique.set(email, submission);
}

let synced = 0;
for (const [email] of unique) {
  await jsonRequest("https://api.brevo.com/v3/contacts", {
    method: "POST",
    headers: {
      "api-key": brevoKey,
      "content-type": "application/json",
      accept: "application/json"
    },
    body: JSON.stringify({
      email,
      listIds: [listId],
      updateEnabled: true,
      attributes: { OPT_IN: true }
    })
  });
  synced += 1;
  console.log(`Synced ${email} to Brevo list ${listId}.`);
}

console.log(`Finished: ${synced} consented subscriber${synced === 1 ? "" : "s"} synced from Netlify form ${targetForm}.`);
