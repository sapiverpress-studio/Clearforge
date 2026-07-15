import fs from "node:fs";
import path from "node:path";

const indexPath = path.join(process.cwd(), "public", "podcast", "index.html");

if (!fs.existsSync(indexPath)) {
  console.log("Podcast index not found; nothing to adjust.");
  process.exit(0);
}

const html = fs.readFileSync(indexPath, "utf8");
const updated = html.replace(/<a href="\/podcast\/feed\.xml">RSS feed<\/a>/g, "");

if (updated === html) {
  console.log("Podcast RSS link was already hidden.");
  process.exit(0);
}

fs.writeFileSync(indexPath, updated, "utf8");
console.log("Removed visible RSS link from podcast page while preserving feed discovery metadata.");
