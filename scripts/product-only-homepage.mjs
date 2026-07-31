import fs from "node:fs";
import path from "node:path";

const homepagePath = path.join(process.cwd(), "public", "index.html");
if (!fs.existsSync(homepagePath)) {
  throw new Error(`Homepage not found: ${homepagePath}`);
}

let html = fs.readFileSync(homepagePath, "utf8");

html = html.replace(
  /<nav aria-label="Site links">[\s\S]*?<\/nav>/,
  `<nav aria-label="Site links">
      <a href="/#products">Sapiver Forge packs</a>
      <a href="/#gate-workspace">Sapiver Forge Notion pack</a>
    </nav>`
);

const trustSection = html.match(/<section class="gate-trust"[\s\S]*?<\/section>/);
if (!trustSection) {
  throw new Error("Could not find the Gate trust section that closes the product storefront.");
}
const trustEnd = html.indexOf(trustSection[0]) + trustSection[0].length;
const mainEnd = html.indexOf("</main>", trustEnd);
if (mainEnd === -1) {
  throw new Error("Could not find the homepage main closing tag.");
}
html = `${html.slice(0, trustEnd)}${html.slice(mainEnd)}`;

html = html.replace(
  /<p><a href="\/#products">Products<\/a>[\s\S]*?<\/p>/,
  `<p><a href="/#products">Sapiver Forge packs</a> · <a href="/#gate-workspace">Sapiver Forge Notion pack</a></p>`
);

html = html.replace(/\n\s*<link rel="alternate"[^>]+>/g, "");

const forbiddenHomepagePromotions = [
  "Latest practical guidance",
  "Recent Sapiver Forge articles",
  "Sapiver Forge AI Briefing",
  "Explore the wider Sapiver Forge library",
  "weekly Sapiver Forge digest",
  ">Guides<",
  ">Topics<",
  ">Reports<",
  ">Podcast<",
  "Sapiver Forge Pro"
];

const remaining = forbiddenHomepagePromotions.filter((text) => html.includes(text));
if (remaining.length) {
  throw new Error(`Product-only homepage still promotes removed material: ${remaining.join(", ")}`);
}

for (const required of [
  "Sapiver Forge Applied AI Gate System",
  "Sapiver Forge AI Gate Workspace",
  "https://payhip.com/b/cmklU",
  "https://payhip.com/b/gq89f",
  "https://sapiver-press.kit.com/5147ce2817"
]) {
  if (!html.includes(required)) {
    throw new Error(`Product-only homepage lost required offer: ${required}`);
  }
}

fs.writeFileSync(homepagePath, html, "utf8");
console.log("Homepage now promotes only Sapiver Forge Gate packs and the Sapiver Forge Notion pack.");
