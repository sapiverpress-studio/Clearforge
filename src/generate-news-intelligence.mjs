import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { collectNewsSources } from "./news-intelligence-sources.mjs";
import { generateGroundedEvidence, generateStructured } from "./gemini-provider.mjs";

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

function candidateLines(candidates) {
  return candidates.map((item, index) => [
    `[${index}] ${item.source} | score ${item.score}`,
    `Title: ${item.title}`,
    `URL: ${item.url}`,
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

  const evidencePrompt = `You are the evidence desk for Sapiver Forge. Verify the news candidates below for the ${DATE} UK morning briefing.\n\nUse Google Search grounding to check whether each significant candidate is current and accurately characterised. Prefer primary sources, company announcements, filings, papers and Reuters for confirmation. Treat Techmeme and Hacker News as discovery signals, not proof. Treat Hugging Face paper summaries as claims made by the paper unless independently corroborated. Do not invent facts.\n\nProduce concise evidence notes for the strongest candidates. For each one state the candidate number, what is confirmed, important caveats, and whether it is suitable for publication today. If a claim cannot be checked, say so.\n\nCANDIDATES:\n\n${candidateLines(candidates)}`;

  const evidence = await generateGroundedEvidence({
    system: "You are a cautious news verification editor. Separate confirmed facts from interpretation and uncertainty.",
    prompt: evidencePrompt
  });

  const structured = await generateStructured({
    system: [
      "You edit the Sapiver Forge Daily Brief for practical UK readers interested in AI, technology and business.",
      "Use only facts supported by the supplied candidate metadata and verification evidence.",
      "Never turn speculation into fact. Keep interpretation clearly labelled as interpretation.",
      "Select a broad mix rather than five versions of the same AI story.",
      "Prefer consequential developments over novelty. Avoid hype, clickbait and investment advice."
    ],
    prompt: `Build today's short daily intelligence edition from the verified evidence. Aim for a 3-5 minute read.\n\nRules:\n- Choose 3 to 6 stories.\n- source_index MUST refer to one of the numbered candidates below.\n- Use one lead story and cover AI, technology/business/research where genuinely available.\n- confirmed_fact should be one or two concise sentences.\n- why_it_matters should explain practical significance.\n- interpretation must use cautious language such as "Our read" where it goes beyond confirmed fact.\n- confidence is 0 to 1. Do not include a story below 0.72 confidence.\n- overall_confidence is 0 to 1.\n\nVERIFICATION EVIDENCE:\n${evidence.text}\n\nCANDIDATES:\n${candidateLines(candidates)}`,
    schema: STORY_SCHEMA
  });

  const seen = new Set();
  const mapped = [];
  for (const story of Array.isArray(structured.stories) ? structured.stories : []) {
    const index = Number(story.source_index);
    const candidate = candidates[index];
    if (!candidate || seen.has(index)) continue;
    const confidence = Math.max(0, Math.min(1, Number(story.confidence || 0)));
    if (confidence < 0.72) continue;
    seen.add(index);
    mapped.push({
      category: clean(story.category || "worth-knowing"),
      headline: clean(story.headline || candidate.title),
      confirmed_fact: clean(story.confirmed_fact),
      why_it_matters: clean(story.why_it_matters),
      interpretation: clean(story.interpretation),
      confidence,
      source: candidate.source,
      source_title: candidate.title,
      url: candidate.url,
      published_at: candidate.published_at || null,
      discovery_score: candidate.score
    });
  }
  if (mapped.length < 3) return { ok: false, reason: "Verification did not leave at least three publishable stories.", evidence };

  return {
    ok: true,
    evidence,
    editorial: {
      publication_title: clean(structured.publication_title || `Sapiver Forge Daily Brief — ${DATE}`),
      intro: clean(structured.intro),
      stories: mapped.slice(0, 6),
      practical_takeaway: clean(structured.practical_takeaway),
      watch_next: clean(structured.watch_next),
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
      source: item.source,
      source_title: item.title,
      url: item.url,
      published_at: item.published_at || null,
      discovery_score: item.score
    })),
    practical_takeaway: "Do not publish this edition until verification succeeds.",
    watch_next: "Re-run the intelligence workflow or review the source links manually.",
    overall_confidence: 0
  };
}

function renderMarkdown(editorial) {
  return `# ${editorial.publication_title}\n\n${editorial.intro}\n\n${editorial.stories.map((story, index) => `## ${index + 1}. ${story.headline}\n\n**Confirmed:** ${story.confirmed_fact}\n\n**Why it matters:** ${story.why_it_matters}\n\n**Sapiver Forge interpretation:** ${story.interpretation}\n\n**Source:** [${story.source}](${story.url}) · confidence ${(story.confidence * 100).toFixed(0)}%`).join("\n\n")}\n\n## Practical takeaway\n\n${editorial.practical_takeaway}\n\n## What to watch next\n\n${editorial.watch_next}\n\n---\n\nSapiver Forge separates confirmed reporting from interpretation. Source links are provided so you can inspect the underlying reporting.\n`;
}

