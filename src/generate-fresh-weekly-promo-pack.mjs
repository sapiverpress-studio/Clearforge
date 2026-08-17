import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const facts = JSON.parse(fs.readFileSync('data/sapiver-forge-products.json', 'utf8'));
const week = process.env.WEEK_ID || new Date().toISOString().slice(0, 10);
const runNumber = Number.parseInt(process.env.GITHUB_RUN_NUMBER || process.env.PROMO_RUN_NUMBER || '1', 10) || 1;
const runAttempt = Number.parseInt(process.env.GITHUB_RUN_ATTEMPT || process.env.PROMO_RUN_ATTEMPT || '1', 10) || 1;
const rotation = runNumber * 5 + runAttempt;
const out = path.join('weekly-output', week);
fs.mkdirSync(out, { recursive: true });

const products = Object.fromEntries(facts.products.map(p => [p.slug, p]));
const notion = products.notion;
const bundle = products.bundle;
if (!notion || !bundle) throw new Error('Expected notion and bundle products in data/sapiver-forge-products.json');

const planStart = new Date('2026-08-16T00:00:00Z');
const now = new Date();
const elapsedMonths = Math.max(0, (now.getUTCFullYear() - planStart.getUTCFullYear()) * 12 + now.getUTCMonth() - planStart.getUTCMonth());
const planMonth = Math.min(12, elapsedMonths + 1);
const phase = planMonth <= 3 ? 'Prove attention and capture' : planMonth <= 6 ? 'Improve conversion' : planMonth <= 9 ? 'Strengthen evidence and retention' : 'Consolidate what converts';

const guardrails = {
  business_objective: 'Build Sapiver Forge toward £1,000+ regular monthly profit without adding paid software or unnecessary complexity.',
  active_paid_product: bundle.name,
  primary_free_offer: notion.name,
  subscriber_measurement: 'Kit',
  no_paid_ads: true,
  no_new_product_expansion: true,
  no_automated_audio_generation: true,
  no_automated_video_generation: true,
  human_review_required: true
};

const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const pillars = [
  {
    id: 'decision-before-tool',
    hooks: [
      'Before paying for another AI tool, ask what problem it actually removes.',
      'A new AI subscription is not progress if the old process already works.',
      'The first AI decision is whether the task needs AI at all.'
    ],
    points: [
      'Small businesses rarely need three overlapping AI subscriptions. Compare the current method, a simple non-AI option and the real benefit first.',
      'Extra tools create extra checking, setup and renewal decisions. Count those costs before calling something automation.',
      'A five-minute task can become a thirty-minute AI project. The useful question is whether the whole job gets easier.'
    ]
  },
  {
    id: 'human-control',
    hooks: [
      'AI checking its own work is not the same as human approval.',
      'Put the human decision before the point of no return.',
      'If nobody owns the final decision, the workflow is not controlled.'
    ],
    points: [
      'Drafting can be automated while sending, publishing or changing customer data still waits for a named person.',
      'Good control is not watching every step. It is putting one clear human decision at the point that matters.',
      'Define what AI may do, what evidence the reviewer sees and who is allowed to approve the result.'
    ]
  },
  {
    id: 'whole-process-time',
    hooks: [
      'If you have to keep checking the AI, is it actually saving time?',
      'Generation time is not the same as job time.',
      'AI should give time back, not move the work into checking.'
    ],
    points: [
      'Thirty seconds of generation plus ten minutes of checking is still a ten-minute job. Measure the complete process.',
      'Correction, supervision and maintenance belong in the time calculation, even when the AI output itself is instant.',
      'The best workflow is not the cleverest one. It is the one that reliably reduces work and uncertainty.'
    ]
  },
  {
    id: 'release-decision',
    hooks: [
      'Looks finished and safe to release are two different things.',
      'Fluent AI output can still contain the wrong fact, recipient or permission.',
      'Stop rereading AI output and define one release check instead.'
    ],
    points: [
      'Check material facts, privacy, rights, destination and named human approval once before the work leaves the business.',
      'A polished answer can still be unsafe to send. Release needs criteria, not a vague feeling that it looks fine.',
      'One deliberate release decision is usually cheaper than repeated checking afterwards.'
    ]
  },
  {
    id: 'outcome-review',
    hooks: [
      'Working is not the same as worthwhile.',
      'An AI workflow can run perfectly and still be a bad use of time.',
      'Review the automation after it has met real work, not just the demo.'
    ],
    points: [
      'Measure time saved, correction work, failures, subscriptions and maintenance, then continue, change, pause or retire it.',
      'A workflow that saved time six months ago can become a burden after the task, client or subscription changes.',
      'The original promise matters less than the evidence from actual use.'
    ]
  },
  {
    id: 'record-decisions',
    hooks: [
      'AI decisions disappear when they live in messages and half-finished notes.',
      'A decision you cannot find later has to be made twice.',
      'Keep the AI decision, owner and evidence together.'
    ],
    points: [
      'A simple workspace can keep whether AI should be used, what could go wrong, who checks it and whether it was worthwhile in one place.',
      'Recording the owner, evidence and conditions makes the next review faster and reduces reliance on memory.',
      'The free Sapiver Forge workspace is designed to make the decision visible before buying more software.'
    ]
  },
  {
    id: 'practical-system',
    hooks: [
      'You do not need more AI policy; you need clearer decision points.',
      'Four human decisions can make an AI workflow much easier to trust.',
      'Decide before, during, before release and after real use.'
    ],
    points: [
      'The Sapiver Forge Gate System covers whether AI belongs in the task, how the workflow is controlled, whether output can leave and whether the workflow should continue.',
      'The aim is not extra bureaucracy. It is fewer vague checks and clearer responsibility.',
      'A small number of deliberate gates can reduce rework, uncertainty and accidental release.'
    ]
  }
];

