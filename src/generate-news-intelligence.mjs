import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { collectNewsSources } from "./news-intelligence-sources.mjs";
import { generateGroundedEvidence, generateStructured } from "./gemini-provider.mjs";
import { isEditoriallyRelevant, stripOurReadPrefix } from "./news-intelligence-editorial-rules.mjs";

const ROOT = process.cwd();
const DATE = String(process.env.NEWS_INTELLIGENCE_DATE || new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date())).trim();
const BASE = String(process.env.BLOG_BASE_URL || "https://sapiverforge-daily-brief.netlify.app").replace(/\/$/, "");
const OUT = path.join(ROOT, "news-intelligence", DATE);
const BRIDGE = path.join(ROOT, "bridge", "news-intelligence", "latest");

if (!/^\d{4}-\d{2}-\d{2}$/.test(DATE)) throw new Error("NEWS_INTELLIGENCE_DATE must use YYYY-MM-DD.");

const esc = (value) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const ensure = (dir) => fs.mkdirSync(dir, { recursive: true });
const write = (dir, name, content) => {
  ensure(dir);
  fs.writeFileSync(path.join(dir, name), typeof content === "string" ? content.trimEnd() + "\n" : JSON.stringify(content, null, 2) + "\n", "utf8");
};

function hashObject(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function cautiousEditorialText(value) {
  return clean(value)
    .replace(/\bwill dictate\b/gi, "could influence")
    .replace(/\bwill determine\b/gi, "could shape")
    .replace(/\bwill force\b/gi, "could push")
    .replace(/\bwill inevitably\b/gi, "could")
    .replace(/\bis certain to\b/gi, "could")
    .replace(/\bensuring\b/gi, "potentially helping to keep")
    .replace(/\bguarantees?\b/gi, "could support");
}

function candidateLines(candidates) {
  return candidates.map((item, index) => [
    `[${index}] ${item.source} | score ${item.score}`,
    `Title: ${item.title}`,
    `Publisher: ${item.publisher || "unknown"}`,
    `Editorial scope: ${isEditoriallyRelevant(item) ? "IN SCOPE" : "OUT OF SCOPE"}`,
    `Source URL: ${item.direct_source_url || item.url}`,
    item.discovery_url && item.discovery_url !== item.url ? `Discovered via: ${item.discovery_url}` : "",
    `Link quality: ${item.link_quality || "unknown"}`,
    item.published_at ? `Published: ${item.published_at}` : "Published: unknown",
    item.summary ? `Source summary: ${item.summary.slice(0, 900)}` : "Source summary: not supplied",
    item.discussion_url ? `Discussion: ${item.discussion_url}` : ""
  ].filter(Boolean).join("\n")).join("\n\n");
}

const STORY_SCHEMA = {
  type: "object",
  properties: {
    publication_title: { type: "string" },
    intro: { type: "string" },
    stories: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      items: {
        type: "object",
        properties: {
          source_index: { type: "integer" },
          category: { type: "string", enum: ["lead", "ai", "technology", "business", "research", "developer", "worth-knowing"] },
          headline: { type: "string" },
          confirmed_fact: { type: "string" },
          why_it_matters: { type: "string" },
          interpretation: { type: "string" },
          confidence: { type: "number" }
        },
        required: ["source_index", "category", "headline", "confirmed_fact", "why_it_matters", "interpretation", "confidence"]
      }
    },
    practical_takeaway: { type: "string" },
    watch_next: { type: "string" },
    overall_confidence: { type: "number" }
  },
  required: ["publication_title", "intro", "stories", "practical_takeaway", "watch_next", "overall_confidence"]
};

