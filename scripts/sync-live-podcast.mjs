import fs from "node:fs";
import path from "node:path";

const base = "https://clearforge-daily-brief.netlify.app";
const root = path.join(process.cwd(), "public", "podcast");
const episodesDir = path.join(root, "episodes");
fs.mkdirSync(episodesDir, { recursive: true });

async function download(url, destination, expectedType) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not recover ${url}: HTTP ${response.status}`);
  const type = response.headers.get("content-type") || "";
  if (expectedType && !type.includes(expectedType)) {
    throw new Error(`Unexpected content type for ${url}: ${type}`);
  }
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length === 0) throw new Error(`Recovered file is empty: ${url}`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, data);
  console.log(`Recovered ${destination} (${data.length} bytes)`);
}

const episodesResponse = await fetch(`${base}/podcast/episodes.json`);
if (!episodesResponse.ok) throw new Error(`Could not read live episodes index: HTTP ${episodesResponse.status}`);
const episodes = await episodesResponse.json();
if (!Array.isArray(episodes)) throw new Error("Live episodes index is not an array.");

await download(`${base}/podcast/cover.png`, path.join(root, "cover.png"), "image/png");
await download(`${base}/podcast/feed.xml`, path.join(root, "feed.xml"), "xml");
await download(`${base}/podcast/index.html`, path.join(root, "index.html"), "text/html");
fs.writeFileSync(path.join(root, "episodes.json"), JSON.stringify(episodes, null, 2) + "\n");

for (const episode of episodes) {
  const slug = String(episode.slug || "");
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(slug)) throw new Error(`Unsafe live episode slug: ${slug}`);
  const audioUrl = new URL(episode.audio_url);
  const pageUrl = new URL(episode.episode_url);
  if (audioUrl.origin !== base || pageUrl.origin !== base) throw new Error(`Refusing external episode URL for ${slug}`);
  await download(audioUrl.href, path.join(episodesDir, `${slug}.mp3`), "audio/mpeg");
  await download(pageUrl.href, path.join(episodesDir, `${slug}.html`), "text/html");
}

console.log(`Recovered ${episodes.length} live Clearforge podcast episode(s) without calling ElevenLabs.`);