const hashtags = ['#SapiverForge','#SmallBusinessAI','#HumanInTheLoop','#ResponsibleAI'];
const posts = days.map((day, index) => {
  const pillar = pillars[(rotation + index) % pillars.length];
  const hook = pillar.hooks[(rotation + index * 2) % pillar.hooks.length];
  const insight = pillar.points[(rotation * 2 + index) % pillar.points.length];
  const isPaidDay = index === 4;
  const isReviewDay = index === 6;
  const destination = isPaidDay ? bundle : notion;
  const cta = isPaidDay
    ? 'If you need the complete four-gate process, the Applied AI Gate System bundle is in the link in bio.'
    : isReviewDay
      ? 'Use the free Sapiver Forge Notion workspace to record the decision and review what actually worked. Link in bio.'
      : 'The free Sapiver Forge Notion workspace helps you record these decisions. Link in bio.';
  const spoken_script = `${hook} ${insight}`;
  const caption = `${hook}\n\n${insight}\n\n${cta}\n\n${hashtags.join(' ')}`;
  return {
    index: index + 1,
    day,
    pillar: pillar.id,
    purpose: isPaidDay ? 'paid-offer-promotion' : isReviewDay ? 'weekly-review-and-list-growth' : 'useful-organic-and-list-growth',
    hook,
    spoken_script,
    practical_point: insight,
    cta,
    destination_name: destination.name,
    destination_url: destination.url,
    hashtags,
    tiktok_caption: caption,
    youtube_title: `${hook.replace(/[.?]$/, '')} | Sapiver Forge #Shorts`,
    youtube_description: `${insight}\n\n${cta}\n\n${hashtags.join(' ')} #Shorts`,
    facebook_post: `${hook}\n\n${insight}\n\n${cta}\n\n${hashtags.join(' ')}`,
    manual_video_note: 'Optional manual phone video only. No video or audio is generated by this workflow.'
  };
});

if (posts.length !== 7) throw new Error('Weekly kit must contain exactly seven daily items.');
if (new Set(posts.map(p => p.hook)).size !== 7) throw new Error('Freshness guard: duplicate hooks in one kit.');
if (posts.filter(p => p.purpose === 'paid-offer-promotion').length !== 1) throw new Error('12-month plan guard: exactly one direct paid-product promotion per weekly kit.');
if (posts.filter(p => p.destination_name === notion.name).length !== 6) throw new Error('12-month plan guard: six weekly items must support the free Notion/list-growth route.');

