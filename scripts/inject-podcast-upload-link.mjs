import fs from "node:fs";

const file = "public/daily-brief/upload/index.html";
if (!fs.existsSync(file)) throw new Error(`Missing generated upload page: ${file}`);
let html = fs.readFileSync(file, "utf8");
if (html.includes('/daily-brief/podcast-upload/')) {
  console.log('Podcast upload link already present.');
  process.exit(0);
}
const marker = '<section class="posts publisher-upload">';
if (!html.includes(marker)) throw new Error('Could not find Daily Brief upload form section.');
const chooser = `<section class="posts"><div class="card"><h2>What are you adding today?</h2><p><a class="button" href="/daily-brief/upload/">Upload video</a> <a class="button" href="/daily-brief/podcast-upload/">Upload podcast audio</a></p><p><small>Both tools use the same publisher password. Video and audio creation stay manual.</small></p></div></section>`;
html = html.replace(marker, chooser + marker);
fs.writeFileSync(file, html, "utf8");
console.log('Added podcast upload shortcut beside the video uploader.');
