import fs from "node:fs";

const source = fs.readFileSync("src/optimise-social-or-preserve.mjs", "utf8");

const required = [
  "try {",
  "await import(\"./optimise-social-audience-fit.mjs\")",
  "catch (error)",
  "restore(structuredPath",
  "restore(socialPackPath",
  "social-optimisation-warning.txt",
  "Continuing with the complete social pack generated before the optional optimisation pass"
];

for (const fragment of required) {
  if (!source.includes(fragment)) {
    throw new Error(`Social optimiser fallback contract missing: ${fragment}`);
  }
}

if (/await import\("\.\/optimise-social-audience-fit\.mjs"\);\s*process\.exit\(0\);/.test(source)) {
  throw new Error("Audience-fit optimisation is again an unguarded production kill switch.");
}

console.log("Social optimiser fallback contract passed.");
