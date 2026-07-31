import fs from "node:fs";
import path from "node:path";

const homepagePath = path.join(process.cwd(), "public", "index.html");
if (!fs.existsSync(homepagePath)) {
  throw new Error(`Homepage not found: ${homepagePath}`);
}

const html = fs.readFileSync(homepagePath, "utf8");
const hrefs = [...html.matchAll(/href=["']([^"']+)["']/g)].map((match) => match[1]);

const allowedPayhipLinks = new Set([
  "https://payhip.com/b/cmklU",
  "https://payhip.com/b/4rcSt",
  "https://payhip.com/b/qBPip",
  "https://payhip.com/b/pkSEY",
  "https://payhip.com/b/rgFXP",
  "https://payhip.com/b/gq89f"
]);

const commerceLinks = hrefs.filter((href) => /(?:^|\.)payhip\.com\//i.test(href) || /(?:^|\.)etsy\.com\//i.test(href));
const forbiddenLinks = commerceLinks.filter((href) => !allowedPayhipLinks.has(href));

if (forbiddenLinks.length) {
  throw new Error(`Homepage contains unapproved external product links: ${[...new Set(forbiddenLinks)].join(", ")}`);
}

for (const required of allowedPayhipLinks) {
  if (!hrefs.includes(required)) {
    throw new Error(`Homepage is missing an approved Sapiver Forge product link: ${required}`);
  }
}

for (const requiredSection of [
  "Latest practical guidance",
  "Recent Sapiver Forge articles",
  "Sapiver Forge AI Briefing",
  "Explore the wider Sapiver Forge library",
  "Get the weekly Sapiver Forge digest"
]) {
  if (!html.includes(requiredSection)) {
    throw new Error(`Homepage is missing required guidance content: ${requiredSection}`);
  }
}

console.log("Homepage keeps guidance content and contains only approved Sapiver Forge Payhip product links.");
