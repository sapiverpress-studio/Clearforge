const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

function authorised(request, password) {
  const supplied = request.headers.get("authorization") || "";
  return Boolean(password) && supplied === `Bearer ${password}`;
}

export default async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (!authorised(request, Netlify.env.get("VIDEO_UPLOAD_PASSWORD"))) return json({ error: "Incorrect publisher password." }, 401);

  const input = await request.json().catch(() => ({}));
  const title = String(input.title || "").trim().slice(0, 100);
  const description = String(input.description || "").trim().slice(0, 5000);
  const fileSize = Number(input.fileSize || 0);
  if (!title) return json({ error: "A YouTube title is required." }, 400);
  if (!Number.isSafeInteger(fileSize) || fileSize < 1 || fileSize > 2_000_000_000) return json({ error: "Choose an MP4 smaller than 2 GB." }, 400);

  const clientId = Netlify.env.get("YOUTUBE_CLIENT_ID");
  const clientSecret = Netlify.env.get("YOUTUBE_CLIENT_SECRET");
  const refreshToken = Netlify.env.get("YOUTUBE_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) return json({ error: "YouTube publishing has not been connected on Netlify." }, 503);

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" })
  });
  if (!tokenResponse.ok) return json({ error: "YouTube authorisation failed. Reconnect the channel." }, 502);
  const { access_token: accessToken } = await tokenResponse.json();

  const metadata = {
    snippet: { title, description, categoryId: "28" },
    status: { privacyStatus: ["public", "unlisted", "private"].includes(input.privacyStatus) ? input.privacyStatus : "public", selfDeclaredMadeForKids: false }
  };
  const sessionResponse = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json; charset=UTF-8",
      "x-upload-content-length": String(fileSize),
      "x-upload-content-type": "video/mp4"
    },
    body: JSON.stringify(metadata)
  });
  const uploadUrl = sessionResponse.headers.get("location");
  if (!sessionResponse.ok || !uploadUrl) return json({ error: "YouTube did not open an upload session." }, 502);
  return json({ uploadUrl });
};

export const config = { path: "/api/daily-video/start-upload" };
