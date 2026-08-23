import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const publicDir = path.join(ROOT, "public");
const editionsPath = path.join(publicDir, "daily-brief", "intelligence", "editions.json");

const exactReplacements = new Map([
  [">Weekly digest<", ">Daily Brief email<"],
  ["Get the weekly Sapiver Forge digest", "Get the Sapiver Forge Daily Brief"],
  ["One calm email covering what changed, why it matters and what is worth testing. No daily inbox noise.", "One concise weekday briefing covering what changed, why it matters and what is worth watching."],
  ["Join the weekly digest", "Join the Daily Brief"],
  ["Reports and the weekly digest", "Reports and Daily Brief email"],
  ["receive one calm summary each week.", "receive the verified Daily Brief by email on weekdays."]
]);

function patchWording(file) {
  if (!fs.existsSync(file)) return;
  let html = fs.readFileSync(file, "utf8");
  for (const [from, to] of exactReplacements) html = html.split(from).join(to);
  fs.writeFileSync(file, html, "utf8");
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute));
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(absolute);
  }
  return files;
}

for (const file of walk(publicDir)) patchWording(file);

if (!fs.existsSync(editionsPath)) {
  console.log("No approved Daily Brief intelligence editions are published yet; wording patch complete.");
  process.exit(0);
}

let editions = [];
try { editions = JSON.parse(fs.readFileSync(editionsPath, "utf8")); } catch {}
if (!Array.isArray(editions) || !editions.length) {
  console.log("Daily Brief intelligence archive is empty; wording patch complete.");
  process.exit(0);
}

const latest = editions[0];
const esc = (value) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const hubPath = path.join(publicDir, "daily-brief", "index.html");
if (!fs.existsSync(hubPath)) throw new Error("Daily Brief hub was not built.");
let hub = fs.readFileSync(hubPath, "utf8");
const section = `<section class="posts latest-guidance" id="latest-guidance"><p class="eyebrow">Latest verified intelligence</p><h2><a href="${esc(latest.url)}">${esc(latest.title)}</a></h2><p>${esc(latest.practical_takeaway || `${latest.story_count || 0} verified stories with source links and separated interpretation.`)}</p><div class="report-actions"><a class="button" href="${esc(latest.url)}">Read the latest Daily Brief</a><a class="button button-secondary" href="/daily-brief/intelligence/">Browse the intelligence archive</a></div></section>`;
const pattern = /<section class="posts latest-guidance" id="latest-guidance">[\s\S]*?<\/section>/;
if (pattern.test(hub)) hub = hub.replace(pattern, section);
else hub = hub.replace("<main class=\"content\">", `<main class="content">${section}`);
hub = hub.replace("Open the latest briefing, watch recent videos, listen to the podcast or browse the report archive.", "Read the latest verified intelligence, watch recent videos, listen to the podcast or browse the report archive.");
fs.writeFileSync(hubPath, hub, "utf8");
console.log(`Injected latest approved Daily Brief intelligence ${latest.date} into the website hub.`);
