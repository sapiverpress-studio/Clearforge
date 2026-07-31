import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const edition = String(
  process.env.SAPIVER_FORGE_DATE || process.env.CLEARFORGE_DATE || "",
).trim();

if (!/^\d{4}-\d{2}-\d{2}(?:-[a-z0-9-]+)?$/.test(edition)) {
  throw new Error("A valid edition ID is required for the Sapiver Forge rebrand pass.");
}

const roots = [
  path.join(ROOT, "drafts", edition),
  path.join(ROOT, "media", edition),
];
const textExtensions = new Set([
  ".txt", ".md", ".json", ".html", ".htm", ".xml", ".js", ".mjs", ".css",
]);

function protectExternalTokens(value) {
  const tokens = [];
  const protectedText = value.replace(
    /https?:\/\/[^\s"'<>)]*|\b[^\s@]+@[^\s@]+\.[^\s@]+\b/gi,
    (match) => {
      const marker = `__SAPIVER_FORGE_PROTECTED_${tokens.length}__`;
      tokens.push(match);
      return marker;
    },
  );
  return { protectedText, tokens };
}

function restoreExternalTokens(value, tokens) {
  return tokens.reduce(
    (result, token, index) => result.replaceAll(`__SAPIVER_FORGE_PROTECTED_${index}__`, token),
    value,
  );
}

function rebrandText(value) {
  const { protectedText, tokens } = protectExternalTokens(value);
  const changed = protectedText
    .replace(/\bclear\s+forge\b/gi, "Sapiver Forge")
    .replace(/\bclearforge\b/gi, "Sapiver Forge");
  return restoreExternalTokens(changed, tokens);
}

function collectFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(absolute));
    else if (entry.isFile() && textExtensions.has(path.extname(entry.name).toLowerCase())) files.push(absolute);
  }
  return files;
}

const files = roots.flatMap(collectFiles);
let changedFiles = 0;
let replacements = 0;

for (const file of files) {
  const original = fs.readFileSync(file, "utf8");
  const updated = rebrandText(original);
  if (updated === original) continue;
  const beforeCount = (original.match(/\bclear\s*forge\b/gi) || []).length;
  fs.writeFileSync(file, updated, "utf8");
  changedFiles += 1;
  replacements += beforeCount;
  console.log(`Rebranded ${path.relative(ROOT, file)}`);
}

const remaining = [];
for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  const withoutExternalTokens = content.replace(/https?:\/\/[^\s"'<>)]*|\b[^\s@]+@[^\s@]+\.[^\s@]+\b/gi, "");
  if (/\bclear\s*forge\b/i.test(withoutExternalTokens)) {
    remaining.push(path.relative(ROOT, file));
  }
}

if (remaining.length) {
  throw new Error(`Legacy Clearforge branding remains in current edition files: ${remaining.join(", ")}`);
}

console.log(`Sapiver Forge rebrand pass complete for ${edition}: ${replacements} replacements across ${changedFiles} files.`);