async function createEditorialOutput(sourceBundle) {
  const candidates = sourceBundle.candidates.slice(0, 20);
  if (sourceBundle.healthy_source_count < 3 || candidates.length < 8) {
    return { ok: false, reason: `Only ${sourceBundle.healthy_source_count}/5 sources healthy and ${candidates.length} candidates available.` };
  }
  if (!process.env.GEMINI_API_KEY) return { ok: false, reason: "GEMINI_API_KEY is not configured." };

  const evidencePrompt = `You are the evidence desk for Sapiver Forge. Verify the news candidates below for the ${DATE} UK morning briefing.\n\nUse Google Search grounding to check whether each significant candidate is current and accurately characterised. Prefer primary sources, company announcements, filings, papers and Reuters for confirmation. Treat Techmeme and Hacker News as discovery signals, not proof. Treat Hugging Face paper summaries as claims made by the paper unless independently corroborated. Do not invent facts.\n\nSapiver Forge covers AI, technology, digital business, research, technology regulation and adjacent innovation. General celebrity, entertainment, sport, crime, lifestyle or political news is out of scope unless it has a direct material connection to those areas. Candidates marked OUT OF SCOPE must not be recommended merely because they are prominent or highly ranked.\n\nProduce concise evidence notes for the strongest in-scope candidates. For each one state the candidate number, what is confirmed, important caveats, and whether it is suitable for publication today. If a claim cannot be checked, say so. Minor source availability problems are not a reason to reject an otherwise well-corroborated story.\n\nCANDIDATES:\n\n${candidateLines(candidates)}`;

  const evidence = await generateGroundedEvidence({
    system: "You are a cautious news verification editor. Separate confirmed facts from interpretation and uncertainty.",
    prompt: evidencePrompt
  });

  const structured = await generateStructured({
    system: [
      "You edit the Sapiver Forge Daily Brief for practical UK readers interested in AI, technology and business.",
      "Use only facts supported by the supplied candidate metadata and verification evidence.",
      "The editorial scope is AI, technology, digital business, research, technology regulation and adjacent innovation. General celebrity, entertainment, sport, crime, lifestyle or political news is out of scope unless it has a direct material connection to those areas.",
      "Never select a candidate marked OUT OF SCOPE, regardless of discovery score or general news prominence.",
      "Never turn speculation into fact. Keep interpretation clearly labelled as interpretation.",
      "Do not attribute motive, strategy, intention or inevitability unless the evidence explicitly supports it.",
      "Do not invent a fixed future time horizon. Avoid deterministic language such as 'will dictate', 'will force', 'ensuring' or 'guarantees'. Use may, could, suggests or would depend on where appropriate.",
      "Select a broad mix rather than five versions of the same AI story.",
      "Prefer consequential developments over novelty. Avoid hype, clickbait and investment advice.",
      "Prefer candidates with direct publisher/original URLs. Aggregator links are discovery fallbacks, not preferred publication links."
    ],
    prompt: `Build today's short daily intelligence edition from the verified evidence. Aim for a 3-5 minute read.\n\nRules:\n- Choose 3 to 6 stories.\n- source_index MUST refer to one of the numbered candidates below.\n- NEVER choose a candidate marked Editorial scope: OUT OF SCOPE.\n- Use one lead story and cover AI, technology/business/research where genuinely available.\n- confirmed_fact should be one or two concise sentences.\n- why_it_matters should explain practical significance without overstating certainty.\n- interpretation must contain only the interpretation text. It MUST NOT begin with "Our read", "Our read is", or another copy of the template label. Do not claim a company's motive or intended strategy unless directly supported.\n- practical_takeaway must be derived only from stories selected for this final edition. Do not introduce a recommendation based on a candidate that was researched but not selected.\n- watch_next must follow directly from one or more stories selected for this final edition. Do not introduce an unrelated researched candidate.\n- practical_takeaway must be useful but non-deterministic; do not invent a three-year or other fixed horizon unless the evidence itself supplies it.\n- confidence is 0 to 1. Do not include a story below 0.72 confidence.\n- overall_confidence is 0 to 1.\n\nVERIFICATION EVIDENCE:\n${evidence.text}\n\nCANDIDATES:\n${candidateLines(candidates)}`,
    schema: STORY_SCHEMA
  });

  const seen = new Set();
  const mapped = [];
  for (const story of Array.isArray(structured.stories) ? structured.stories : []) {
    const index = Number(story.source_index);
    const candidate = candidates[index];
    if (!candidate || seen.has(index) || !isEditoriallyRelevant(candidate)) continue;
    const confidence = Math.max(0, Math.min(1, Number(story.confidence || 0)));
    if (confidence < 0.72) continue;
    seen.add(index);
    const finalUrl = candidate.direct_source_url || candidate.url;
    mapped.push({
      category: clean(story.category || "worth-knowing"),
      headline: clean(story.headline || candidate.title),
      confirmed_fact: clean(story.confirmed_fact),
      why_it_matters: clean(story.why_it_matters),
      interpretation: cautiousEditorialText(stripOurReadPrefix(story.interpretation)),
      confidence,
      source: clean(candidate.publisher || candidate.source),
      discovered_via: candidate.source,
      source_title: candidate.title,
      url: finalUrl,
      discovery_url: candidate.discovery_url || candidate.url,
      link_quality: candidate.link_quality || (candidate.direct_source_url ? "original" : "unknown"),
      published_at: candidate.published_at || null,
      discovery_score: candidate.score
    });
  }
  if (mapped.length < 3) return { ok: false, reason: "Editorial relevance and verification did not leave at least three publishable in-scope stories.", evidence };

  return {
    ok: true,
    evidence,
    editorial: {
      publication_title: clean(structured.publication_title || `Sapiver Forge Daily Brief — ${DATE}`),
      intro: clean(structured.intro),
      stories: mapped.slice(0, 6),
      practical_takeaway: cautiousEditorialText(structured.practical_takeaway),
      watch_next: cautiousEditorialText(structured.watch_next),
      overall_confidence: Math.max(0, Math.min(1, Number(structured.overall_confidence || 0)))
    }
  };
}

