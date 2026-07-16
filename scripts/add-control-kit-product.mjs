import fs from "node:fs";
import path from "node:path";

const indexPath = path.join(process.cwd(), "public", "index.html");
const productUrl = "https://payhip.com/b/VK2yl";
const marker = "<!-- CLEARFORGE_CONTROL_KIT_PRODUCT -->";

if (!fs.existsSync(indexPath)) {
  throw new Error(`Homepage not found: ${indexPath}`);
}

let html = fs.readFileSync(indexPath, "utf8");

if (html.includes(marker)) {
  console.log("Clearforge Control Kit product section already present.");
  process.exit(0);
}

const section = `${marker}
<section class="posts product-feature">
  <p class="eyebrow">Clearforge practical toolkit</p>
  <h2>Clearforge AI Workflow Control Kit PRO</h2>
  <p>Map, control, test and review AI-assisted workflows without losing human oversight.</p>
  <p>Includes the local-first Workflow Control Mapper, a 46-page implementation workbook, a completed example, operating checklists and the companion Notion workspace.</p>
  <div class="report-actions">
    <a class="button" href="${productUrl}" target="_blank" rel="noopener noreferrer">Get the Control Kit — £19</a>
  </div>
</section>`;

const newsletterMarker = '<section class="newsletter-callout">';
const insertAt = html.lastIndexOf(newsletterMarker);

if (insertAt === -1) {
  throw new Error("Could not find the homepage newsletter section for product insertion.");
}

html = `${html.slice(0, insertAt)}${section}${html.slice(insertAt)}`;
fs.writeFileSync(indexPath, html, "utf8");
console.log("Added Clearforge AI Workflow Control Kit PRO to the homepage.");
