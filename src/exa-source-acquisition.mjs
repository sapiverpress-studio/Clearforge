import crypto from "node:crypto";

const EXA_URL = "https://api.exa.ai/search";
const MIN_EVIDENCE_CHARS = 240;
const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
const host = (url) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } };
const stableId = (url) => `exa-${crypto.createHash("sha256").update(url).digest("hex").slice(0, 12)}`;

function recentStart(date) {
  const stamp = new Date(`${String(date).slice(0, 10)}T12:00:00Z`);
  stamp.setUTCDate(stamp.getUTCDate() - 7);
  return stamp.toISOString();
}

async function exaSearch(fetchImpl, apiKey, body) {
  const response = await fetchImpl(EXA_URL, {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Exa search failed (${response.status}): ${payload.error || "unknown response"}`);
  return payload;
}

async function preflight(fetchImpl, url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetchImpl(url, {
      redirect: "follow", signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; SapiverForgeSourceAcquisition/1.0; +https://sapiverforge-daily-brief.netlify.app)",
        accept: "text/html,application/xhtml+xml,application/pdf,text/plain"
      }
    });
    return { status: response.status, final_url: response.url || url, ok: response.ok };
  } catch (error) {
    return { status: 0, final_url: url, ok: false, error: String(error?.message || error) };
  } finally { clearTimeout(timer); }
}

export async function acquireExaSources({ apiKey, date, theme, excludedUrls = [], campaign = null, fetchImpl = fetch }) {
  if (!apiKey) throw new Error("EXA_API_KEY is required before paid content generation.");
  const queries = campaign ? [
    `Current primary-source evidence about AI-assisted output containing invented facts, sources, quotations, private information, confidential data, copied material, ownership or disclosure problems relevant on ${date}. Focus on consequences before client work or public content is released.`,
    `Current documented incidents or authoritative guidance about the wrong AI-generated draft, file, recipient or destination, automated sending or publishing without human review, or unsuitable client-facing AI output relevant on ${date}.`
  ] : [
    `Latest substantive AI product, research, policy and infrastructure developments relevant on ${date}. Prefer original company announcements, official documentation, papers, government sources and named research reports.`,
    `Latest evidence about AI's effect on work, education, creators, freelancers and small businesses relevant on ${date}. Prefer original surveys with methodology, research papers, transcripts and documented case studies.`,
    `Latest AI developments for ${theme?.title || "practical use"}: ${theme?.focus || "tools, workflows and human review"}. Prefer primary sources with a visible publication date and detailed body text.`
  ];
  const searches = await Promise.all(queries.map((query) => exaSearch(fetchImpl, apiKey, {
    query, type: "auto", numResults: 10, startPublishedDate: recentStart(date), moderation: true,
    contents: { text: { maxCharacters: 9000, includeSections: ["body", "metadata"] }, highlights: true, maxAgeHours: 24 }
  })));
  const excluded = new Set(excludedUrls);
  const seen = new Set();
  const seenFinal = new Set();
  const candidates = [];
  for (const [queryIndex, payload] of searches.entries()) {
    for (const result of payload.results || []) {
      const requestedUrl = clean(result.url);
      if (!requestedUrl.startsWith("https://") || excluded.has(requestedUrl) || seen.has(requestedUrl)) continue;
      seen.add(requestedUrl);
      const title = clean(result.title);
      const text = clean(result.text);
      const highlights = (result.highlights || []).map(clean).filter(Boolean);
      const evidenceText = text || highlights.join(" ");
      if (!title || evidenceText.length < MIN_EVIDENCE_CHARS) continue;
      const releaseProblemThemes = campaign?.themes
        ? Object.entries(campaign.themes)
          .filter(([, phrases]) => phrases.some((phrase) => `${title} ${evidenceText}`.toLowerCase().includes(String(phrase).toLowerCase())))
          .map(([themeName]) => themeName)
        : [];
      if (campaign && !releaseProblemThemes.length) continue;
      const check = await preflight(fetchImpl, requestedUrl);
      if ([0, 404, 410].includes(check.status) || (check.status >= 500 && check.status <= 599)) continue;
      const secondary = !check.ok;
      if (secondary && ![401, 403, 429].includes(check.status)) continue;
      const finalUrl = clean(check.final_url || requestedUrl);
      if (!finalUrl.startsWith("https://") || excluded.has(finalUrl) || seenFinal.has(finalUrl)) continue;
      seenFinal.add(finalUrl);
      candidates.push({
        acquisition_id: stableId(finalUrl), requested_url: requestedUrl, final_url: finalUrl,
        page_title: title, publication_date: clean(result.publishedDate), publisher_domain: host(finalUrl),
        usable_source_text: evidenceText, evidence_passages: highlights.length ? highlights : [evidenceText.slice(0, 1800)],
        retrieval_status: secondary ? "retrieved_by_exa_after_publisher_block" : "preflight_passed_with_exa_text",
        direct_http_status: check.status, retrieval_provider: "exa", discovery_query_index: queryIndex,
        release_problem_themes: releaseProblemThemes,
        retrieval_timestamp: new Date().toISOString()
      });
    }
  }
  const domainCounts = new Map();
  const ranked = candidates.sort((a, b) => b.usable_source_text.length - a.usable_source_text.length).filter((item) => {
    const count = domainCounts.get(item.publisher_domain) || 0;
    if (count >= 2) return false;
    domainCounts.set(item.publisher_domain, count + 1);
    return true;
  }).slice(0, 15);
  if (!ranked.length && !campaign) throw new Error("Exa source acquisition found no retrievable evidence. Paid content generation was not started.");
  return {
    schema_version: 1, provider: "exa", edition: date, acquired_at: new Date().toISOString(),
    status: ranked.length ? "usable_candidates_found" : "no_suitable_source",
    query_count: queries.length, candidate_count: ranked.length,
    provider_cost_usd: searches.reduce((sum, item) => sum + Number(item.costDollars?.total || 0), 0),
    candidates: ranked
  };
}
