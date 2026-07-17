// Redeploy trigger: refresh production Pinterest OAuth environment values.
import crypto from "node:crypto";

function env(name) {
  return globalThis.Netlify?.env?.get?.(name) || process.env[name] || "";
}

function html(status, body) {
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Clearforge Pinterest setup</title><style>body{font-family:system-ui,sans-serif;max-width:760px;margin:48px auto;padding:0 20px;line-height:1.5;color:#17202a}code{background:#f3f4f6;padding:.15rem .35rem;border-radius:.3rem}a.button{display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:.8rem 1rem;border-radius:.55rem}</style><body>${body}</body></html>`, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
    },
  });
}

function signState(payload, secret) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export default async function pinterestOauthStart(req) {
  const url = new URL(req.url);
  const suppliedKey = url.searchParams.get("key") || "";
  const expectedKey = env("PINTEREST_OAUTH_SETUP_KEY");
  const clientId = env("PINTEREST_APP_ID") || env("PINTEREST_CLIENT_ID");
  const clientSecret = env("PINTEREST_APP_SECRET") || env("PINTEREST_CLIENT_SECRET");
  const redirectUri = env("PINTEREST_REDIRECT_URI");

  if (!expectedKey) {
    return html(500, "<h1>Setup key unavailable</h1><p>The deployed function cannot read <code>PINTEREST_OAUTH_SETUP_KEY</code>. Redeploy the production site after saving the environment variable.</p>");
  }
  if (!suppliedKey || suppliedKey !== expectedKey) {
    return html(401, "<h1>Access denied</h1><p>The URL setup key is missing or does not match the production environment value.</p>");
  }
  if (!clientId || !clientSecret || !redirectUri) {
    return html(500, "<h1>Setup incomplete</h1><p>Netlify still needs <code>PINTEREST_APP_ID</code>, <code>PINTEREST_APP_SECRET</code>, and <code>PINTEREST_REDIRECT_URI</code>.</p>");
  }

  const state = signState({
    issued_at: Date.now(),
    nonce: crypto.randomBytes(18).toString("base64url"),
  }, clientSecret);

  const authorize = new URL("https://www.pinterest.com/oauth/");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("scope", "boards:read,boards:write,pins:read,pins:write");
  authorize.searchParams.set("state", state);

  return Response.redirect(authorize.toString(), 302);
}

export const config = {
  path: "/admin/pinterest/connect",
};
