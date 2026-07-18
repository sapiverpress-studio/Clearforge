import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE = (process.env.PODCAST_BASE_URL || "https://clearforge-daily-brief.netlify.app").replace(/\/$/, "");
const sourceMp3 = process.env.SOURCE_MP3;
const sourceMp4 = process.env.SOURCE_MP4;
const metadataPath = process.env.METADATA_PATH;
const kind = process.env.PODCAST_KIND || "daily";
const slug = process.env.EPISODE_SLUG || path.basename(path.dirname(sourceMp3 || ""));
if (!sourceMp3 || !fs.existsSync(sourceMp3)) throw new Error(`Missing SOURCE_MP3: ${sourceMp3 || "(unset)"}`);
if (sourceMp4 && !fs.existsSync(sourceMp4)) throw new Error(`Missing SOURCE_MP4: ${sourceMp4}`);
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
const mp4Name = `${slug}.mp4`;
const publicMp4 = path.join(episodeDir, mp4Name);
if (sourceMp4) fs.copyFileSync(sourceMp4, publicMp4);
const videoUrl = sourceMp4 ? `${BASE}/podcast/episodes/${encodeURIComponent(mp4Name)}` : "";
const videoSize = sourceMp4 ? fs.statSync(publicMp4).size : 0;
const episodeSourceDir = path.dirname(metadataPath);
const transcriptSource = path.join(episodeSourceDir, "COPY_PASTE_INTO_ELEVENLABS.txt");
const transcriptName = `${slug}.txt`;
const transcriptUrl = `${BASE}/podcast/episodes/${encodeURIComponent(transcriptName)}`;
if (fs.existsSync(transcriptSource)) fs.copyFileSync(transcriptSource, path.join(episodeDir, transcriptName));

const sourceNotesPath = path.join(episodeSourceDir, "source-notes.md");
const structuredOutputPath = path.resolve(episodeSourceDir, "..", "structured_output.json");
let facebookPost = "";
if (fs.existsSync(structuredOutputPath)) {
  try {
    const structured = JSON.parse(fs.readFileSync(structuredOutputPath, "utf8"));
    facebookPost = structured?.social?.facebook_post || structured?.facebook?.post || "";
  } catch (error) {
    console.warn(`Could not read Facebook copy from ${structuredOutputPath}: ${error.message}`);
  }
}
if (facebookPost && !/newsletter|weekly digest/i.test(facebookPost)) {
  facebookPost = `${facebookPost.trim()}\n\nWant one calm weekly roundup of what changed, why it matters and what is worth testing? Sign up to the free Clearforge weekly newsletter: ${BASE}/newsletter/`;
}
const sourceNotes = fs.existsSync(sourceNotesPath) ? fs.readFileSync(sourceNotesPath, "utf8").trim() : "";
const dateSlug = slug.match(/^\d{4}-\d{2}-\d{2}(?:-[a-z0-9-]+)?/i)?.[0] || slug;
const relatedArticleUrl = `${BASE}/posts/${encodeURIComponent(dateSlug)}.html`;
const relatedFeatureUrl = `${BASE}/features/${encodeURIComponent(dateSlug)}.html`;

const dbPath = path.join(outDir, "episodes.json");
const existing = fs.existsSync(dbPath) ? JSON.parse(fs.readFileSync(dbPath, "utf8")) : [];
const episode = {
  slug,
  kind,
  title,
  description,
  published,
  duration,
  size,
  video_size: videoSize,
  audio_url: audioUrl,
  video_url: videoUrl,
  episode_url: episodeUrl,
  transcript_url: fs.existsSync(transcriptSource) ? transcriptUrl : "",
  related_article_url: relatedArticleUrl,
  related_feature_url: relatedFeatureUrl,
  source_dir: path.relative(ROOT, episodeSourceDir).replaceAll("\\", "/"),
  archived: false,
  archive_url: ""
};
const episodes = [episode, ...existing.filter((item) => item.slug !== slug)]
  .sort((a, b) => new Date(b.published) - new Date(a.published));

