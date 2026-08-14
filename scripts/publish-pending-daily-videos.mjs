import { getStore } from "@netlify/blobs";

const todayLondon = () => new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());

async function youtubeAccessToken() {
  const required = ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REFRESH_TOKEN"];
  for (const name of required) if (!process.env[name]) throw new Error(`Missing ${name}`);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.YOUTUBE_CLIENT_ID,
      client_secret: process.env.YOUTUBE_CLIENT_SECRET,
      refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
      grant_type: "refresh_token"
    })
  });
  if (!response.ok) throw new Error(`YouTube OAuth failed ${response.status}: ${await response.text()}`);
  return (await response.json()).access_token;
}

async function uploadYouTube(item, video, accessToken) {
  const boundary = `sapiverforge${Date.now()}`;
  const metadata = {
    snippet: { title: item.title.slice(0, 100), description: item.description || "", categoryId: "28" },
    status: { privacyStatus: item.privacyStatus || "public", selfDeclaredMadeForKids: false }
  };
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: video/mp4\r\n\r\n`),
    Buffer.from(video),
    Buffer.from(`\r\n--${boundary}--`)
  ]);
  const response = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status", {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": `multipart/related; boundary=${boundary}` },
    body
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`YouTube upload failed ${response.status}: ${text}`);
  const result = JSON.parse(text);
  if (!result.id) throw new Error("YouTube returned no video ID.");
  return result.id;
}

const siteID = process.env.NETLIFY_SITE_ID;
const token = process.env.NETLIFY_AUTH_TOKEN;
if (!siteID || !token) throw new Error("Netlify storage credentials are unavailable.");
const store = getStore({ name: "daily-brief-videos", siteID, token, consistency: "strong" });
const { blobs } = await store.list({ prefix: "videos/" });
const pending = [];
for (const blob of blobs) {
  const item = await store.get(blob.key, { type: "json" });
  if (item?.status === "pending-youtube" && item.date < todayLondon() && item.fileKey) pending.push({ key: blob.key, item });
}
if (!pending.length) {
  console.log("No Daily Brief videos are due for YouTube publication.");
  process.exit(0);
}

const accessToken = await youtubeAccessToken();
for (const { key, item } of pending) {
  const video = await store.get(item.fileKey, { type: "arrayBuffer" });
  if (!video) throw new Error(`Stored MP4 is missing for ${item.title}`);
  const videoId = await uploadYouTube(item, video, accessToken);
  const published = {
    ...item,
    status: "published",
    videoId,
    youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
    youtubePublishedAt: new Date().toISOString(),
    fileKey: "",
    fileUrl: ""
  };
  await store.setJSON(key, published, { metadata: { publishedAt: published.publishedAt, status: published.status } });
  await store.delete(item.fileKey);
  await store.delete(`uploads/${item.id}`);
  console.log(`Published ${item.title} to YouTube as ${videoId}`);
}