const corePack = {
  version: 4,
  brand: facts.brand,
  week,
  generated_at: new Date().toISOString(),
  plan: {
    name: 'Sapiver Forge 12-Month Execution Plan',
    start_date: '2026-08-16',
    plan_month: planMonth,
    phase,
    core_loop: [
      'Publish useful organic content about practical AI decisions for small businesses.',
      'Send people primarily to the free Sapiver Forge Notion workspace.',
      'Measure genuine Kit subscribers, clicks, questions and sales.',
      'Promote one active paid product.',
      'Review evidence and improve the clearest bottleneck.'
    ],
    guardrails
  },
  generation: {
    research_used: false,
    news_used: false,
    ai_api_used: false,
    paid_media_calls: 0,
    automated_audio: false,
    automated_video: false,
    rotation: { run_number: runNumber, run_attempt: runAttempt, rotation }
  },
  posts
};

const candidate_id = crypto.createHash('sha256').update(JSON.stringify(corePack)).digest('hex');
const pack = { ...corePack, candidate_id };
fs.writeFileSync(path.join(out, 'weekly-pack.json'), `${JSON.stringify(pack, null, 2)}\n`);
fs.writeFileSync(path.join(out, 'candidate-id.txt'), `${candidate_id}\n`);

const markdown = [
  `# Sapiver Forge Weekly Content Kit — ${week}`,
  '',
  `**Plan month:** ${planMonth}/12 — ${phase}`,
  `**Candidate ID:** \`${candidate_id}\``,
  '',
  '**Commercial rules:** free Notion workspace is the primary CTA; one direct bundle promotion; no paid ads; no new product expansion; no generated audio or video.',
  '',
  ...posts.flatMap(p => [
    `## ${p.day} — ${p.hook}`,
    '',
    `**Purpose:** ${p.purpose}`,
    '',
    '**Short script**',
    p.spoken_script,
    '',
    '**TikTok caption**',
    p.tiktok_caption,
    '',
    '**YouTube Shorts**',
    `Title: ${p.youtube_title}`,
    '',
    p.youtube_description,
    '',
    '**Facebook**',
    p.facebook_post,
    '',
    `**Destination:** ${p.destination_name} — ${p.destination_url}`,
    '',
    '---',
    ''
  ])
].join('\n');
fs.writeFileSync(path.join(out, 'weekly-content-kit.md'), `${markdown}\n`);

const esc = v => String(v).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const cards = posts.map(p => `<article><h2>${p.day}: ${esc(p.hook)}</h2><p><strong>Purpose:</strong> ${esc(p.purpose)}</p><h3>Short script</h3><p>${esc(p.spoken_script)}</p><h3>TikTok caption</h3><pre>${esc(p.tiktok_caption)}</pre><h3>YouTube Shorts</h3><p><strong>${esc(p.youtube_title)}</strong></p><pre>${esc(p.youtube_description)}</pre><h3>Facebook</h3><pre>${esc(p.facebook_post)}</pre><p><strong>CTA destination:</strong> ${esc(p.destination_name)}</p><p><em>${esc(p.manual_video_note)}</em></p></article>`).join('');
fs.writeFileSync(path.join(out, 'human-review.html'), `<!doctype html><meta charset="utf-8"><title>Sapiver Forge weekly content review</title><style>body{font:16px/1.5 system-ui;max-width:1000px;margin:auto;padding:24px;background:#f5f2ea;color:#102437}header,article{background:white;border:1px solid #d8e0e6;border-radius:12px;padding:18px;margin:14px 0}header{background:#071827;color:white}pre{white-space:pre-wrap}</style><header><h1>Sapiver Forge weekly content kit</h1><p>Week ${esc(week)} · Plan month ${planMonth}/12 · ${esc(phase)}</p><p>Candidate ID: <code>${candidate_id}</code></p><p><strong>Primary objective:</strong> useful organic content → free Notion workspace → genuine Kit subscriber evidence → one active paid product.</p><p><strong>No video or audio generation. No paid media calls.</strong></p><p><strong>HUMAN REVIEW REQUIRED BEFORE USE.</strong></p></header>${cards}`);

fs.writeFileSync(path.join(out, 'README.txt'), `Sapiver Forge weekly content kit\nWeek: ${week}\nCandidate ID: ${candidate_id}\nPlan month: ${planMonth}/12 — ${phase}\nOutputs: weekly-content-kit.md, human-review.html, weekly-pack.json\nNo audio or video is generated. No AI API or paid media call is used.\nReview the kit manually before publishing.\n`);

console.log(JSON.stringify({ week, candidate_id, out, posts: 7, plan_month: planMonth, phase, paid_media_calls: 0 }));
