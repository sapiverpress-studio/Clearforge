import { getStore } from "@netlify/blobs";
import { getUser } from "@netlify/identity";
import type { Config, Context } from "@netlify/functions";

type Asset = { id: string; key: string; filename: string; contentType: string };
type Manifest = { assets: Asset[] };
export default async (req: Request, context: Context) => {
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const id = String(context.params.assetId || "");
  const url = new URL(req.url);
  const edition = url.searchParams.get("edition") || "latest";
  if (!/^[a-z0-9-]+$/.test(id) || !/^(latest|\d{4}-\d{2}-\d{2}(?:-[a-z0-9-]+)?)$/.test(edition)) return new Response("Invalid asset", { status: 400 });
  const store = getStore({ name: "clearforge-publishing", consistency: "strong" });
  const manifest = await store.get(`${edition}/manifest.json`, { type: "json" }) as Manifest | null;
  const asset = manifest?.assets?.find((item) => item.id === id);
  if (!asset) return new Response("Asset not found", { status: 404 });
  const data = await store.get(asset.key, { type: "blob" });
  if (!data) return new Response("Asset not found", { status: 404 });
  const headers = new Headers({ "Content-Type": asset.contentType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
  if (url.searchParams.get("download") === "1") headers.set("Content-Disposition", `attachment; filename="${asset.filename.replace(/["\\]/g, "")}"`);
  return new Response(data, { headers });
};
export const config: Config = { path: "/api/publishing/assets/:assetId", method: ["GET"] };
