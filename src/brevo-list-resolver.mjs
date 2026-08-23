const API = "https://api.brevo.com/v3";

async function request(apiKey, url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "api-key": apiKey,
      accept: "application/json",
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });
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

async function listAll(apiKey) {
  const lists = [];
  for (let offset = 0; offset < 1000; offset += 50) {
    const body = await request(apiKey, `${API}/contacts/lists?limit=50&offset=${offset}&sort=desc`);
    const page = Array.isArray(body?.lists) ? body.lists : [];
    lists.push(...page);
    if (page.length < 50) break;
  }
  return lists;
}

export async function resolveBrevoListId({ apiKey, fallbackListId, targetListName, createIfMissing = true }) {
  if (!apiKey) throw new Error("BREVO_API_KEY is required.");
  const fallback = Number(fallbackListId);
  if (!Number.isInteger(fallback) || fallback < 1) throw new Error("BREVO_LIST_ID must be a positive integer.");
  const target = String(targetListName || "").trim();
  if (!target) return fallback;

  const lists = await listAll(apiKey);
  const exact = lists.find((list) => String(list.name || "").trim().toLowerCase() === target.toLowerCase());
  if (exact?.id) return Number(exact.id);
  if (!createIfMissing) throw new Error(`Brevo list not found: ${target}`);

  const fallbackList = lists.find((list) => Number(list.id) === fallback);
  const folderId = Number(fallbackList?.folderId);
  if (!Number.isInteger(folderId) || folderId < 1) {
    throw new Error(`Could not determine the Brevo folder for existing list ${fallback}; refusing to create ${target}.`);
  }

  const created = await request(apiKey, `${API}/contacts/lists`, {
    method: "POST",
    body: JSON.stringify({ name: target, folderId })
  });
  const id = Number(created?.id);
  if (!Number.isInteger(id) || id < 1) throw new Error(`Brevo did not return an id after creating ${target}.`);
  console.log(`Created Brevo list ${target} (${id}) in folder ${folderId}.`);
  return id;
}

export const __test = { listAll };
