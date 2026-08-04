import fs from 'node:fs';
import assert from 'node:assert/strict';

const week = process.env.WEEK_ID || 'contract-test';
process.env.WEEK_ID = week;
await import('../src/generate-weekly-promo-pack.mjs');

const pack = JSON.parse(fs.readFileSync(`weekly-output/${week}/weekly-pack.json`, 'utf8'));
assert.equal(pack.brand, 'Sapiver Forge');
assert.equal(pack.posts.length, 7);
assert.equal(new Set(pack.posts.map((item) => item.day)).size, 7);
assert.ok(pack.posts.every((item) => item.narration && item.tiktok_caption && item.youtube_title && item.youtube_description && item.product_url));
assert.equal(pack.research_used, false);
assert.equal(pack.news_used, false);
assert.ok(!/Clearforge|Clear Forge/i.test(JSON.stringify(pack)));

const workflow = fs.readFileSync('.github/workflows/weekly-promo-pack.yml', 'utf8');
const renderer = fs.readFileSync('src/render-weekly-promo-video.mjs', 'utf8');
assert.match(workflow, /mkdir -p "\$OUT\/audio" "\$OUT\/video"/);
assert.match(workflow, /test -s "\$audio"/);
assert.match(workflow, /test -s "\$video"/);
assert.match(workflow, /node src\/render-weekly-promo-video\.mjs/);
assert.match(workflow, /find \. -type f ! -name 'file-hashes\.sha256'/);
assert.match(workflow, /sha256sum -c file-hashes\.sha256/);
assert.doesNotMatch(workflow, /find \. -type f -print0\s*\|[^\n]*file-hashes\.sha256/);
assert.match(renderer, /'-nostdin'/);
assert.match(renderer, /function wrap\(/);
assert.match(renderer, /cards: 4/);
assert.match(renderer, /1080x1920/);
assert.match(renderer, /textfile=/);
assert.match(renderer, /safe-area weekly vertical video renderer|HUMAN CONTROL FOR AI WORKFLOWS/);

console.log('Weekly promotional pack contract passed.');