const esc = (value) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&apos;");
const htmlEsc = (value) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const rfc822 = (value) => new Date(value).toUTCString();
const markdownNotesToHtml = (value) => value
  .split(/\r?\n/)
  .filter((line) => line.trim())
  .map((line) => {
    const linked = htmlEsc(line.replace(/^#+\s*/, "")).replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>');
    return line.startsWith("#") ? `<h3>${linked}</h3>` : line.startsWith("- ") ? `<p>• ${linked.slice(2)}</p>` : `<p>${linked}</p>`;
  }).join("\n");

const episodeNotesHtml = (item) => `<p>${htmlEsc(item.description)}</p><p><strong>Read alongside this episode:</strong> <a href="${htmlEsc(item.related_article_url)}">daily briefing</a> · <a href="${htmlEsc(item.related_feature_url)}">feature analysis</a></p><p><a href="${htmlEsc(item.episode_url)}">Episode page and sources</a></p>`;
const items = episodes.map((item) => `    <item>
      <title>${esc(item.title)}</title>
      <description>${esc(item.description)}</description>
      <content:encoded><![CDATA[${episodeNotesHtml(item)}]]></content:encoded>
      <link>${esc(item.episode_url)}</link>
      <guid isPermaLink="false">clearforge:${esc(item.slug)}</guid>
      <pubDate>${rfc822(item.published)}</pubDate>
      <enclosure url="${esc(item.audio_url)}" length="${item.size}" type="audio/mpeg"/>
      <itunes:author>Clearforge</itunes:author>
      <itunes:episodeType>full</itunes:episodeType>
      <itunes:explicit>false</itunes:explicit>
      ${item.duration ? `<itunes:duration>${esc(item.duration)}</itunes:duration>` : ""}
      ${item.transcript_url ? `<podcast:transcript url="${esc(item.transcript_url)}" type="text/plain"/>` : ""}
    </item>`).join("\n");

const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:podcast="https://podcastindex.org/namespace/1.0">
  <channel>
    <title>Clearforge AI Briefing</title>
    <link>${BASE}/podcast/</link>
    <description>AI news is noisy. Clearforge explains what changed, who is adopting it, why it matters and what is worth testing next.</description>
    <language>en-gb</language>
    <managingEditor>clearforge@sapiverpress.co.uk (Clearforge)</managingEditor>
    <copyright>Clearforge</copyright>
    <generator>Clearforge hosted podcast feed</generator>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${BASE}/podcast/feed.xml" rel="self" type="application/rss+xml"/>
    <itunes:author>Clearforge</itunes:author>
    <itunes:owner>
      <itunes:name>Clearforge</itunes:name>
      <itunes:email>clearforge@sapiverpress.co.uk</itunes:email>
    </itunes:owner>
    <itunes:summary>Human-led, practical AI learning without the hype. Daily briefings, weekly learning editions and focused research into real-world AI adoption.</itunes:summary>
    <itunes:type>episodic</itunes:type>
    <itunes:explicit>false</itunes:explicit>
    <itunes:category text="Education"><itunes:category text="How To"/></itunes:category>
    <itunes:image href="${BASE}/podcast/cover.png"/>
${items}
  </channel>
</rss>
`;

const platforms = `<nav class="platforms" aria-label="Listen on podcast platforms"><a href="https://open.spotify.com/show/033OE4kukRlRAdyj9thlIW">Spotify</a><a href="https://www.youtube.com/playlist?list=PLAfD5uKmtbYA">YouTube Podcasts</a><a href="https://tunein.com/radio/p4767014">TuneIn</a><a href="https://music.amazon.co.uk/podcasts/8d3316de-09fa-4934-8bfe-28b4a5b576a7/clearforge-ai-briefing">Amazon Music</a><a href="/podcast/feed.xml">RSS feed</a></nav>`;
const cards = episodes.map((item) => `<article><p class="kind">${htmlEsc(item.kind)}${item.archived ? " · archived" : ""}</p><h2><a href="/podcast/episodes/${encodeURIComponent(item.slug)}.html">${htmlEsc(item.title)}</a></h2><p>${htmlEsc(item.description)}</p><audio controls preload="none" src="${htmlEsc(item.audio_url)}"></audio><p><a href="${htmlEsc(item.episode_url)}">Show notes</a> · <a href="${htmlEsc(item.related_article_url)}">Daily briefing</a> · ${item.archived && item.archive_url ? `<a href="${htmlEsc(item.archive_url)}">Complete ZIP archive</a>` : `<a href="${htmlEsc(item.audio_url)}">MP3</a>${item.video_url ? ` · <a href="${htmlEsc(item.video_url)}">MP4</a>` : ""}`}</p></article>`).join("\n");
const podcastSchema = JSON.stringify({ "@context": "https://schema.org", "@type": "PodcastSeries", name: "Clearforge AI Briefing", description: "Practical AI news, adoption analysis and workflow learning without the hype.", url: `${BASE}/podcast/`, webFeed: `${BASE}/podcast/feed.xml`, image: `${BASE}/podcast/cover.png`, author: { "@type": "Organization", name: "Clearforge" } }).replace(/</g, "\\u003c");
const index = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Clearforge AI Briefing Podcast</title><meta name="description" content="Practical AI news, real-world adoption analysis and useful workflow learning without the hype."><link rel="canonical" href="${BASE}/podcast/"><meta property="og:type" content="website"><meta property="og:title" content="Clearforge AI Briefing Podcast"><meta property="og:description" content="What changed, who is adopting it, why it matters and what is worth testing next."><meta property="og:image" content="${BASE}/podcast/cover.png"><link rel="alternate" type="application/rss+xml" title="Clearforge AI Briefing" href="/podcast/feed.xml"><script type="application/ld+json">${podcastSchema}</script><style>body{margin:0;background:#07111f;color:#eef4ff;font:17px/1.6 system-ui}main{max-width:900px;margin:auto;padding:48px 20px}a{color:#66a7ff}.platforms{display:flex;flex-wrap:wrap;gap:10px;margin:22px 0 34px}.platforms a{display:inline-block;padding:10px 14px;border:1px solid #345274;border-radius:999px;background:#101d30;text-decoration:none;font-weight:650}.platforms a:hover{background:#172a43}article{background:#101d30;border:1px solid #263b59;border-radius:18px;padding:24px;margin:24px 0}audio{width:100%}.kind{text-transform:uppercase;letter-spacing:.12em;color:#78aef5;font-size:.75rem}h1,h2{line-height:1.15}</style></head><body><main><p><a href="/">Clearforge</a> · Human-led. AI-empowered.</p><h1>Clearforge AI Briefing</h1><p>Practical AI learning without the hype. Each episode explains what changed, who is adopting it, why it matters and what is worth testing.</p>${platforms}${cards || "<p>The first hosted episode is being prepared.</p>"}<p><a href="/topics/">Explore Clearforge topics</a> · <a href="/newsletter/">Join the weekly digest</a></p></main></body></html>`;

const currentIndex = episodes.findIndex((item) => item.slug === slug);
const newer = currentIndex > 0 ? episodes[currentIndex - 1] : null;
const older = currentIndex >= 0 && currentIndex < episodes.length - 1 ? episodes[currentIndex + 1] : null;
const episodeSchema = JSON.stringify({ "@context": "https://schema.org", "@type": "PodcastEpisode", name: title, description, datePublished: published, url: episodeUrl, associatedMedia: { "@type": "MediaObject", contentUrl: audioUrl, encodingFormat: "audio/mpeg" }, partOfSeries: { "@type": "PodcastSeries", name: "Clearforge AI Briefing", url: `${BASE}/podcast/` }, author: { "@type": "Organization", name: "Clearforge" } }).replace(/</g, "\\u003c");
const episodeNav = `<nav aria-label="Episode navigation">${newer ? `<a href="/podcast/episodes/${encodeURIComponent(newer.slug)}.html">← Newer episode</a>` : ""}${newer && older ? " · " : ""}${older ? `<a href="/podcast/episodes/${encodeURIComponent(older.slug)}.html">Older episode →</a>` : ""}</nav>`;
const notesHtml = sourceNotes ? `<section><h2>Sources and notes</h2>${markdownNotesToHtml(sourceNotes)}</section>` : "";
const facebookCopyHtml = facebookPost ? `<section style="margin:30px 0;padding:22px;background:#101d30;border:1px solid #263b59;border-radius:16px"><h2>Share this episode</h2><p>Want to share this episode with your audience? Download the video above and use the suggested caption below.</p><textarea id="facebook-post-copy" readonly style="box-sizing:border-box;width:100%;min-height:280px;padding:14px;border:1px solid #345274;border-radius:10px;background:#07111f;color:#eef4ff;font:15px/1.5 system-ui">${htmlEsc(facebookPost)}</textarea><p><button type="button" onclick="navigator.clipboard.writeText(document.getElementById('facebook-post-copy').value).then(() => { this.textContent='Caption copied'; }).catch(() => { document.getElementById('facebook-post-copy').select(); })" style="padding:12px 18px;border:0;border-radius:999px;background:#66a7ff;color:#07111f;font-weight:750;cursor:pointer">Copy caption</button></p><p style="color:#b8c9df">You’re welcome to personalise the caption before sharing, and join the conversation in the comments.</p></section>` : "";
const episodePage = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${htmlEsc(title)} | Clearforge AI Briefing</title><meta name="description" content="${htmlEsc(description)}"><link rel="canonical" href="${episodeUrl}"><meta property="og:type" content="article"><meta property="og:title" content="${htmlEsc(title)}"><meta property="og:description" content="${htmlEsc(description)}"><meta property="og:url" content="${episodeUrl}"><meta property="og:image" content="${BASE}/podcast/cover.png"><meta property="og:audio" content="${audioUrl}"><script type="application/ld+json">${episodeSchema}</script></head><body style="max-width:800px;margin:40px auto;padding:0 20px;font:17px/1.6 system-ui;background:#07111f;color:#eef4ff"><p><a style="color:#66a7ff" href="/">Clearforge</a> · <a style="color:#66a7ff" href="/podcast/">AI Briefing Podcast</a> · <a style="color:#66a7ff" href="/archive/">Archive</a></p><article><p style="text-transform:uppercase;letter-spacing:.12em;color:#78aef5;font-size:.75rem">${htmlEsc(kind)} · ${htmlEsc(cleanDate)}</p><h1>${htmlEsc(title)}</h1><p>${htmlEsc(description)}</p><audio style="width:100%" controls src="${htmlEsc(audioUrl)}"></audio><p data-episode-downloads><a style="color:#66a7ff" href="${htmlEsc(audioUrl)}">Download MP3</a>${videoUrl ? ` · <a style="color:#66a7ff" href="${htmlEsc(videoUrl)}">Download full MP4 for Facebook/YouTube</a>` : ""}${fs.existsSync(transcriptSource) ? ` · <a style="color:#66a7ff" href="${htmlEsc(transcriptUrl)}">Read transcript</a>` : ""}</p>${facebookCopyHtml}<section><h2>Continue with Clearforge</h2><ul><li><a style="color:#66a7ff" href="${htmlEsc(relatedArticleUrl)}">Read the daily briefing</a></li><li><a style="color:#66a7ff" href="${htmlEsc(relatedFeatureUrl)}">Read the feature analysis</a></li><li><a style="color:#66a7ff" href="/topics/">Explore topic guides</a></li><li><a style="color:#66a7ff" href="/newsletter/">Join the weekly digest</a></li></ul></section>${notesHtml}${episodeNav}</article></body></html>`;

fs.writeFileSync(dbPath, JSON.stringify(episodes, null, 2) + "\n");
fs.writeFileSync(path.join(outDir, "feed.xml"), feed);
fs.writeFileSync(path.join(outDir, "index.html"), index);
fs.writeFileSync(path.join(episodeDir, `${slug}.html`), episodePage);
console.log(`Published ${title} to ${audioUrl}, exposed discovery notes and rebuilt ${BASE}/podcast/feed.xml`);
