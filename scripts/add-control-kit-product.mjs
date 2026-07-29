import fs from "node:fs";
import path from "node:path";

const indexPath = path.join(process.cwd(), "public", "index.html");
const startMarker = "<!-- CLEARFORGE_PRODUCTS -->";
const endMarker = "<!-- /CLEARFORGE_PRODUCTS -->";
const newsletterMarker = '<section class="newsletter-callout">';
const payhipScript = '<script type="text/javascript" src="https://payhip.com/payhip.js"></script>';

if (!fs.existsSync(indexPath)) {
  throw new Error(`Homepage not found: ${indexPath}`);
}

let html = fs.readFileSync(indexPath, "utf8");

if (!html.includes("https://payhip.com/payhip.js")) {
  const headEnd = html.indexOf("</head>");
  if (headEnd === -1) {
    throw new Error("Could not find the homepage head for the Payhip script.");
  }
  html = `${html.slice(0, headEnd)}  ${payhipScript}\n${html.slice(headEnd)}`;
}

const section = `<!-- CLEARFORGE_PRODUCTS -->
<section class="posts products-showcase" id="products" aria-labelledby="products-title">
  <p class="eyebrow">Clearforge Applied AI Gate System</p>
  <h2 id="products-title">Put a human decision at every critical point in AI-assisted work.</h2>
  <p class="products-intro">Use one Gate for an immediate problem, or carry a piece of work through the complete four-stage system—from deciding whether AI belongs in the task to reviewing whether it delivered a worthwhile result.</p>

  <article class="product-card product-card-featured product-bundle">
    <div class="product-copy">
      <p class="product-kicker">Best value · UK checkout £58.80</p>
      <h3>Complete Four-Gate Bundle</h3>
      <p>Get all four core Gates in one connected system: Opportunity, Workflow Control, Output Release and Outcome Review.</p>
      <ul class="product-includes">
        <li>All four standalone Gate packs</li>
        <li>Local-first HTML tools, practical guidance and supporting resources</li>
        <li>Exclusive Agent Connection Safety Gate add-on at no extra cost</li>
      </ul>
      <p class="bundle-saving"><strong>Save £27 before VAT or £32.40 at a UK checkout</strong> compared with buying the four core Gates separately, plus receive the exclusive bonus add-on.</p>
      <p class="price-tax-note"><strong>£49 before tax.</strong> UK customers pay £58.80 including 20% VAT. Other locations are charged according to Payhip’s applicable tax rules.</p>\n      <p class="digital-notice"><strong>Digital product:</strong> instant download supplied through Payhip. No physical item is shipped.</p>
      <div class="report-actions">
        <a href="https://payhip.com/b/cmklU" class="payhip-buy-button button" data-theme="green" data-product="cmklU">Get All Four Gates + Free Bonus — £58.80 UK total</a>
      </div>
    </div>
    <div class="product-gallery" aria-label="Complete Clearforge Gate System product preview">
      <img src="/products/gate-system/complete-bundle/01_Cover.webp" width="900" height="900" alt="Clearforge Applied AI Gate System complete bundle cover" loading="lazy">
      <img src="/products/gate-system/complete-bundle/02_Four_Stage_System.webp" width="900" height="900" alt="The four stages of the Clearforge Applied AI Gate System" loading="lazy">
      <img src="/products/gate-system/complete-bundle/03_What_You_Receive.webp" width="900" height="900" alt="Contents supplied with the complete Clearforge Gate System bundle" loading="lazy">
    </div>
  </article>

  <div class="gate-grid" aria-label="Individual Clearforge AI Gates">
    <article class="product-card gate-card">
      <div class="product-gallery product-gallery-compact" aria-label="Opportunity Gate product preview">
        <img src="/products/gate-system/opportunity-gate/01_Cover.webp" width="900" height="900" alt="Clearforge AI Opportunity Gate cover" loading="lazy">
        <img src="/products/gate-system/opportunity-gate/02_What_It_Does.webp" width="900" height="900" alt="What the Clearforge AI Opportunity Gate does" loading="lazy">
        <img src="/products/gate-system/opportunity-gate/03_What_You_Receive.webp" width="900" height="900" alt="Contents supplied with the Clearforge AI Opportunity Gate" loading="lazy">
      </div>
      <p class="product-kicker">Gate 1 · UK checkout £22.80</p>
      <h3>Opportunity Gate</h3>
      <p>Decide whether AI belongs in the task before time, money or sensitive information is committed.</p>\n      <p class="price-tax-note">£19 before tax · £22.80 for UK buyers including VAT</p>
      <a href="https://payhip.com/b/4rcSt" class="payhip-buy-button button button-secondary" data-theme="green" data-product="4rcSt">Buy Opportunity Gate — £22.80 UK total</a>
    </article>

    <article class="product-card gate-card">
      <div class="product-gallery product-gallery-compact" aria-label="Workflow Control Gate product preview">
        <img src="/products/gate-system/workflow-control-gate/01_Cover.webp" width="900" height="900" alt="Clearforge AI Workflow Control Gate cover" loading="lazy">
        <img src="/products/gate-system/workflow-control-gate/02_What_It_Does.webp" width="900" height="900" alt="What the Clearforge AI Workflow Control Gate does" loading="lazy">
        <img src="/products/gate-system/workflow-control-gate/03_What_You_Receive.webp" width="900" height="900" alt="Contents supplied with the Clearforge AI Workflow Control Gate" loading="lazy">
      </div>
      <p class="product-kicker">Gate 2 · UK checkout £22.80</p>
      <h3>Workflow Control Gate</h3>
      <p>Define the workflow, ownership and human checkpoints before AI-assisted work moves forward.</p>\n      <p class="price-tax-note">£19 before tax · £22.80 for UK buyers including VAT</p>
      <a href="https://payhip.com/b/qBPip" class="payhip-buy-button button button-secondary" data-theme="green" data-product="qBPip">Buy Workflow Control Gate — £22.80 UK total</a>
    </article>

    <article class="product-card gate-card">
      <div class="product-gallery product-gallery-compact" aria-label="Output Release Gate product preview">
        <img src="/products/gate-system/output-release-gate/01_Cover.webp" width="900" height="900" alt="Clearforge AI Output Release Gate cover" loading="lazy">
        <img src="/products/gate-system/output-release-gate/02_What_It_Does.webp" width="900" height="900" alt="What the Clearforge AI Output Release Gate does" loading="lazy">
        <img src="/products/gate-system/output-release-gate/03_What_You_Receive.webp" width="900" height="900" alt="Contents supplied with the Clearforge AI Output Release Gate" loading="lazy">
      </div>
      <p class="product-kicker">Gate 3 · UK checkout £22.80</p>
      <h3>Output Release Gate</h3>
      <p>Check evidence, privacy, ownership and readiness before AI-assisted work is published or sent.</p>\n      <p class="price-tax-note">£19 before tax · £22.80 for UK buyers including VAT</p>
      <a href="https://payhip.com/b/pkSEY" class="payhip-buy-button button button-secondary" data-theme="green" data-product="pkSEY">Buy Output Release Gate — £22.80 UK total</a>
    </article>

    <article class="product-card gate-card">
      <div class="product-gallery product-gallery-compact" aria-label="Outcome Review Gate product preview">
        <img src="/products/gate-system/outcome-review-gate/01_Cover.webp" width="900" height="900" alt="Clearforge AI Outcome Review Gate cover" loading="lazy">
        <img src="/products/gate-system/outcome-review-gate/02_What_It_Does.webp" width="900" height="900" alt="What the Clearforge AI Outcome Review Gate does" loading="lazy">
        <img src="/products/gate-system/outcome-review-gate/03_What_You_Receive.webp" width="900" height="900" alt="Contents supplied with the Clearforge AI Outcome Review Gate" loading="lazy">
      </div>
      <p class="product-kicker">Gate 4 · UK checkout £22.80</p>
      <h3>Outcome Review Gate</h3>
      <p>Review the result after use and decide whether to continue, change, pause or retire the workflow.</p>\n      <p class="price-tax-note">£19 before tax · £22.80 for UK buyers including VAT</p>
      <a href="https://payhip.com/b/rgFXP" class="payhip-buy-button button button-secondary" data-theme="green" data-product="rgFXP">Buy Outcome Review Gate — £22.80 UK total</a>
    </article>
  </div>
</section>
<!-- /CLEARFORGE_PRODUCTS -->`;
const sectionStart = html.indexOf(startMarker);
const sectionEnd = html.indexOf(endMarker, sectionStart);

if (sectionStart !== -1 && sectionEnd !== -1) {
  const replaceEnd = sectionEnd + endMarker.length;
  html = `${html.slice(0, sectionStart)}${section}${html.slice(replaceEnd)}`;
} else if (sectionStart !== -1) {
  const newsletterStart = html.indexOf(newsletterMarker, sectionStart);
  if (newsletterStart === -1) {
    throw new Error("Could not find the homepage newsletter section after the legacy product section.");
  }
  html = `${html.slice(0, sectionStart)}${section}${html.slice(newsletterStart)}`;
} else {
  const newsletterStart = html.lastIndexOf(newsletterMarker);
  if (newsletterStart === -1) {
    throw new Error("Could not find the homepage newsletter section for product insertion.");
  }
  html = `${html.slice(0, newsletterStart)}${section}${html.slice(newsletterStart)}`;
}

fs.writeFileSync(indexPath, html, "utf8");
console.log("Added the Clearforge Applied AI Gate System to the homepage.");
