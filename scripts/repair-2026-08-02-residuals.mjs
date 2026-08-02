import fs from "node:fs";
import path from "node:path";

const edition = "2026-08-02";
const roots = [path.join("drafts", edition), "public"];
const textExts = new Set([".md", ".json", ".html", ".txt", ".xml"]);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file, out);
    else if (textExts.has(path.extname(entry.name).toLowerCase())) out.push(file);
  }
  return out;
}

const supported = "Ethisphere's benchmark of 134 ethics and compliance leaders found broad or advanced organisational AI adoption at 67.2%, compared with 21.6% adoption inside ethics and compliance functions.";
let changed = 0;
for (const file of roots.flatMap((root) => walk(root))) {
  let text = fs.readFileSync(file, "utf8");
  const before = text;

  text = text
    .replace(/[^.!?\n]*38% of (?:U\.S\. )?workers[^.!?\n]*[.!?]/gi, supported)
    .replace(/[^.!?\n]*38% of employees[^.!?\n]*[.!?]/gi, supported)
    .replace(/[^.!?\n]*38 percent of (?:U\.S\. )?workers[^.!?\n]*[.!?]/gi, supported);

  if (text !== before) {
    fs.writeFileSync(file, text);
    changed += 1;
  }
}

const remaining = roots.flatMap((root) => walk(root))
  .map((file) => fs.readFileSync(file, "utf8"))
  .join("\n");
if (/38% of (?:U\.S\. )?workers|38% of employees|38 percent of (?:U\.S\. )?workers/i.test(remaining)) {
  throw new Error("Residual unsupported 38 percent worker claim remains after scrub.");
}

console.log(`Residual factual scrub updated ${changed} files.`);
