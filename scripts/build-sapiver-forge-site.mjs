import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const sourcePath = path.join(process.cwd(), "src", "build-site.mjs");
const original = fs.readFileSync(sourcePath, "utf8");
const transformed = original
  .replaceAll("https://clearforge-daily-brief.netlify.app", "https://sapiverforge-daily-brief.netlify.app")
  .replaceAll("Clearforge", "Sapiver Forge");

if (transformed.includes("https://clearforge-daily-brief.netlify.app") || /\bClearforge\b/.test(transformed)) {
  throw new Error("The active Sapiver Forge site build still contains Clearforge branding.");
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sapiver-forge-site-"));
const tempFile = path.join(tempDir, "build-site.mjs");
fs.writeFileSync(tempFile, transformed, "utf8");

try {
  await import(`${pathToFileURL(tempFile).href}?run=${Date.now()}`);
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
