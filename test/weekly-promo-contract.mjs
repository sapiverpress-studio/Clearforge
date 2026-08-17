import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const week = process.env.WEEK_ID || 'contract-test';
process.env.WEEK_ID = week;
fs.rmSync(`weekly-output/${week}`, { recursive: true, force: true });
await import('../src/generate-fresh-weekly-promo-pack.mjs');

const dir = `weekly-output/${week}`;
const pack = JSON.parse(fs.readFileSync(`${dir}/weekly-pack.json`, 'utf8'));

assert.equal(pack.brand, 'Sapiver Forge');
assert.equal(pack.version, 4);
assert.equal(pack.posts.length, 7);
assert.equal(new Set(pack.posts.map(p => p.day)).size, 7);
assert.equal(new Set(pack.posts.map(p => p.hook)).size, 7);
assert.equal(pack.generation.ai_api_used, false);
assert.equal(pack.generation.paid_media_calls, 0);
assert.equal(pack.generation.automated_audio, false);
assert.equal(pack.generation.automated_video, false);
assert.equal(pack.plan.guardrails.no_paid_ads, true);
assert.equal(pack.plan.guardrails.no_new_product_expansion, true);
assert.equal(pack.plan.guardrails.subscriber_measurement, 'Kit');
assert.match(pack.plan.guardrails.primary_free_offer, /Notion/i);
assert.match(pack.plan.guardrails.active_paid_product, /Gate System|bundle/i);

assert.equal(pack.posts.filter(p => p.purpose === 'paid-offer-promotion').length, 1);
assert.equal(pack.posts.filter(p => /Notion/i.test(p.destination_name)).length, 6);
assert.ok(pack.posts.every(p => p.hook && p.spoken_script && p.tiktok_caption && p.youtube_title && p.youtube_description && p.facebook_post));
assert.ok(pack.posts.every(p => /#SapiverForge/.test(p.tiktok_caption)));
assert.ok(pack.posts.every(p => /No video or audio is generated/i.test(p.manual_video_note)));
assert.ok(!/Clearforge|Clear Forge/i.test(JSON.stringify(pack)));

for (const file of ['weekly-pack.json','candidate-id.txt','weekly-content-kit.md','human-review.html','README.txt']) {
  assert.ok(fs.existsSync(`${dir}/${file}`), `Missing output ${file}`);
  assert.ok(fs.statSync(`${dir}/${file}`).size > 0, `Empty output ${file}`);
}
assert.equal(fs.existsSync(`${dir}/audio`), false, 'Audio directory must not be generated.');
assert.equal(fs.existsSync(`${dir}/video`), false, 'Video directory must not be generated.');

const markdown = fs.readFileSync(`${dir}/weekly-content-kit.md`, 'utf8');
const review = fs.readFileSync(`${dir}/human-review.html`, 'utf8');
assert.match(markdown, /free Notion workspace is the primary CTA/i);
assert.match(review, /No video or audio generation/i);
assert.match(review, /HUMAN REVIEW REQUIRED/i);

const nextWeek = 'freshness-next-run';
fs.rmSync(`weekly-output/${nextWeek}`, { recursive: true, force: true });
const currentRun = Number.parseInt(process.env.GITHUB_RUN_NUMBER || '100', 10) || 100;
execFileSync(process.execPath, ['src/generate-fresh-weekly-promo-pack.mjs'], {
  stdio: 'pipe',
  env: { ...process.env, WEEK_ID: nextWeek, GITHUB_RUN_NUMBER: String(currentRun + 1), GITHUB_RUN_ATTEMPT: '1' }
});
const next = JSON.parse(fs.readFileSync(`weekly-output/${nextWeek}/weekly-pack.json`, 'utf8'));
assert.notEqual(pack.candidate_id, next.candidate_id);
assert.ok(pack.posts.some((p, i) => p.hook !== next.posts[i].hook), 'Next run must rotate content.');
fs.rmSync(`weekly-output/${nextWeek}`, { recursive: true, force: true });

console.log('Sapiver Forge weekly content kit contract passed: 7 items, one paid promotion, six Notion/list-growth routes, zero generated audio/video, zero paid media calls.');
