import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const publicDir = path.join(root, "public");
const homepage = fs.readFileSync(path.join(publicDir, "index.html"), "utf8");
const sets = {
  "products/gate-system/complete-bundle": ["01_Cover.webp", "02_Four_Stage_System.webp", "03_What_You_Receive.webp"],
  "products/gate-system/opportunity-gate": ["01_Cover.webp", "02_What_It_Does.webp", "03_What_You_Receive.webp"],
  "products/gate-system/workflow-control-gate": ["01_Cover.webp", "02_What_It_Does.webp", "03_What_You_Receive.webp"],
  "products/gate-system/output-release-gate": ["01_Cover.webp", "02_What_It_Does.webp", "03_What_You_Receive.webp"],
  "products/gate-system/outcome-review-gate": ["01_Cover.webp", "02_What_It_Does.webp", "03_What_You_Receive.webp"],
  "products/notion-workspace": ["01_Cover.webp", "02_What_It_Does.webp", "03_What_You_Receive.webp"]
};

let imageCount = 0;
for (const [folder, expected] of Object.entries(sets)) {
  const directory = path.join(publicDir, folder);
  const actual = fs.readdirSync(directory).filter((name) => name.endsWith(".webp")).sort();
  assert.deepEqual(actual, [...expected].sort(), `${folder} does not contain its intended three WebP files.`);
  for (const name of expected) {
    const data = fs.readFileSync(path.join(directory, name));
    assert.ok(data.length > 12, `${folder}/${name} is empty.`);
    assert.equal(data.subarray(0, 4).toString("ascii"), "RIFF", `${folder}/${name} has no RIFF signature.`);
    assert.equal(data.subarray(8, 12).toString("ascii"), "WEBP", `${folder}/${name} has no WebP signature.`);
    assert.ok(homepage.includes(`/${folder}/${name}`), `${folder}/${name} is not referenced by the homepage.`);
    imageCount += 1;
  }
}
assert.equal(imageCount, 18, "Expected exactly 18 active product artwork files.");

const textExtensions = new Set([".html", ".xml", ".json", ".js", ".css", ".txt", ".md", ".webmanifest", ".svg"]);
const visibleBrandHits = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (textExtensions.has(path.extname(entry.name).toLowerCase())) {
      const content = fs.readFileSync(file, "utf8");
      if (/Clear\s*Forge|Clearforge|CLEARFORGE/.test(content)) visibleBrandHits.push(path.relative(root, file));
      if (/https?:\/\/clearforge-daily-brief\.netlify\.app/i.test(content)) visibleBrandHits.push(`${path.relative(root, file)} (legacy public domain)`);
    }
  }
}
walk(publicDir);
assert.deepEqual([...new Set(visibleBrandHits)], [], `Customer-facing Clearforge branding remains: ${[...new Set(visibleBrandHits)].join(", ")}`);

for (const slug of ["cmklU", "4rcSt", "qBPip", "pkSEY", "rgFXP", "gq89f"]) {
  assert.ok(homepage.includes(`https://payhip.com/b/${slug}`), `Approved Payhip link missing: ${slug}`);
}
assert.ok(homepage.includes("https://sapiver-press.kit.com/5147ce2817"), "Approved free Notion signup link missing.");

console.log("Validated 18 product images, public branding, and approved commercial links.");
