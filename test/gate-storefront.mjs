import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const homepage = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");

const requiredText = [
  "Put a human at every gate before AI-assisted work goes out.",
  "£58.80 including VAT",
  "Individual Gates — £22.80 each",
  "Agent Connection Safety add-on",
  "Latest practical guidance",
  "Recent Sapiver Forge articles",
  "Sapiver Forge AI Briefing"
];

for (const text of requiredText) {
  assert.ok(homepage.includes(text), `Homepage is missing required text: ${text}`);
}

const payhipLinks = [
  "https://payhip.com/b/cmklU",
  "https://payhip.com/b/4rcSt",
  "https://payhip.com/b/qBPip",
  "https://payhip.com/b/pkSEY",
  "https://payhip.com/b/rgFXP",
  "https://payhip.com/b/gq89f"
];

for (const link of payhipLinks) {
  assert.ok(homepage.includes(`href="${link}"`), `Homepage is missing Payhip link: ${link}`);
}

assert.ok(!homepage.includes("https://payhip.com/b/vGks8"), "Legacy Release Gate link is still present.");
assert.ok(!homepage.includes("https://payhip.com/b/VK2yl"), "Legacy Workflow Control Kit link is still present.");

const workspaceText = [
  "Sapiver Forge AI Gate Workspace",
  "Make clearer decisions about where and how you use AI.",
  "one ready-to-duplicate blank assessment for each stage",
  "Get the complete workspace free.",
  "Buy direct and support Sapiver Forge.",
  "It does not include the separate browser-based decision tools"
];

for (const text of workspaceText) {
  assert.ok(homepage.includes(text), `Homepage is missing workspace text: ${text}`);
}

assert.ok(homepage.includes('href="https://sapiver-press.kit.com/5147ce2817"'), "Homepage is missing the clean Kit workspace link.");
assert.ok(!homepage.includes("\u2060"), "Homepage contains an invisible word-joiner character.");
assert.ok(!homepage.includes("\ufffd"), "Homepage contains a replacement character.");
assert.ok(
  homepage.indexOf('id="gate-workspace"') < homepage.indexOf('id="choose-a-gate"'),
  "Gate Workspace offer must appear before the detailed Gate chooser and product sections."
);

const imageRoot = path.join(root, "public", "products", "gate-system");
const images = fs.readdirSync(imageRoot, { recursive: true })
  .filter((entry) => entry.endsWith(".webp"));

assert.equal(images.length, 15, "Expected all 15 Gate System product images.");
for (const image of images) {
  const file = path.join(imageRoot, image);
  assert.ok(fs.statSync(file).size > 0, `Product image is empty: ${image}`);
  assert.ok(homepage.includes(`/products/gate-system/${image.replaceAll(path.sep, "/")}`), `Product image is not used by the homepage: ${image}`);
}

const notionImageRoot = path.join(root, "public", "products", "notion-workspace");
const notionImages = fs.readdirSync(notionImageRoot).filter((entry) => entry.endsWith(".webp"));
assert.equal(notionImages.length, 3, "Expected all 3 Notion Workspace product images.");
for (const image of notionImages) {
  const file = path.join(notionImageRoot, image);
  assert.ok(fs.statSync(file).size > 0, `Notion Workspace image is empty: ${image}`);
  assert.ok(homepage.includes(`/products/notion-workspace/${image}`), `Notion Workspace image is not used by the homepage: ${image}`);
}

console.log("Gate System storefront checks passed.");
