import fs from "node:fs";

const source = fs.readFileSync("src/rebuild-pruned-edition.mjs", "utf8");
const required = [
  "requesting one focused expansion instead of failing the run",
  "minimum fallback 600",
  "retaining verified content so socials and review output are not lost",
  "generateDepthReport"
];
for (const text of required) {
  if (!source.includes(text)) throw new Error(`Missing depth-report fallback contract: ${text}`);
}
if (/articleWords < 850\) throw new Error/.test(source)) {
  throw new Error("Short reports must not immediately terminate the paid run.");
}
console.log("Depth-report expansion contract passed.");
