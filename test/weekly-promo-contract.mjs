import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const week=process.env.WEEK_ID||'contract-test';
process.env.WEEK_ID=week;
await import('../src/generate-fresh-weekly-promo-pack.mjs');

const pack=JSON.parse(fs.readFileSync(`weekly-output/${week}/weekly-pack.json`,'utf8'));
const facts=JSON.parse(fs.readFileSync('data/sapiver-forge-products.json','utf8'));
assert.equal(pack.brand,'Sapiver Forge');
assert.equal(pack.version,3);
assert.equal(pack.posts.length,7);
assert.equal(new Set(pack.posts.map(p=>p.day)).size,7);
assert.equal(new Set(pack.posts.map(p=>p.hook)).size,7);
assert.equal(new Set(pack.posts.map(p=>p.narration)).size,7);
assert.ok(pack.content_rotation?.run_number);
assert.ok(pack.posts.every(p=>p.hook&&p.second_hook&&p.narration&&p.tiktok_caption&&p.youtube_title&&p.youtube_description&&p.product_url));
assert.ok(pack.posts.every(p=>p.product_slug&&p.product_image&&p.isla_opener));
assert.ok(pack.posts.every(p=>/link in bio/i.test(p.tiktok_caption)&&/link in bio/i.test(p.facebook_post)&&/link in bio/i.test(p.social_comment)));
assert.ok(pack.posts.every(p=>Array.isArray(p.hashtags)&&p.hashtags.length>=3&&p.hashtags.includes('#SapiverForge')));
assert.ok(pack.posts.every(p=>!/https?:\/\//i.test(p.social_comment+p.tiktok_caption+p.facebook_post+p.youtube_description)));
assert.equal(pack.visual_system.approved_product_artwork,true);
assert.equal(pack.visual_system.isla_source_repository,'sapiverpress-studio/SapiverPress_comic_public');
assert.equal(pack.research_used,false);
assert.equal(pack.news_used,false);
assert.ok(!/Clearforge|Clear Forge/i.test(JSON.stringify(pack)));

const slugs=pack.posts.map(p=>p.product_slug);
for(const slug of ['opportunity','workflow-control','output-release','outcome-review','notion','bundle']) assert.ok(slugs.includes(slug),`Weekly pack missing ${slug}`);
assert.equal(slugs.filter(s=>['opportunity','workflow-control','output-release','outcome-review'].includes(s)).length,5);

for(const product of facts.products){
  assert.ok(product.image,`Product image mapping missing for ${product.slug}`);
  assert.ok(fs.existsSync(product.image),`Approved product image missing: ${product.image}`);
  assert.ok(fs.statSync(product.image).size>0,`Approved product image is empty: ${product.image}`);
}

const nextWeek='freshness-next-run';
fs.rmSync(`weekly-output/${nextWeek}`,{recursive:true,force:true});
const currentRun=Number.parseInt(process.env.GITHUB_RUN_NUMBER||'100',10)||100;
execFileSync(process.execPath,['src/generate-fresh-weekly-promo-pack.mjs'],{stdio:'pipe',env:{...process.env,WEEK_ID:nextWeek,GITHUB_RUN_NUMBER:String(currentRun+1),GITHUB_RUN_ATTEMPT:'1'}});
const next=JSON.parse(fs.readFileSync(`weekly-output/${nextWeek}/weekly-pack.json`,'utf8'));
const changed=pack.posts.filter((p,i)=>p.narration!==next.posts[i].narration).length;
assert.equal(changed,7,`Freshness regression: ${changed}/7 posts changed; all seven must change on the next run`);
assert.notEqual(pack.candidate_id,next.candidate_id);
fs.rmSync(`weekly-output/${nextWeek}`,{recursive:true,force:true});

const workflow=fs.readFileSync('.github/workflows/weekly-promo-pack.yml','utf8');
const renderer=fs.readFileSync('src/render-weekly-promo-video.mjs','utf8');
const generator=fs.readFileSync('src/generate-fresh-weekly-promo-pack.mjs','utf8');
const packageJson=fs.readFileSync('package.json','utf8');
const approval=fs.readFileSync('.github/workflows/approve-weekly-promo.yml','utf8');
const repair=fs.readFileSync('.github/workflows/repair-weekly-promo-videos.yml','utf8');
assert.match(packageJson,/generate-fresh-weekly-promo-pack\.mjs/);
assert.match(generator,/GITHUB_RUN_NUMBER/);
assert.match(generator,/GITHUB_RUN_ATTEMPT/);
assert.match(generator,/Freshness guard/);
assert.match(generator,/Parents using AI at work/);
assert.match(generator,/AI should preserve time/);
assert.match(workflow,/repository: sapiverpress-studio\/SapiverPress_comic_public/);
assert.match(workflow,/assets\/sapiver-forge\/isla-hook\.mp4/);
assert.match(workflow,/Verify visual assets before generation or paid calls/);
assert.match(workflow,/node src\/render-weekly-promo-video\.mjs/);
assert.match(workflow,/sha256sum -c file-hashes\.sha256/);
assert.match(renderer,/human_motion_opener/);
assert.match(renderer,/approved_product_artwork/);
assert.match(renderer,/1080x1920/);
assert.match(renderer,/text='LINK IN BIO'/);
assert.match(renderer,/visible_url: false/);
assert.doesNotMatch(renderer,/sapiverpress\.co\.uk/i);
assert.match(approval,/social_comment:p\.social_comment/);
assert.match(repair,/Rerender seven videos using existing narration/);
assert.doesNotMatch(repair,/ELEVENLABS_API_KEY|api\.elevenlabs\.io/);

console.log(`Weekly promotional pack contract passed; next-run freshness ${changed}/7.`);
