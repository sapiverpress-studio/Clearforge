import fs from "node:fs";

const compat = fs.readFileSync("src/gemini-openai-compat.mjs", "utf8");
const provider = fs.readFileSync("src/gemini-provider.mjs", "utf8");
const resolver = fs.readFileSync("src/resolve-source-records.mjs", "utf8");

const checks = [
  [provider.includes("groundingMetadata"), "provider must retain Gemini grounding metadata"],
  [compat.includes("groundingChunks"), "compat wrapper must expose grounding chunks"],
  [compat.includes("output:"), "compat wrapper must return an output collection"],
  [resolver.includes("collectSearchEvidence"), "resolver must collect search evidence"],
  [resolver.includes("was not present in the web-search evidence"), "resolver must reject ungrounded URLs"]
];

const failures = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Grounding metadata contract passed.");
