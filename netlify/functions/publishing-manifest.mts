import { getStore } from "@netlify/blobs";
import { getUser } from "@netlify/identity";
import type { Config, Context } from "@netlify/functions";

export default async (_req: Request, _context: Context) => {
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const url = new URL(_req.url);
  const requested = url.searchParams.get("edition") || "latest";
  if (!/^(latest|\d{4}-\d{2}-\d{2}(?:-[a-z0-9-]+)?)$/.test(requested)) return new Response("Invalid edition", { status: 400 });
  const store = getStore({ name: "clearforge-publishing", consistency: "strong" });
  const index = await store.get("editions/index.json", { type: "json" }) as { editions?: string[] } | null;
  const manifest = await store.get(`${requested}/manifest.json`, { type: "json" }) as Record<string, unknown> | null;
  if (!manifest) return new Response("Publishing pack not found", { status: 404 });
  return Response.json({ ...manifest, editions: index?.editions || [manifest.edition] }, { headers: { "Cache-Control": "no-store" } });
};
export const config: Config = { path: "/api/publishing/manifest", method: ["GET"] };