function fallbackEditorial(sourceBundle, reason) {
  const representatives = [];
  for (const source of sourceBundle.expected_sources) {
    const item = sourceBundle.candidates.find((candidate) => candidate.source === source);
    if (item) representatives.push(item);
  }
  return {
    publication_title: `Sapiver Forge Daily Brief — ${DATE}`,
    intro: `Automated verification did not complete: ${reason} This edition is a source index only and must not be sent as a newsletter.`,
    stories: representatives.slice(0, 5).map((item, index) => ({
      category: index === 0 ? "lead" : "worth-knowing",
      headline: item.title,
      confirmed_fact: "Headline collected from the named source; claim verification is incomplete.",
      why_it_matters: "Human review required before any interpretation or distribution.",
      interpretation: "No Sapiver Forge interpretation generated.",
      confidence: 0,
      source: item.publisher || item.source,
      discovered_via: item.source,
      source_title: item.title,
      url: item.direct_source_url || item.url,
      discovery_url: item.discovery_url || item.url,
      link_quality: item.link_quality || "unknown",
      published_at: item.published_at || null,
      discovery_score: item.score
    })),
    practical_takeaway: "Do not publish this edition until verification succeeds.",
    watch_next: "Re-run the intelligence workflow or review the source links manually.",
    overall_confidence: 0
  };
}

function findEditorialLanguageWarnings(editorial) {
  const warnings = [];
  const patterns = [
    [/(?:\bwill dictate\b|\bwill determine\b|\bwill force\b|\bwill inevitably\b)/i, "deterministic future language"],
    [/(?:\bensuring\b|\bguarantees?\b)/i, "unsupported certainty or motive language"]
  ];
  const fields = [
    ["practical takeaway", editorial.practical_takeaway],
    ["watch next", editorial.watch_next],
    ...editorial.stories.flatMap((story, index) => [
      [`story ${index + 1} interpretation`, story.interpretation],
      [`story ${index + 1} why-it-matters`, story.why_it_matters]
    ])
  ];
  for (const [label, text] of fields) {
    for (const [pattern, description] of patterns) {
      if (pattern.test(String(text || ""))) warnings.push(`${label} contains ${description}; review wording if material.`);
    }
  }
  return [...new Set(warnings)];
}

