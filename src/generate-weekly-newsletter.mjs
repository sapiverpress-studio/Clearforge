import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE = String(process.env.BLOG_BASE_URL || "https://sapiverforge-daily-brief.netlify.app").replace(/\/$/, "");
const today = process.env.CLEARFORGE_WEEK_END || new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());
const end = new Date(`${today}T12:00:00Z`);
const start = new Date(end); start.setUTCDate(start.getUTCDate() - 6);
const iso = (d) => d.toISOString().slice(0, 10);
const weekStart = iso(start);
const draftsDir = path.join(ROOT, "drafts");
const outDir = path.join(ROOT, "newsletters", today);
fs.mkdirSync(outDir, { recursive: true });

const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
const esc = (value) => clean(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const inWindow = (name) => /^\d{4}-\d{2}-\d{2}$/.test(name) && name >= weekStart && name <= today;
const entries = [];

if (fs.existsSync(draftsDir)) {
  for (const date of fs.readdirSync(draftsDir).filter(inWindow).sort()) {
    const dir = path.join(draftsDir, date);
    const approvalPath = path.join(dir, "approval.json");
    const structuredPath = path.join(dir, "structured_output.json");
    if (!fs.existsSync(approvalPath) || !fs.existsSync(structuredPath)) continue;
    const approval = JSON.parse(fs.readFileSync(approvalPath, "utf8"));
    if (approval.article_approved !== true) continue;
    const data = JSON.parse(fs.readFileSync(structuredPath, "utf8"));
    const featurePath = path.join(dir, "feature.json");
    const feature = fs.existsSync(featurePath) ? JSON.parse(fs.readFileSync(featurePath, "utf8")) : null;
    const podcastMeta = path.join(dir, "podcast", "episode-metadata.json");
    const podcast = fs.existsSync(podcastMeta) ? JSON.parse(fs.readFileSync(podcastMeta, "utf8")) : null;
    const stories = Array.isArray(data.stories) ? data.stories : [];
    entries.push({
      date,
      headline: clean(data.headline || `Sapiver Forge brief ${date}`),
      dek: clean(data.dek || data.practical_takeaway || ""),
      interpretation: clean(data.interpretation || stories[0]?.why_it_matters || stories[0]?.practical_angle || ""),
      featureHeadline: clean(feature?.feature_headline || ""),
      episodeTitle: clean(podcast?.episode?.episode_title || podcast?.episode_title || "")
    });
  }
}

if (!entries.length) throw new Error(`No approved Sapiver Forge editions found from ${weekStart} to ${today}.`);
const latest = entries.at(-1);
const items = entries.slice(-5).reverse();
const storyLedHeadline = clean(items[0]?.headline || latest.headline || "This week in practical AI");
const subject = `Sapiver Forge Weekly Digest — ${today}`;
const intro = "AI news moved quickly this week. Here are the developments worth carrying forward, without the noise.";
const outlookBasis = latest.interpretation || latest.dek;
const outlook = `Our current read: ${outlookBasis} Over the next week, watch for clearer evidence of how this moves from announcement to normal use. This is an informed outlook, not a confirmed outcome.`;
const latestPodcast = [...entries].reverse().find((x) => x.episodeTitle);
const latestFeature = [...entries].reverse().find((x) => x.featureHeadline);

const markdown = `# ${storyLedHeadline}\n\n*${subject}*\n\n${intro}\n\n## The week in practical AI\n\n${items.map((x) => `### ${x.headline}\n${x.dek}\n\n[Read the briefing](${BASE}/posts/${x.date}.html)`).join("\n\n")}\n\n## What we expect next week\n\n${outlook}\n\n${latestFeature ? `## Go deeper\n\n**${latestFeature.featureHeadline}**\n\n[Read the feature analysis](${BASE}/features/${latestFeature.date}.html)\n\n` : ""}${latestPodcast ? `## Listen on the go\n\n**${latestPodcast.episodeTitle}**\n\n[Open Sapiver Forge AI Briefing](${BASE}/podcast/)\n\n` : ""}## Keep following Sapiver Forge\n\n- [Latest Sapiver Forge briefing](${BASE}/)\n- [Podcast](${BASE}/podcast/)\n- [Reports](${BASE}/reports/)\n\nHuman-led. AI-empowered.\n\nYou are receiving this because you subscribed to the Sapiver Forge Weekly Digest. [Unsubscribe]({{ unsubscribe }})\n`;

const htmlItems = items.map((x) => `<section style="margin:0 0 28px"><h2 style="font-size:22px;line-height:1.25;margin:0 0 8px">${esc(x.headline)}</h2><p style="margin:0 0 12px">${esc(x.dek)}</p><p><a href="${BASE}/posts/${x.date}.html">Read the briefing</a></p></section>`).join("");
const html = `<!doctype html><html><body style="margin:0;background:#f4f1e8;color:#10251f;font:16px/1.6 Arial,sans-serif"><main style="max-width:680px;margin:auto;background:#fff;padding:32px"><p style="text-transform:uppercase;letter-spacing:.12em">Sapiver Forge Weekly Digest · ${esc(today)}</p><h1 style="font-size:34px;line-height:1.1">${esc(storyLedHeadline)}</h1><p>${esc(intro)}</p><hr>${htmlItems}<section style="background:#f4f1e8;padding:20px;margin:26px 0"><h2>What we expect next week</h2><p>${esc(outlook)}</p></section>${latestFeature ? `<section><h2>Go deeper</h2><p><strong>${esc(latestFeature.featureHeadline)}</strong></p><p><a href="${BASE}/features/${latestFeature.date}.html">Read the feature analysis</a></p></section>` : ""}${latestPodcast ? `<section><h2>Listen on the go</h2><p><strong>${esc(latestPodcast.episodeTitle)}</strong></p><p><a href="${BASE}/podcast/">Open Sapiver Forge AI Briefing</a></p></section>` : ""}<hr><p><a href="${BASE}/">Sapiver Forge</a> · <a href="${BASE}/podcast/">Podcast</a> · <a href="${BASE}/reports/">Reports</a></p><p><strong>Human-led. AI-empowered.</strong></p><p style="font-size:13px;color:#5b665f">You are receiving this because you subscribed to the Sapiver Forge Weekly Digest. <a href="{{ unsubscribe }}">Unsubscribe</a>.</p></main></body></html>`;

fs.writeFileSync(path.join(outDir, "email.md"), markdown);
fs.writeFileSync(path.join(outDir, "email.html"), html);
fs.writeFileSync(path.join(outDir, "metadata.json"), JSON.stringify({ subject, publication_title: storyLedHeadline, week_start: weekStart, week_end: today, edition_count: entries.length, status: "ready_to_send", send_automatically: true, includes_weekly_outlook: true }, null, 2) + "\n");
console.log(`Generated send-ready weekly newsletter for ${weekStart} to ${today}. Story-led headline: ${storyLedHeadline}`);
