import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const homepagePath = path.join(root, "public", "index.html");
const latestShortPath = path.join(root, "public", "podcast", "latest-short.js");
const legacySelector = "data-clearforge-latest-short";
const currentSelector = "data-sapiver-forge-latest-short";

for (const file of [homepagePath, latestShortPath]) {
  if (!fs.existsSync(file)) throw new Error(`Expected generated file is missing: ${path.relative(root, file)}`);
  const original = fs.readFileSync(file, "utf8");
  const updated = original.replaceAll(legacySelector, currentSelector);
  fs.writeFileSync(file, updated, "utf8");
  if (updated.includes(legacySelector)) throw new Error(`Legacy selector remains in ${path.relative(root, file)}`);
}

const homepage = fs.readFileSync(homepagePath, "utf8");
const latestShort = fs.readFileSync(latestShortPath, "utf8");
if (!homepage.includes(`[${currentSelector}]`) && !homepage.includes(currentSelector)) {
  throw new Error("Sapiver Forge latest-short section selector is missing from the homepage.");
}
if (!latestShort.includes(`[${currentSelector}]`)) {
  throw new Error("Sapiver Forge latest-short JavaScript selector is missing.");
}

console.log("Finalised Sapiver Forge latest-short selectors.");