function qualityState(result, editorial, sourceBundle) {
  const blockers = [];
  const warnings = [];

  if (!result.ok) blockers.push(result.reason || "Editorial verification failed.");
  if (editorial.stories.length < 3) blockers.push(`Only ${editorial.stories.length} publishable stories remain; at least 3 are required.`);
  if (editorial.overall_confidence < 0.78) blockers.push(`Overall confidence ${(editorial.overall_confidence * 100).toFixed(0)}% is below the 78% release threshold.`);

  const failedSources = sourceBundle.source_status.filter((entry) => !entry.ok);
  if (failedSources.length && sourceBundle.healthy_source_count >= 3) {
    warnings.push(`${failedSources.map((entry) => entry.name).join(", ")} unavailable during discovery; edition proceeded with ${sourceBundle.healthy_source_count}/5 source families.`);
  }
  const fallbackLinks = editorial.stories.filter((story) => story.link_quality !== "original");
  if (fallbackLinks.length) {
    warnings.push(`${fallbackLinks.length} selected stor${fallbackLinks.length === 1 ? "y uses" : "ies use"} a discovery fallback link because no direct publisher URL was resolved.`);
  }
  warnings.push(...findEditorialLanguageWarnings(editorial));

  const ready = blockers.length === 0;
  return {
    ready,
    status: ready ? (warnings.length ? "ready_with_warnings" : "ready") : "blocked",
    blockers,
    warnings
  };
}

function renderMarkdown(editorial) {
  return `# ${editorial.publication_title}\n\n${editorial.intro}\n\n${editorial.stories.map((story, index) => `## ${index + 1}. ${story.headline}\n\n**Confirmed:** ${story.confirmed_fact}\n\n**Why it matters:** ${story.why_it_matters}\n\n**Sapiver Forge interpretation:** ${story.interpretation}\n\n**Source:** [${story.source}](${story.url})${story.discovered_via && story.discovered_via !== story.source ? ` · discovered via ${story.discovered_via}` : ""} · confidence ${(story.confidence * 100).toFixed(0)}%`).join("\n\n")}\n\n## Practical takeaway\n\n${editorial.practical_takeaway}\n\n## What to watch next\n\n${editorial.watch_next}\n\n---\n\nSapiver Forge separates confirmed reporting from interpretation. Source links are provided so you can inspect the underlying reporting.\n`;
}

function renderNewsletterHtml(editorial) {
  const storyHtml = editorial.stories.map((story, index) => `<section style="margin:0 0 28px;padding:0 0 24px;border-bottom:1px solid #d7dedb"><p style="margin:0 0 5px;text-transform:uppercase;letter-spacing:.08em;font-size:12px;color:#68756f">${esc(story.category)} · ${esc(story.source)}</p><h2 style="font-size:22px;line-height:1.25;margin:0 0 10px">${esc(story.headline)}</h2><p style="margin:0 0 10px"><strong>What happened:</strong> ${esc(story.confirmed_fact)}</p><p style="margin:0 0 10px"><strong>Why it matters:</strong> ${esc(story.why_it_matters)}</p><p style="margin:0 0 12px"><strong>Our read:</strong> ${esc(story.interpretation)}</p><p style="margin:0"><a href="${esc(story.url)}">Open original source ${index + 1}</a></p></section>`).join("");
  return `<!doctype html><html><body style="margin:0;background:#f4f1e8;color:#10251f;font:16px/1.6 Arial,sans-serif"><main style="max-width:680px;margin:auto;background:#fff;padding:32px"><p style="text-transform:uppercase;letter-spacing:.12em;font-size:12px">Sapiver Forge Daily Brief · ${esc(DATE)}</p><h1 style="font-size:34px;line-height:1.1">${esc(editorial.publication_title)}</h1><p>${esc(editorial.intro)}</p><hr style="border:0;border-top:1px solid #d7dedb;margin:28px 0">${storyHtml}<section style="background:#f4f1e8;padding:20px;margin:26px 0"><h2 style="margin-top:0">Practical takeaway</h2><p>${esc(editorial.practical_takeaway)}</p><h3>What to watch next</h3><p>${esc(editorial.watch_next)}</p></section><p><a href="${BASE}/daily-brief/">Sapiver Forge Daily Brief archive</a> · <a href="${BASE}/podcast/">Weekly podcast</a></p><p><strong>Human-led. AI-empowered.</strong></p><p style="font-size:13px;color:#5b665f">Confirmed reporting and Sapiver Forge interpretation are labelled separately. You are receiving this because you subscribed to Sapiver Forge. <a href="{{ unsubscribe }}">Unsubscribe</a>.</p></main></body></html>`;
}