function renderNewsletterHtml(editorial) {
  const storyHtml = editorial.stories.map((story, index) => `<section style="margin:0 0 28px;padding:0 0 24px;border-bottom:1px solid #d7dedb"><p style="margin:0 0 5px;text-transform:uppercase;letter-spacing:.08em;font-size:12px;color:#68756f">${esc(story.category)} · ${esc(story.source)}</p><h2 style="font-size:22px;line-height:1.25;margin:0 0 10px">${esc(story.headline)}</h2><p style="margin:0 0 10px"><strong>What happened:</strong> ${esc(story.confirmed_fact)}</p><p style="margin:0 0 10px"><strong>Why it matters:</strong> ${esc(story.why_it_matters)}</p><p style="margin:0 0 12px"><strong>Our read:</strong> ${esc(story.interpretation)}</p><p style="margin:0"><a href="${esc(story.url)}">Open source ${index + 1}</a></p></section>`).join("");
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
  const rows = editorial.stories.map((story, index) => `<tr><td>${index + 1}</td><td>${esc(story.category)}</td><td>${esc(story.headline)}</td><td>${esc(story.confirmed_fact)}</td><td>${esc(story.interpretation)}</td><td><a href="${esc(story.url)}">${esc(story.source)}</a></td><td>${(story.confidence * 100).toFixed(0)}%</td></tr>`).join("");
  const sourceRows = sourceBundle.source_status.map((entry) => `<tr><td>${esc(entry.name)}</td><td>${entry.ok ? "OK" : "FAILED"}</td><td>${entry.item_count}</td><td>${esc(entry.error || "")}</td></tr>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sapiver Forge Daily Brief review ${DATE}</title><style>body{font:16px/1.5 system-ui;margin:0;background:#f4f1e8;color:#10251f}main{max-width:1150px;margin:auto;padding:24px}.panel{background:#fff;border:1px solid #d8e0dc;border-radius:12px;padding:18px;margin:14px 0}.warn{border-left:7px solid #d29a24}.good{border-left:7px solid #317a4f}table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;vertical-align:top;border-bottom:1px solid #dde3e0;padding:8px}pre{white-space:pre-wrap}a{color:#075a86}</style></head><body><main><h1>Sapiver Forge Daily Brief — human review</h1><section class="panel ${state.ready ? "good" : "warn"}"><h2>${state.ready ? "VERIFIED DRAFT — HUMAN APPROVAL REQUIRED" : "NOT READY FOR DISTRIBUTION"}</h2><p>${esc(state.reason)}</p><p>Automatic social distribution remains disabled for current news. A live Brevo send must be explicitly approved.</p></section><section class="panel"><h2>Source health</h2><table><thead><tr><th>Source</th><th>Status</th><th>Items</th><th>Problem</th></tr></thead><tbody>${sourceRows}</tbody></table></section><section class="panel"><h2>Selected stories</h2><div style="overflow:auto"><table><thead><tr><th>#</th><th>Category</th><th>Headline</th><th>Confirmed</th><th>Interpretation</th><th>Source</th><th>Confidence</th></tr></thead><tbody>${rows}</tbody></table></div></section><section class="panel"><h2>Newsletter preview</h2>${renderNewsletterHtml(editorial)}</section></main></body></html>`;
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
  const ready = Boolean(result.ok && editorial.overall_confidence >= 0.78 && sourceBundle.healthy_source_count >= 3);
  const reason = ready
    ? `Verification completed with ${sourceBundle.healthy_source_count}/5 sources healthy and overall confidence ${(editorial.overall_confidence * 100).toFixed(0)}%.`
    : result.reason || `Overall confidence ${(editorial.overall_confidence * 100).toFixed(0)}% is below the release threshold.`;
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
    newsletter_ready_for_human_approval: ready,
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
    status: ready ? "ready_for_human_approval" : "blocked",
    approved: false,
    brevo_campaign_id: null,
    sent_at: null,
    candidate_id: manifest.candidate_id
  });
  write(OUT, "human-review.html", renderHumanReview(editorial, sourceBundle, { ready, reason }));

  publishBridge(["manifest.json", "daily-brief.md", "newsletter.html", "newsletter-metadata.json", "social.json", "sources.json", "human-review.html"]);
  console.log(`Built Sapiver Forge news intelligence ${DATE}: ${ready ? "verified draft" : "blocked draft"}.`);
  console.log(`Source health: ${sourceBundle.healthy_source_count}/5. Candidate: ${manifest.candidate_id}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
