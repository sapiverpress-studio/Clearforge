import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const facts = JSON.parse(fs.readFileSync('data/sapiver-forge-products.json', 'utf8'));
const week = process.env.WEEK_ID || new Date().toISOString().slice(0, 10);
const out = path.join('weekly-output', week);
fs.mkdirSync(path.join(out, 'audio'), { recursive: true });
fs.mkdirSync(path.join(out, 'video'), { recursive: true });
const by = Object.fromEntries(facts.products.map((product) => [product.slug, product]));

const plans = [
  ['Monday', 'problem-awareness', 'output-release', 'AI output can look finished before it is safe to release.', 'A polished answer can still contain incorrect facts, private information, missing permissions or the wrong destination. Sapiver Forge gives a named person a structured release decision before AI-assisted work leaves the business.'],
  ['Tuesday', 'practical-checklist', 'output-release', 'Five checks before AI-assisted work leaves your business.', 'Check the material facts, confidential information, ownership, intended recipient and the person responsible for approval. A quick reread is not the same as a recorded release decision.'],
  ['Wednesday', 'how-it-works', 'workflow-control', 'What does a human verification gate actually do?', 'It pauses an automated workflow at a defined point, presents the evidence and requires a named person to decide whether the workflow may continue. The AI does not approve its own work.'],
  ['Thursday', 'common-mistake', 'opportunity', 'Using AI because the tool is available is not a business case.', 'Before building an AI workflow, compare it with the current method and the best non-AI alternative. The Opportunity Gate helps decide whether AI belongs in the task at all.'],
  ['Friday', 'direct-product', 'output-release', 'Client-facing AI work needs a release decision.', 'The Sapiver Forge AI Output Release Gate helps freelancers, creators and small teams review accuracy, privacy, ownership, destination and approval before work is sent or published.'],
  ['Saturday', 'discussion', 'outcome-review', 'When did you last check whether your AI workflow still helps?', 'A workflow can remain active long after its costs, errors or risks outweigh the benefit. The Outcome Review Gate records whether to continue, change, pause or retire it.'],
  ['Sunday', 'system-promotion', 'bundle', 'Human control should cover the whole AI workflow.', 'Sapiver Forge structures four decisions: whether AI should be used, how the workflow is controlled, whether an output is ready to leave and whether the workflow remains worthwhile. Each decision stays with a named human.'],
];

const posts = plans.map(([day, angle, slug, hook, body], index) => {
  const product = by[slug];
  if (!product?.image) throw new Error(`Missing approved product artwork mapping for ${slug}.`);
  const narration = `${hook} ${body} ${index === 6 ? 'Explore the complete Sapiver Forge gate system.' : `See the ${product.name}.`}`;
  return {
    index: index + 1,
    day,
    angle,
    product_slug: slug,
    product: product.name,
    product_url: product.url,
    product_image: product.image,
    isla_opener: facts.weekly_video.isla_opener,
    hook,
    narration,
    tiktok_caption: `${hook}\n\n${body}\n\n${product.url}\n#SapiverForge #HumanInTheLoop #AIGovernance`,
    youtube_title: `${hook.replace(/[.?]$/, '')} | Sapiver Forge #Shorts`,
    youtube_description: `${body}\n\n${product.name}: ${product.url}\n\n#SapiverForge #HumanInTheLoop #AIGovernance`,
    facebook_post: `${hook}\n\n${body}\n\n${product.name}: ${product.url}`,
    visual_cards: [hook, product.purpose, 'A named human decides', product.name],
  };
});

const core = {
  version: 2,
  brand: facts.brand,
  week,
  generated_at: new Date().toISOString(),
  research_used: false,
  news_used: false,
  visual_system: {
    isla_source_repository: facts.weekly_video.isla_source_repository,
    isla_opener: facts.weekly_video.isla_opener,
    approved_product_artwork: true,
  },
  posts,
};
const candidate_id = crypto.createHash('sha256').update(JSON.stringify(core)).digest('hex');
const pack = { ...core, candidate_id };
fs.writeFileSync(path.join(out, 'weekly-pack.json'), `${JSON.stringify(pack, null, 2)}\n`);
fs.writeFileSync(path.join(out, 'candidate-id.txt'), `${candidate_id}\n`);
fs.writeFileSync(path.join(out, 'README.txt'), `Sapiver Forge weekly promotional pack\nWeek: ${week}\nCandidate ID: ${candidate_id}\nVisual system: Isla human-motion opener plus existing approved product artwork.\nNothing is approved until the approval workflow is run with this exact ID.\n`);

const esc = (value) => String(value).replace(/[&<>\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);
const cards = posts.map((post) => `<article>
  <h2>${post.day}: ${esc(post.hook)}</h2>
  <p><strong>Product:</strong> ${esc(post.product)}</p>
  <p><strong>Isla opener:</strong> <code>${esc(post.isla_opener)}</code></p>
  <p><strong>Product artwork:</strong> <code>${esc(post.product_image)}</code></p>
  <video controls preload="metadata" width="360" src="video/${String(post.index).padStart(2, '0')}-${post.day.toLowerCase()}.mp4"></video>
  <h3>Narration</h3><p>${esc(post.narration)}</p>
  <h3>TikTok caption</h3><pre>${esc(post.tiktok_caption)}</pre>
  <h3>YouTube</h3><p><strong>${esc(post.youtube_title)}</strong></p><pre>${esc(post.youtube_description)}</pre>
</article>`).join('');
fs.writeFileSync(path.join(out, 'human-review.html'), `<!doctype html><meta charset="utf-8"><title>Sapiver Forge weekly review</title><style>body{font:16px/1.5 system-ui;max-width:1000px;margin:auto;padding:24px;background:#f5f2ea;color:#102437}header,article{background:white;border:1px solid #d8e0e6;border-radius:12px;padding:18px;margin:14px 0}header{background:#071827;color:white}pre{white-space:pre-wrap}video{max-width:100%;background:#071827;border-radius:10px}code{overflow-wrap:anywhere}</style><header><h1>Sapiver Forge weekly promotional pack</h1><p>Week ${week}</p><p>Candidate ID: <code>${candidate_id}</code></p><p><strong>Visual standard:</strong> human-motion Isla opener, approved product artwork, wrapped safe-area captions and branded close.</p><p><strong>AWAITING HUMAN APPROVAL — nothing has been published.</strong></p></header>${cards}`);
console.log(JSON.stringify({ week, candidate_id, out, posts: 7, visual_system: core.visual_system }));
