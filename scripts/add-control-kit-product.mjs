import fs from "node:fs";
import path from "node:path";

const indexPath = path.join(process.cwd(), "public", "index.html");
const releaseGateUrl = "https://payhip.com/b/vGks8";
const controlKitUrl = "https://payhip.com/b/VK2yl";
const marker = "<!-- CLEARFORGE_PRODUCTS -->";

if (!fs.existsSync(indexPath)) {
  throw new Error(`Homepage not found: ${indexPath}`);
}

let html = fs.readFileSync(indexPath, "utf8");

if (html.includes(marker)) {
  console.log("Clearforge products section already present.");
  process.exit(0);
}

const section = `${marker}
<section class="posts products-showcase" id="products" aria-labelledby="products-title">
  <p class="eyebrow">Clearforge practical products</p>
  <h2 id="products-title">Keep a named human in control of AI-assisted work.</h2>
  <article class="product-card product-card-featured">
    <div class="product-copy">
      <p class="product-kicker">Featured release · £19 launch price</p>
      <h3>Clearforge AI Output Release Gate</h3>
      <p>A local-first release check for creators, freelancers and small teams who use AI but still need a human to verify what goes public or reaches a client.</p>
      <p>Work through eight practical checks, record the reviewer and finish with a clear <strong>Release</strong>, <strong>Revise</strong> or <strong>Stop</strong> decision.</p>
      <ul class="product-includes">
        <li>Standalone HTML release tool</li>
        <li>Detailed PDF handbook</li>
        <li>Duplicate-ready Notion version</li>
      </ul>
      <p class="digital-notice"><strong>Digital product:</strong> instant download supplied as a ZIP file. No physical item is shipped.</p>
      <div class="report-actions">
        <a class="button" href="${releaseGateUrl}" target="_blank" rel="noopener noreferrer">Get the Release Gate — £19</a>
      </div>
    </div>
    <div class="product-gallery" aria-label="AI Output Release Gate product preview">
      <figure class="product-gallery-lead">
        <img src="/products/release-gate/01-product-overview.webp" alt="Digital product overview showing the Clearforge AI Output Release Gate HTML tool, PDF handbook and Notion version">
      </figure>
      <figure>
        <img src="/products/release-gate/02-polished-not-checked.webp" alt="Release Gate preview highlighting that polished AI output is not necessarily checked output">
      </figure>
      <figure>
        <img src="/products/release-gate/03-eight-checks-named-reviewer.webp" alt="Release Gate preview showing eight checks and a named human reviewer">
      </figure>
      <figure>
        <img src="/products/release-gate/04-end-with-a-decision.webp" alt="Release Gate preview showing the Release, Revise and Stop decisions">
      </figure>
    </div>
  </article>
  <article class="product-card product-card-secondary">
    <div class="product-copy">
      <p class="product-kicker">Companion workflow toolkit</p>
      <h3>Clearforge AI Workflow Control Kit PRO</h3>
      <p>Map, control, test and review AI-assisted workflows without losing human oversight. Includes the local-first Workflow Control Mapper, a 46-page implementation workbook, a completed example, operating checklists and the companion Notion workspace.</p>
      <div class="report-actions">
        <a class="button button-secondary" href="${controlKitUrl}" target="_blank" rel="noopener noreferrer">View the Control Kit — £19</a>
      </div>
    </div>
  </article>
</section>`;

const newsletterMarker = '<section class="newsletter-callout">';
const insertAt = html.lastIndexOf(newsletterMarker);

if (insertAt === -1) {
  throw new Error("Could not find the homepage newsletter section for product insertion.");
}

html = `${html.slice(0, insertAt)}${section}${html.slice(insertAt)}`;
fs.writeFileSync(indexPath, html, "utf8");
console.log("Added Clearforge products to the homepage.");
