import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE = (process.env.PODCAST_BASE_URL || "https://clearforge-daily-brief.netlify.app").replace(/\/$/, "");
const sourceMp3 = process.env.SOURCE_MP3;
const metadataPath = process.env.METADATA_PATH;
const kind = process.env.PODCAST_KIND || "daily";
const slug = process.env.EPISODE_SLUG || path.basename(path.dirname(sourceMp3 || ""));
if (!sourceMp3 || !fs.existsSync(sourceMp3)) throw new Error(`Missing SOURCE_MP3: ${sourceMp3 || "(unset)"}`);
if (!metadataPath || !fs.existsSync(metadataPath)) throw new Error(`Missing METADATA_PATH: ${metadataPath || "(unset)"}`);
if (!/^[a-z0-9][a-z0-9-]*$/i.test(slug)) throw new Error(`Unsafe episode slug: ${slug}`);

const outDir = path.join(ROOT, "public", "podcast");
const episodeDir = path.join(outDir, "episodes");
fs.mkdirSync(episodeDir, { recursive: true });

const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
const inner = metadata.episode || metadata;
const title = inner.episode_title || metadata.episode_title || inner.selected_story_title || `Clearforge AI Briefing — ${slug}`;
const description = inner.episode_description || metadata.episode_description || inner.selection_reason || metadata.selection_reason || "A calm, practical Clearforge briefing on the AI developments that matter to creators, small businesses and practical learners.";
const cleanDate = (inner.date || metadata.date || slug).match(/\d{4}-\d{2}-\d{2}/)?.[0];
if (!cleanDate) throw new Error("Episode metadata needs an ISO date.");
const published = inner.published_at || metadata.published_at || `${cleanDate}T07:00:00+01:00`;
const minutes = Number(inner.estimated_duration_minutes || metadata.estimated_duration_minutes || 0);
const duration = minutes > 0 ? new Date(Math.round(minutes * 60) * 1000).toISOString().slice(11, 19) : "";
const mp3Name = `${slug}.mp3`;
const publicMp3 = path.join(episodeDir, mp3Name);
fs.copyFileSync(sourceMp3, publicMp3);
const size = fs.statSync(publicMp3).size;
const episodeUrl = `${BASE}/podcast/episodes/${encodeURIComponent(slug)}.html`;
const audioUrl = `${BASE}/podcast/episodes/${encodeURIComponent(mp3Name)}`;

const dbPath = path.join(outDir, "episodes.json");
const existing = fs.existsSync(dbPath) ? JSON.parse(fs.readFileSync(dbPath, "utf8")) : [];
const episode = { slug, kind, title, description, published, duration, size, audio_url: audioUrl, episode_url: episodeUrl };
const episodes = [episode, ...existing.filter((item) => item.slug !== slug)]
  .sort((a, b) => new Date(b.published) - new Date(a.published));

const esc = (value) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&apos;");
const htmlEsc = (value) => esc(value);
const rfc822 = (value) => new Date(value).toUTCString();

const items = episodes.map((item) => `    <item>
      <title>${esc(item.title)}</title>
      <description>${esc(item.description)}</description>
      <link>${esc(item.episode_url)}</link>
      <guid isPermaLink="false">clearforge:${esc(item.slug)}</guid>
      <pubDate>${rfc822(item.published)}</pubDate>
      <enclosure url="${esc(item.audio_url)}" length="${item.size}" type="audio/mpeg"/>
      <itunes:author>Clearforge</itunes:author>
    <itunes:owner>
      <itunes:name>Clearforge</itunes:name>
      <itunes:email>clearforge@sapiverpress.co.uk</itunes:email>
    </itunes:owner>
      <itunes:episodeType>full</itunes:episodeType>
      <itunes:explicit>false</itunes:explicit>
      ${item.duration ? `<itunes:duration>${esc(item.duration)}</itunes:duration>` : ""}
    </item>`).join("\n");

const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Clearforge AI Briefing</title>
    <link>${BASE}/podcast/</link>
    <description>AI news is noisy. Clearforge turns it into clear, usable learning and content for creators, small businesses and practical AI learners.</description>
    <language>en-gb</language>
    <copyright>Clearforge</copyright>
    <generator>Clearforge hosted podcast feed</generator>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${BASE}/podcast/feed.xml" rel="self" type="application/rss+xml"/>
    <itunes:author>Clearforge</itunes:author>
    <itunes:summary>Human-led, practical AI learning without the hype. Daily briefings, weekly learning editions and focused major-release research.</itunes:summary>
    <itunes:type>episodic</itunes:type>
    <itunes:explicit>false</itunes:explicit>
    <itunes:category text="Education">
      <itunes:category text="How To"/>
    </itunes:category>
    <itunes:image href="${BASE}/podcast/cover.png"/>
${items}
  </channel>
</rss>
`;

const cards = episodes.map((item) => `<article><p class="kind">${htmlEsc(item.kind)}</p><h2>${htmlEsc(item.title)}</h2><p>${htmlEsc(item.description)}</p><audio controls preload="none" src="${htmlEsc(item.audio_url)}"></audio><p><a href="${htmlEsc(item.audio_url)}">Download MP3</a></p></article>`).join("\n");
const index = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Clearforge AI Briefing Podcast</title><style>body{margin:0;background:#07111f;color:#eef4ff;font:17px/1.6 system-ui}main{max-width:900px;margin:auto;padding:48px 20px}a{color:#66a7ff}article{background:#101d30;border:1px solid #263b59;border-radius:18px;padding:24px;margin:24px 0}audio{width:100%}.kind{text-transform:uppercase;letter-spacing:.12em;color:#78aef5;font-size:.75rem}h1,h2{line-height:1.15}</style></head><body><main><p>Human-led. AI-empowered.</p><h1>Clearforge AI Briefing</h1><p>Practical AI learning without the hype. Subscribe through <a href="/podcast/feed.xml">the RSS feed</a> or <a href="https://open.spotify.com/show/033OE4kukRlRAdyj9thlIW">listen on Spotify</a>.</p>${cards || "<p>The first hosted episode is being prepared.</p>"}</main></body></html>`;

const episodePage = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${htmlEsc(title)} | Clearforge</title></head><body style="max-width:800px;margin:40px auto;padding:0 20px;font:17px/1.6 system-ui;background:#07111f;color:#eef4ff"><p><a style="color:#66a7ff" href="/podcast/">Clearforge AI Briefing</a></p><h1>${htmlEsc(title)}</h1><p>${htmlEsc(description)}</p><audio style="width:100%" controls src="${htmlEsc(audioUrl)}"></audio><p><a style="color:#66a7ff" href="${htmlEsc(audioUrl)}">Download MP3</a></p></body></html>`;

fs.writeFileSync(dbPath, JSON.stringify(episodes, null, 2) + "\n");
fs.writeFileSync(path.join(outDir, "feed.xml"), feed);
fs.writeFileSync(path.join(outDir, "index.html"), index);
fs.writeFileSync(path.join(episodeDir, `${slug}.html`), episodePage);
console.log(`Published ${title} to ${audioUrl} and rebuilt ${BASE}/podcast/feed.xml`);
