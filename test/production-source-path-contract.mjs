import fs from "node:fs";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
for (const scriptName of ["daily", "angle:alternate"]) {
  const script = String(pkg.scripts?.[scriptName] || "");
  if (script.includes("resolve:sources")) {
    throw new Error(`${scriptName} must not run the paid source resolver as a production gate.`);
  }
  if (!script.includes("verify:sources")) {
    throw new Error(`${scriptName} must retain independent source integrity validation.`);
  }
  if (!script.includes("rebuild:pruned")) {
    throw new Error(`${scriptName} must rebuild from any surviving verified stories.`);
  }
}
console.log("Production source path contract passed: resolver cannot terminate production runs.");
