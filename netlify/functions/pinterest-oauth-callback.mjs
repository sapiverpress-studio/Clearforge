import crypto from "node:crypto";

function env(name) {
  return globalThis.Netlify?.env?.get?.(name) || process.env[name] || "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function page(status, body) {
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Clearforge Pinterest setup</title><style>body{font-family:system-ui,sans-serif;max-width:820px;margin:40px auto;padding:0 20px;line-height:1.5;color:#17202a}.box{border:1px solid #d1d5db;border-radius:.65rem;padding:1rem;margin:1rem 0;background:#f9fafb}.token{display:block;word-break:break-all;background:#111827;color:#fff;padding:.8rem;border-radius:.45rem;font-family:ui-monospace,monospace}button{padding:.65rem .9rem;border:0;border-radius:.45rem;background:#111827;color:white;margin-top:.5rem}code{background:#f3f4f6;padding:.15rem .35rem;border-radius:.3rem}.warn{background:#fff7ed;border-color:#fdba74}</style><body>${body}<script>for(const b of document.querySelectorAll('[data-copy]'))b.addEventListener('click',()=>navigator.clipboard.writeText(document.getElementById(b.dataset.copy).textContent));</script></body></html>`, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "pragma": "no-cache",
      "x-robots-tag": "noindex, nofollow",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
    },
  });
}

function verifyState(state, secret) {
  const [encoded, supplied] = String(state || "").split(".");
  if (!encoded || !supplied) return false;
  const expected = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  let payload;
  try { payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")); } catch { return false; }
  return Number.isFinite(payload.issued_at) && Date.now() - payload.issued_at >= 0 && Date.now() - payload.issued_at < 10 * 60 * 1000;
}

export default async function pinterestOauthCallback(req) {
  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");
  if (error) {
    return page(400, `<h1>Pinterest did not authorise the connection</h1><p>${escapeHtml(errorDescription || error)}</p>`);
  }

  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const clientId = env("PINTEREST_APP_ID") || env("PINTEREST_CLIENT_ID");
  const clientSecret = env("PINTEREST_APP_SECRET") || env("PINTEREST_CLIENT_SECRET");
  const redirectUri = env("PINTEREST_REDIRECT_URI");

  if (!clientId || !clientSecret || !redirectUri) {
    return page(500, "<h1>Server setup incomplete</h1><p>Required Pinterest environment variables are missing from Netlify.</p>");
  }
  if (!code || !verifyState(state, clientSecret)) {
    return page(400, "<h1>Invalid or expired setup request</h1><p>Restart the Pinterest connection from the secure setup link.</p>");
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    continuous_refresh: "true",
  });

  const response = await fetch("https://api.pinterest.com/v5/oauth/token", {
    method: "POST",
    headers: {
      authorization: `Basic ${basic}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

  if (!response.ok || !data.access_token || !data.refresh_token) {
    return page(response.status || 500, `<h1>Pinterest token exchange failed</h1><div class="box warn"><pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre></div><p>No token has been stored or logged by Clearforge.</p>`);
  }

  return page(200, `<h1>Pinterest connection authorised</h1><p>Copy both values now. This page is not stored and should be closed after updating GitHub.</p>
    <div class="box"><strong>GitHub secret: PINTEREST_ACCESS_TOKEN</strong><span class="token" id="access-token">${escapeHtml(data.access_token)}</span><button data-copy="access-token">Copy access token</button></div>
    <div class="box"><strong>GitHub secret: PINTEREST_REFRESH_TOKEN</strong><span class="token" id="refresh-token">${escapeHtml(data.refresh_token)}</span><button data-copy="refresh-token">Copy refresh token</button></div>
    <div class="box"><strong>Granted scopes</strong><p>${escapeHtml(data.scope || "Not returned")}</p><strong>Access-token lifetime</strong><p>${escapeHtml(data.expires_in || "Not returned")} seconds</p><strong>Refresh-token lifetime</strong><p>${escapeHtml(data.refresh_token_expires_in || "Not returned")} seconds</p></div>
    <div class="box warn"><strong>Final GitHub step</strong><p>Update those two repository secrets in <code>sapiverpress-studio/SapiverPress_comic_public</code>, then run <code>Clearforge Social Distribution</code> in <code>verify</code> mode.</p></div>`);
}

export const config = {
  path: "/admin/pinterest/callback",
};
