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
  "source-evidence.json",
  "verified atomic claim",
  "exact_supporting_evidence_passage",
  "verification_checks_performed",
  "sapiver_forge_interpretation",
  "Unsupported number",
  "Unsupported named entity"
];
for (const marker of requiredProtections) {
  if (!source.includes(marker)) throw new Error(`Fact-lock protection missing: ${marker}`);
}

console.log("Fact-lock production contract passed.");
