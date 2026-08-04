import fs from "node:fs";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const runDaily = fs.readFileSync("src/run-daily.mjs", "utf8");
const wrapper = fs.readFileSync("scripts/run-fresh-daily-with-event-retry.sh", "utf8");
const workflow = fs.readFileSync(".github/workflows/daily-draft.yml", "utf8");
for (const scriptName of ["daily", "angle:alternate"]) {
  const script = String(pkg.scripts?.[scriptName] || "");
  if (script.includes("resolve:sources")) throw new Error(`${scriptName} must not run the paid source resolver as a production gate.`);
  if (!script.includes("verify:sources")) throw new Error(`${scriptName} must retain independent source integrity validation.`);
  if (!script.includes("rebuild:pruned")) throw new Error(`${scriptName} must rebuild from any surviving verified stories.`);
}
if (!runDaily.includes("acquireExaSources") || !runDaily.includes("source-acquisition.json")) throw new Error("Fresh production must acquire and seal source evidence before Gemini generation.");
if (runDaily.includes('tools: [{ type: "web_search"')) throw new Error("Gemini web discovery must not supply production source URLs.");
if (!runDaily.includes("Unknown acquisition_id") || !runDaily.includes("url: acquired.final_url")) throw new Error("Selected source URLs must remain bound to sealed acquisition records.");
if (wrapper.includes("optimise-social-audience-fit.mjs")) throw new Error("Social optimisation must not run before source verification.");
if (!workflow.includes("EXA_API_KEY: ${{ secrets.EXA_API_KEY }}")) throw new Error("Fresh workflow must receive the Exa repository secret.");

for (const marker of [
  "name: Upload diagnostics after failure",
  "if: failure()",
  "source-acquisition.json",
  "source-evidence.json",
  "source-integrity-report.json",
  "publishability-report.json",
  "if-no-files-found: warn"
]) if (!workflow.includes(marker)) throw new Error(`Failure diagnostics protection missing: ${marker}`);

const contractIndex = workflow.indexOf("Verify production contracts before paid generation");
const paidGenerationIndex = workflow.indexOf("Generate fresh research edition");
if (contractIndex < 0 || paidGenerationIndex < 0 || contractIndex > paidGenerationIndex) throw new Error("Offline production contracts must run before paid generation.");

console.log("Production source path contract passed: evidence acquisition precedes generation, verification precedes optimisation and failures preserve diagnostics.");
