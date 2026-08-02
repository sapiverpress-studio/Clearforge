import fs from "node:fs";

const source = fs.readFileSync("src/rebuild-pruned-edition.mjs", "utf8");
const required = [
  "without making length a release gate",
  "A short complete report is acceptable",
  "Retaining a shorter verified report",
  "generateDepthReport"
];
for (const text of required) {
  if (!source.includes(text)) throw new Error(`Missing flexible-length report contract: ${text}`);
}
if (/articleWords\s*<\s*\d+[^\n]*throw new Error/.test(source)) {
  throw new Error("Verified reports must not be rejected solely for word count.");
}
console.log("Flexible depth-report contract passed.");
