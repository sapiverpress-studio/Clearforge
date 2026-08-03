import fs from "node:fs";
import path from "node:path";
import { SITE_BASE, products, bundle, addon, workspace } from "../src/sapiver-forge-products.mjs";

const ROOT = process.cwd();
const PUBLIC = path.join(ROOT, "public");
const warnings = [];
const requiredCheckoutHosts = new Set(["payhip.com", "sapiver-press.kit.com"]);

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function write(file, content) { ensureDir(path.dirname(file)); fs.writeFileSync(file, content, "utf8"); }
function esc(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function canonical(pathname) { return `${SITE_BASE}${pathname}`; }
function jsonLd(value) { return `<script type="application/ld+json">${JSON.stringify(value).replace(/</g, "\\u003c")}</script>`; }
function money(value) { return `£${Number(value).toFixed(2)}`; }
function validateUrl(value, label) {
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error(`${label} is not a valid URL: ${value}`); }
  if (!requiredCheckoutHosts.has(parsed.hostname)) warnings.push(`${label} uses unexpected host ${parsed.hostname}`);
}
function nav() {
  return `<header class="site-header"><a class="brand" href="/">Sapiver Forge</a><p>Human-led. AI-empowered.</p><nav aria-label="Site links"><a href="/gate-system/">Gate System</a><a href="/which-ai-gate-do-i-need/">Choose a Gate</a><a href="/guides/">Guides</a><a href="/reports/">Reports</a><a href="/podcast/">Podcast</a><a href="/newsletter/">Weekly digest</a></nav></header>`;
}
function footer() {
  return `<footer class="site-footer"><p>Turning human input into clear, usable systems.</p><p><a href="/gate-system/">Gate System</a> · <a href="/which-ai-gate-do-i-need/">Choose a Gate</a> · <a href="/guides/">Guides</a> · <a href="/newsletter/">Weekly digest</a></p></footer>`;
}
function page({ title, description, pathname, body, structured, ogType = "website" }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | Sapiver Forge</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${esc(canonical(pathname))}"><meta property="og:type" content="${ogType}"><meta property="og:site_name" content="Sapiver Forge"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(canonical(pathname))}"><meta property="og:image" content="${esc(canonical(bundle.image))}"><meta name="twitter:card" content="summary_large_image"><link rel="stylesheet" href="/styles.css">${jsonLd(structured)}</head><body>${nav()}<main class="content">${body}</main>${footer()}</body></html>`;
}
function productSchema(product, pathname) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: canonical(product.image),
    sku: `${product.slug}-v${product.version}`,
    brand: { "@type": "Brand", name: "Sapiver Forge" },
    category: "Digital AI governance and decision-support tool",
    url: canonical(pathname),
    offers: {
      "@type": "Offer",
      priceCurrency: "GBP",
      price: product.price,
      availability: "https://schema.org/InStock",
      url: product.checkoutUrl
    }
  };
}
function productBody(product) {
  return `<section class="gate-hero"><div class="gate-hero-copy"><p class="eyebrow">${esc(product.stage)} · Version ${esc(product.version)}</p><h1>${esc(product.shortName)}</h1><p class="gate-question">${esc(product.question)}</p><p>${esc(product.description)}</p><div class="report-actions"><a class="button" href="${esc(product.checkoutUrl)}" target="_blank" rel="noopener noreferrer">Get ${esc(product.shortName)} — ${money(product.price)}</a><a class="button button-secondary" href="/which-ai-gate-do-i-need/">Compare the Gates</a></div><p class="price-note">Customer price shown including UK VAT. Payhip handles checkout and delivery.</p></div><div class="gate-gallery"><img src="${esc(product.image)}" alt="${esc(product.name)} cover" width="1200" height="1200"></div></section><section class="posts"><h2>What you receive</h2><ul>${product.contents.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></section><section class="gate-trust"><div><p class="product-kicker">Local-first</p><h3>Your working information stays in your browser.</h3><p>The core Gate tool is supplied as a standalone HTML file. No Sapiver Forge account or subscription is required.</p></div><div><p class="product-kicker">Human judgement</p><h3>The tool structures a decision; it does not replace the decision-maker.</h3><p>The Gate supports more consistent review but does not guarantee accuracy, safety, compliance or a particular business outcome.</p></div></section><section class="newsletter-callout"><h2>Need all four stages?</h2><p>The complete bundle includes every Gate and the bundle-exclusive Agent & Connector Safety Add-on.</p><p><a class="button" href="/products/complete-gate-system/">View the complete system</a></p></section>`;
}

for (const product of products) {
  validateUrl(product.checkoutUrl, product.name);
  const pathname = `/products/${product.slug}/`;
  write(path.join(PUBLIC, "products", product.slug, "index.html"), page({
    title: product.name,
    description: product.description,
    pathname,
    body: productBody(product),
    structured: productSchema(product, pathname)
  }));
}

validateUrl(bundle.checkoutUrl, bundle.name);
validateUrl(workspace.checkoutUrl, workspace.name);
validateUrl(workspace.freeUrl, `${workspace.name} free access`);

const bundlePath = "/products/complete-gate-system/";
const bundleBody = `<section class="gate-hero"><div class="gate-hero-copy"><p class="eyebrow">Complete bundle · Version ${bundle.version}</p><h1>The complete Sapiver Forge Applied AI Gate System</h1><p>${esc(bundle.description)}</p><div class="report-actions"><a class="button" href="${bundle.checkoutUrl}" target="_blank" rel="noopener noreferrer">Get the complete system — ${money(bundle.price)}</a><a class="button button-secondary" href="/which-ai-gate-do-i-need/">Check which Gate you need</a></div><p class="price-note">Customer price shown including UK VAT. Payhip handles checkout and delivery.</p></div><div class="gate-gallery"><img src="${bundle.image}" alt="${esc(bundle.name)} cover" width="1200" height="1200"></div></section><section class="posts"><h2>What the bundle includes</h2><ul>${bundle.contents.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></section><section class="posts"><h2>The four-stage sequence</h2><ol>${products.map((product) => `<li><a href="/products/${product.slug}/"><strong>${esc(product.shortName)}</strong></a> — ${esc(product.question)}</li>`).join("")}</ol></section><section class="bundle-card"><div class="bundle-copy"><p class="product-kicker">Bundle-exclusive specialist extension · Version ${addon.version}</p><h2>${esc(addon.name)}</h2><p class="gate-question">${esc(addon.question)}</p><p>${esc(addon.description)}</p><p><strong>${esc(addon.note)}</strong></p></div></section>`;
write(path.join(PUBLIC, "products", bundle.slug, "index.html"), page({
  title: bundle.name,
  description: bundle.description,
  pathname: bundlePath,
  body: bundleBody,
  structured: productSchema(bundle, bundlePath)
}));

const workspacePath = "/products/notion-workspace/";
const workspaceSchema = productSchema({ ...workspace, version: "current" }, workspacePath);
const workspaceBody = `<section class="workspace-offer"><div class="gate-gallery"><img src="${workspace.image}" alt="${esc(workspace.name)} cover" width="1200" height="1200"></div><div class="workspace-intro"><p class="eyebrow">Shared assessment workspace</p><h1>${esc(workspace.name)}</h1><p>${esc(workspace.description)}</p><div class="report-actions"><a class="button" href="${workspace.freeUrl}" target="_blank" rel="noopener noreferrer">Get the workspace free by email</a><a class="button button-secondary" href="${workspace.checkoutUrl}" target="_blank" rel="noopener noreferrer">Buy direct — ${money(workspace.price)}</a></div></div></section><aside class="workspace-distinction"><p class="product-kicker">Important distinction</p><p>The Notion workspace records assessments and decisions. It does not include the standalone browser-based Gate tools, workbooks, handbooks or bundle-exclusive add-on.</p><a class="text-link" href="/products/complete-gate-system/">View the complete Gate System</a></aside>`;
write(path.join(PUBLIC, "products", workspace.slug, "index.html"), page({ title: workspace.name, description: workspace.description, pathname: workspacePath, body: workspaceBody, structured: workspaceSchema }));

const selectorPath = "/which-ai-gate-do-i-need/";
const selectorBody = `<section class="hero"><p class="eyebrow">Choose by the decision in front of you</p><h1>Which Sapiver Forge Gate do you need?</h1><p>Start with the point where the work is uncertain, uncontrolled or blocked. You do not need to buy the complete system when one focused Gate solves the immediate problem.</p></section><section class="posts gate-chooser"><ul>${products.map((product) => `<li><a href="/products/${product.slug}/"><strong>${esc(product.question)}</strong><span>Start with ${esc(product.shortName)}</span></a></li>`).join("")}<li><a href="/products/complete-gate-system/"><strong>Do you need a repeatable process across all four stages?</strong><span>Use the complete Applied AI Gate System</span></a></li><li><a href="/products/notion-workspace/"><strong>Do you mainly need a shared place to record decisions?</strong><span>Use the Sapiver Forge AI Gate Workspace</span></a></li></ul></section><section class="gate-trust"><div><p class="product-kicker">One immediate decision</p><h3>Choose one Gate.</h3><p>Best when the problem is isolated and you do not need the full sequence.</p></div><div><p class="product-kicker">Repeatable operating system</p><h3>Choose the bundle.</h3><p>Best when AI-assisted work needs to move through opportunity, control, release and outcome review.</p></div></section>`;
write(path.join(PUBLIC, "which-ai-gate-do-i-need", "index.html"), page({
  title: "Which Sapiver Forge AI Gate do I need?",
  description: "Choose the right Sapiver Forge AI Gate for deciding whether to use AI, controlling a workflow, checking an output or reviewing an outcome.",
  pathname: selectorPath,
  body: selectorBody,
  structured: { "@context": "https://schema.org", "@type": "ItemList", name: "Sapiver Forge AI Gate selector", itemListElement: products.map((product, index) => ({ "@type": "ListItem", position: index + 1, url: canonical(`/products/${product.slug}/`), name: product.name })) }
}));

const gateSystemPath = "/gate-system/";
const gateSystemBody = `<section class="gate-hero"><div class="gate-hero-copy"><p class="eyebrow">Sapiver Forge Applied AI Gate System</p><h1>Human checkpoints for consequential AI-assisted work.</h1><p>Sapiver Forge provides practical local-first tools for creators, freelancers and small teams that need clearer decisions before AI is introduced, while it operates, before output leaves and after results can be measured.</p><div class="report-actions"><a class="button" href="/which-ai-gate-do-i-need/">Choose the right Gate</a><a class="button button-secondary" href="/products/complete-gate-system/">View the complete system</a></div></div><div class="gate-gallery"><img src="${bundle.image}" alt="Sapiver Forge Applied AI Gate System" width="1200" height="1200"></div></section><section class="posts"><h2>The four decisions</h2><ol>${products.map((product) => `<li><h3><a href="/products/${product.slug}/">${esc(product.shortName)}</a></h3><p>${esc(product.question)}</p><p>${esc(product.description)}</p></li>`).join("")}</ol></section><section class="gate-trust"><div><p class="product-kicker">What the tools are</p><h3>Structured human decision support.</h3><p>They make checks, evidence, ownership and decisions easier to record and repeat.</p></div><div><p class="product-kicker">What the tools are not</p><h3>Automated approval or legal advice.</h3><p>They do not guarantee accuracy, safety, compliance or successful outcomes.</p></div></section>`;
write(path.join(PUBLIC, "gate-system", "index.html"), page({
  title: "Sapiver Forge Applied AI Gate System",
  description: "Practical human-led AI decision, workflow-control, output-release and outcome-review tools for creators, freelancers and small teams.",
  pathname: gateSystemPath,
  body: gateSystemBody,
  structured: { "@context": "https://schema.org", "@graph": [{ "@type": "WebPage", name: "Sapiver Forge Applied AI Gate System", url: canonical(gateSystemPath) }, { "@type": "ItemList", itemListElement: products.map((product, index) => ({ "@type": "ListItem", position: index + 1, item: productSchema(product, `/products/${product.slug}/`) })) }] }
}));

const llms = `# Sapiver Forge\n\n> Practical human-led AI decision, workflow-control, output-release and outcome-review tools for creators, freelancers and small teams.\n\nSapiver Forge is a Sapiver Press product line. Its tools structure human judgement; they do not replace legal, compliance, security or professional advice and do not guarantee accuracy, safety or business outcomes.\n\n## Core pages\n\n- [Applied AI Gate System](${canonical(gateSystemPath)}): overview of the four-stage system.\n- [Which AI Gate do I need?](${canonical(selectorPath)}): problem-led product selector.\n- [Complete Gate System](${canonical(bundlePath)}): all four Gates plus the bundle-exclusive Agent & Connector Safety Add-on.\n- [AI Gate Workspace](${canonical(workspacePath)}): Notion workspace for recording assessments and decisions.\n\n## Individual Gates\n\n${products.map((product) => `- [${product.name}](${canonical(`/products/${product.slug}/`)}): ${product.question}`).join("\n")}\n\n## Guidance and evidence\n\n- [Evergreen guides](${canonical("/guides/")}): durable, source-backed explanations.\n- [Topics](${canonical("/topics/")}): themed AI coverage.\n- [Reports](${canonical("/reports/")}): published Sapiver Forge reports.\n- [Podcast](${canonical("/podcast/")}): Sapiver Forge AI Briefing.\n`;
write(path.join(PUBLIC, "llms.txt"), llms);

const sitemapPath = path.join(PUBLIC, "sitemap.xml");
if (!fs.existsSync(sitemapPath)) throw new Error("Expected public/sitemap.xml after the existing site build.");
let sitemap = fs.readFileSync(sitemapPath, "utf8");
const maintainedPaths = [gateSystemPath, selectorPath, bundlePath, workspacePath, ...products.map((product) => `/products/${product.slug}/`)];
const lastmod = new Date().toISOString().slice(0, 10);
const additions = maintainedPaths.filter((pathname) => !sitemap.includes(canonical(pathname))).map((pathname) => `  <url><loc>${canonical(pathname)}</loc><lastmod>${lastmod}</lastmod></url>`).join("\n");
if (additions) sitemap = sitemap.replace("</urlset>", `${additions}\n</urlset>`);
write(sitemapPath, sitemap);

const homepagePath = path.join(PUBLIC, "index.html");
if (!fs.existsSync(homepagePath)) throw new Error("Expected public/index.html after the existing site build.");
let homepage = fs.readFileSync(homepagePath, "utf8");
homepage = homepage
  .replace('href="#choose-a-gate"', 'href="/which-ai-gate-do-i-need/"')
  .replaceAll('href="#opportunity-gate"', 'href="/products/opportunity-gate/"')
  .replaceAll('href="#workflow-control-gate"', 'href="/products/workflow-control-gate/"')
  .replaceAll('href="#output-release-gate"', 'href="/products/output-release-gate/"')
  .replaceAll('href="#outcome-review-gate"', 'href="/products/outcome-review-gate/"')
  .replaceAll("Agent Connection Safety add-on", "AI Agent & Connector Safety Add-on")
  .replaceAll("Agent Connector Safety add-on", "AI Agent & Connector Safety Add-on");
if (!homepage.includes('/gate-system/')) {
  homepage = homepage.replace('<nav aria-label="Site links">', '<nav aria-label="Site links"><a href="/gate-system/">Gate System</a><a href="/which-ai-gate-do-i-need/">Choose a Gate</a>');
}
write(homepagePath, homepage);

const requiredFiles = ["llms.txt", "gate-system/index.html", "which-ai-gate-do-i-need/index.html", `products/${bundle.slug}/index.html`, `products/${workspace.slug}/index.html`, ...products.map((product) => `products/${product.slug}/index.html`)];
for (const relative of requiredFiles) {
  if (!fs.existsSync(path.join(PUBLIC, relative))) throw new Error(`Missing generated sales-discoverability file: ${relative}`);
}
for (const product of products) {
  const html = fs.readFileSync(path.join(PUBLIC, "products", product.slug, "index.html"), "utf8");
  for (const expected of [product.name, product.checkoutUrl, product.price, canonical(`/products/${product.slug}/`)]) {
    if (!html.includes(expected)) throw new Error(`${product.slug} page is missing expected value: ${expected}`);
  }
}
const customerFacing = requiredFiles.map((relative) => fs.readFileSync(path.join(PUBLIC, relative), "utf8")).join("\n");
if (/Clear\s*forge/i.test(customerFacing)) throw new Error("Legacy Sapiver Forge branding found in generated sales-discoverability output.");
if (warnings.length) console.warn(`Sales discoverability warnings:\n- ${warnings.join("\n- ")}`);
console.log(`Published ${requiredFiles.length} Sapiver Forge sales-discoverability files and updated the sitemap.`);
