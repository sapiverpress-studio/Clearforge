import fs from "node:fs";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const source = fs.readFileSync("src/enforce-locked-facts.mjs", "utf8");

const requiredScriptRoutes = ["daily", "angle:alternate", "draft", "social:optimise", "feature", "validate:auto", "review:human"];
for (const name of requiredScriptRoutes) {
  if (!String(pkg.scripts?.[name] || "").includes("facts:enforce")) {
    throw new Error(`${name} does not enforce locked facts.`);
  }
}

const requiredProtections = [
  "locked-facts.json",
  "fact-discipline-report.json",
  "100%",
  "mandatory for all AI interactions in the EU",
  "C2PA metadata",
  "supported_fact",
  "labelled_interpretation"
];
for (const marker of requiredProtections) {
  if (!source.includes(marker)) throw new Error(`Fact-lock protection missing: ${marker}`);
}

console.log("Fact-lock production contract passed.");