function buildSocial(editorial) {
  const lead = editorial.stories[0];
  const link = `${BASE}/daily-brief/`;
  return {
    date: DATE,
    lead_headline: lead?.headline || editorial.publication_title,
    facebook_post: lead ? `${lead.headline}\n\n${lead.why_it_matters}\n\nToday's Sapiver Forge Daily Brief covers ${editorial.stories.length} developments across AI, technology and business.\n\n${link}` : "",
    pinterest_title: lead?.headline || editorial.publication_title,
    pinterest_description: lead ? `${lead.why_it_matters}\n\nRead today's Sapiver Forge Daily Brief: ${link}` : "",
    tiktok_caption: lead ? `${lead.headline}. Today's Sapiver Forge Daily Brief separates what is confirmed from what it might mean. #SapiverForge #AI #Technology #Business` : "",
    spoken_script: lead ? `${lead.headline}. ${lead.confirmed_fact} Why it matters: ${lead.why_it_matters} That's one of today's stories in the Sapiver Forge Daily Brief.` : ""
  };
}

function renderHumanReview(editorial, sourceBundle, state) {
  const rows = editorial.stories.map((story, index) => `<tr><td>${index + 1}</td><td>${esc(story.category)}</td><td>${esc(story.headline)}</td><td>${esc(story.confirmed_fact)}</td><td>${esc(story.interpretation)}</td><td><a href="${esc(story.url)}">${esc(story.source)}</a>${story.discovered_via && story.discovered_via !== story.source ? `<br><small>via ${esc(story.discovered_via)}</small>` : ""}</td><td>${(story.confidence * 100).toFixed(0)}%</td></tr>`).join("");
  const sourceRows = sourceBundle.source_status.map((entry) => `<tr><td>${esc(entry.name)}</td><td>${entry.ok ? "OK" : "WARN"}</td><td>${entry.item_count}</td><td>${esc(entry.collection_mode || entry.error || "")}</td></tr>`).join("");
  const warningHtml = state.warnings.length ? `<section class="panel warn"><h2>Warnings — do not automatically block release</h2><ul>${state.warnings.map((warning) => `<li>${esc(warning)}</li>`).join("")}</ul></section>` : "";
  const blockerHtml = state.blockers.length ? `<section class="panel block"><h2>Release blockers</h2><ul>${state.blockers.map((blocker) => `<li>${esc(blocker)}</li>`).join("")}</ul></section>` : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sapiver Forge Daily Brief review ${DATE}</title><style>body{font:16px/1.5 system-ui;margin:0;background:#f4f1e8;color:#10251f}main{max-width:1150px;margin:auto;padding:24px}.panel{background:#fff;border:1px solid #d8e0dc;border-radius:12px;padding:18px;margin:14px 0}.warn{border-left:7px solid #d29a24}.good{border-left:7px solid #317a4f}.block{border-left:7px solid #a63b32}table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;vertical-align:top;border-bottom:1px solid #dde3e0;padding:8px}pre{white-space:pre-wrap}a{color:#075a86}</style></head><body><main><h1>Sapiver Forge Daily Brief — human review</h1><section class="panel ${state.ready ? "good" : "block"}"><h2>${state.ready ? (state.warnings.length ? "READY FOR APPROVAL — WITH NON-BLOCKING WARNINGS" : "READY FOR APPROVAL") : "BLOCKED — MATERIAL ISSUE"}</h2><p>${esc(state.reason)}</p><p>Minor source or wording warnings do not cancel the edition. Live Brevo send and current-news social distribution still require human approval.</p></section>${blockerHtml}${warningHtml}<section class="panel"><h2>Source health</h2><table><thead><tr><th>Source</th><th>Status</th><th>Items</th><th>Mode / note</th></tr></thead><tbody>${sourceRows}</tbody></table></section><section class="panel"><h2>Selected stories</h2><div style="overflow:auto"><table><thead><tr><th>#</th><th>Category</th><th>Headline</th><th>Confirmed</th><th>Interpretation</th><th>Source</th><th>Confidence</th></tr></thead><tbody>${rows}</tbody></table></div></section><section class="panel"><h2>Newsletter preview</h2>${renderNewsletterHtml(editorial)}</section></main></body></html>`;
}

function publishBridge(files) {
  fs.rmSync(BRIDGE, { recursive: true, force: true });
  ensure(BRIDGE);
  for (const name of files) fs.copyFileSync(path.join(OUT, name), path.join(BRIDGE, name));
  const hashes = {};
  for (const name of files) hashes[name] = crypto.createHash("sha256").update(fs.readFileSync(path.join(BRIDGE, name))).digest("hex");
  write(BRIDGE, "file-hashes.json", hashes);
}

async function main() {
  ensure(OUT);
  const sourceBundle = await collectNewsSources();
  write(OUT, "sources.json", sourceBundle);

  let result;
  try {
    result = await createEditorialOutput(sourceBundle);
  } catch (error) {
    result = { ok: false, reason: `Editorial generation failed: ${error.message}` };
  }

  const editorial = result.ok ? result.editorial : fallbackEditorial(sourceBundle, result.reason);
  if (result.evidence) {
    write(OUT, "verification-evidence.txt", result.evidence.text || "");
    write(OUT, "verification-grounding.json", result.evidence.groundingMetadata || {});
  }

  const state = qualityState(result, editorial, sourceBundle);
  const reason = state.ready
    ? `Verification completed with ${sourceBundle.healthy_source_count}/5 source families healthy and overall confidence ${(editorial.overall_confidence * 100).toFixed(0)}%. ${state.warnings.length ? `${state.warnings.length} non-blocking warning${state.warnings.length === 1 ? "" : "s"} recorded.` : "No quality warnings recorded."}`
    : state.blockers.join(" ");
  const social = buildSocial(editorial);
  const subject = `Sapiver Forge Daily Brief — ${DATE}`;

  const manifestCore = {
    schema_version: 1,
    type: "sapiver_forge_news_intelligence",
    date: DATE,
    generated_at: new Date().toISOString(),
    source_set: ["Techmeme", "Reuters", "Hacker News", "Hugging Face", "Sifted"],
    source_status: sourceBundle.source_status,
    healthy_source_count: sourceBundle.healthy_source_count,
    human_approval_required: true,
    approved_for_automatic_distribution: false,
    newsletter_ready_for_human_approval: state.ready,
    quality_status: state.status,
    quality_warnings: state.warnings,
    release_blockers: state.blockers,
    newsletter_subject: subject,
    overall_confidence: editorial.overall_confidence,
    stories: editorial.stories,
    practical_takeaway: editorial.practical_takeaway,
    watch_next: editorial.watch_next,
    social
  };
  const manifest = { ...manifestCore, candidate_id: hashObject(manifestCore) };

  write(OUT, "daily-brief.md", renderMarkdown(editorial));
  write(OUT, "newsletter.md", renderMarkdown(editorial));
  write(OUT, "newsletter.html", renderNewsletterHtml(editorial));
  write(OUT, "social.json", social);
  write(OUT, "manifest.json", manifest);
  write(OUT, "newsletter-metadata.json", {
    date: DATE,
    subject,
    status: state.ready ? "ready_for_human_approval" : "blocked",
    approved: false,
    brevo_campaign_id: null,
    sent_at: null,
    candidate_id: manifest.candidate_id
  });
  write(OUT, "human-review.html", renderHumanReview(editorial, sourceBundle, { ...state, reason }));

  publishBridge(["manifest.json", "daily-brief.md", "newsletter.html", "newsletter-metadata.json", "social.json", "sources.json", "human-review.html"]);
  console.log(`Built Sapiver Forge news intelligence ${DATE}: ${state.status}.`);
  console.log(`Source health: ${sourceBundle.healthy_source_count}/5. Warnings: ${state.warnings.length}. Candidate: ${manifest.candidate_id}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
