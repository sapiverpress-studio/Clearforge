import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const facts=JSON.parse(fs.readFileSync('data/sapiver-forge-products.json','utf8'));
const week=process.env.WEEK_ID||new Date().toISOString().slice(0,10);
const runNumber=Number.parseInt(process.env.GITHUB_RUN_NUMBER||process.env.PROMO_RUN_NUMBER||'1',10)||1;
const runAttempt=Number.parseInt(process.env.GITHUB_RUN_ATTEMPT||process.env.PROMO_RUN_ATTEMPT||'1',10)||1;
const rotation=runNumber*5+runAttempt;
const out=path.join('weekly-output',week);
fs.mkdirSync(path.join(out,'audio'),{recursive:true});
fs.mkdirSync(path.join(out,'video'),{recursive:true});
const by=Object.fromEntries(facts.products.map(p=>[p.slug,p]));

const hooks=[
  'AI was meant to save you time, not give you another job to manage.',
  'If you are fitting AI work around family life, wasted automation time matters.',
  'Saving five minutes with AI means nothing if you spend twenty minutes checking it.',
  'The best AI workflow is not the cleverest one; it is the one that gives you time back.',
  'Parents using AI at work do not have spare evenings for avoidable rework.',
  'If an AI workflow follows you into the evening, something in the process needs fixing.',
  'You should not need to keep the whole AI workflow in your head just to trust it.',
  'A fast AI output can still create slow, expensive work afterwards.',
  'Good AI should remove friction from your day, not move it somewhere else.',
  'When work time is limited, every unnecessary AI check has a real cost.',
  'AI is useful when it shortens the job and the uncertainty around it.',
  'If the automation needs constant supervision, count that as part of the work.'
];
const contexts=[
  'When your working window is short, that difference matters.',
  'That matters even more when the rest of the evening belongs to your family.',
  'The hidden cost is the attention you have to keep giving it.',
  'A workflow should reduce the number of decisions you have to carry around in your head.',
  'The point of automation is to remove work, not relocate it.',
  'Small bits of rechecking add up quickly across a week.',
  'Time saved at generation can disappear in supervision and correction.',
  'A reliable process should let you finish the job and mentally leave it behind.',
  'The useful measure is what the whole process costs you in practice.',
  'A good system should still work when you are busy, interrupted or tired.',
  'The check needs to happen once at the right point, not repeatedly afterwards.',
  'That is where a clear human decision becomes useful rather than bureaucratic.',
  'The goal is confidence to move on, not another layer of admin.'
];
const closes=[
  'AI should preserve time, not quietly take it back.',
  'Make the decision when it matters, then move on.',
  'The point is less rechecking, not more process.',
  'Good control should reduce mental load as well as risk.',
  'Use AI where it earns its place in your working day.',
  'A clear decision now is cheaper than uncertainty later.',
  'The system should help you finish the task, not keep thinking about it.',
  'Protect the time the automation was supposed to save.'
];

const profiles={
  opportunity:{
    seconds:['Automating the wrong task can cost more time than doing it manually.','Replacing a working process with AI is not automatically an improvement.','The first human decision should happen before the workflow exists.','A few saved clicks do not justify a workflow that adds monitoring and maintenance.'],
    examples:['A weekly report that already takes twenty minutes in a spreadsheet may not need an agent.','A recurring email handled well with a template may not justify a new automation.','A five-minute admin task can become a thirty-minute AI project very quickly.','If you only have an hour after bedtime, configuring AI for a trivial task is a poor trade.'],
    method:'Compare the current method, the best non-AI alternative and the realistic AI benefit before you build.'
  },
  'workflow-control':{
    seconds:['If the first human check happens after something is sent or changed, the control is too late.','Without clear boundaries, you end up watching the whole workflow because you do not trust any of it.','A vague instruction to check it later is easy to skip when work gets busy.','One approval at the end cannot fix every workflow risk.'],
    examples:['AI can draft a client email while the final send still waits for a named person.','AI can prepare an invoice summary while a human approves anything issued to a customer.','A content workflow can gather material automatically while publication still requires review.','If AI prepares a mailing list, the check belongs before the send button.'],
    method:'Define the allowed actions, the evidence shown, the approval point and the person who owns the decision.'
  },
  'output-release':{
    seconds:['Looks finished and ready to release are two different states.','Repeated rereading usually means the release decision is not defined.','Fluent wording can hide weak facts, private information or missing permissions.','The final step should be a decision, not an assumption.'],
    examples:['A client proposal can read perfectly while still containing the wrong figure or confidential detail.','An AI-assisted email still needs the facts, recipient and approval checked once before sending.','A polished social post can still include material you do not have the right to use.','Instead of reopening the same document after the kids are in bed, review it once against fixed criteria.'],
    method:'Use one release point for material facts, privacy, ownership, destination and named human approval.'
  },
  'outcome-review':{
    seconds:['Working is not the same as worthwhile.','The original promise does not matter if the real workflow now needs constant checking and correction.','Maintenance time is part of the cost even when it never appears on an invoice.','A workflow that made sense six months ago may be a poor fit today.'],
    examples:['Something built to save an hour a week can quietly start consuming that hour in maintenance.','A daily summary can arrive on time and still be useless if nobody reads it.','Ten minutes of daily cleanup becomes more than three hours across a working month.','A changed subscription, task or client process can completely alter the original calculation.'],
    method:'Review time saved, correction work, costs, failures and ongoing effort, then continue, change, pause or retire.'
  },
  notion:{
    seconds:['When evidence lives in scattered notes, the next review starts from scratch.','A verbal yes disappears as soon as the next task arrives.','Losing ten minutes rebuilding yesterday’s context is exactly the friction AI was meant to reduce.','A short structured record can prevent a much longer investigation later.'],
    examples:['Keep the assessment, owner, evidence, conditions and follow-up actions together.','Record the responsible person and decision alongside the evidence instead of relying on memory.','Keep gate decisions connected so the next session starts with context rather than a reread.','Capture the decision and conditions while they are fresh, then reuse that context later.'],
    method:'Use one connected workspace as the record of the assessment and human decision.'
  },
  bundle:{
    seconds:['By the final output, earlier decisions about suitability and control have already been made.','The problem is often not missing policy; it is vague decision points.','Miss one stage and you can automate the wrong task, lose control, release weak work or keep a bad workflow alive.','Fast output means little if the surrounding process creates rechecking and uncertainty.'],
    examples:['The four decisions are whether AI belongs in the task, how the workflow is controlled, whether output can leave and whether the workflow should continue.','Before, during, before release and after operation, someone needs to know what they are deciding.','A few deliberate stops can prevent a lot of repeated checking later.','You do not need to watch every AI step if the human decision points are built into the lifecycle.'],
    method:'Keep those four decisions with named humans at the points where they matter.'
  }
};

const days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const core=['opportunity','workflow-control','output-release','outcome-review'];
const offset=rotation%core.length;
const ordered=core.map((_,i)=>core[(i+offset)%core.length]);
const plan=[...ordered,core[(offset+1)%core.length],'notion','bundle'];
const angles=['time-pressure','practical-example','common-mistake','decision-point','work-life-friction','record-and-resume','whole-system'];
const tags={
 opportunity:['#SapiverForge','#AIStrategy','#SmallBusinessAI','#ResponsibleAI'],
 'workflow-control':['#SapiverForge','#AIWorkflow','#HumanInTheLoop','#ResponsibleAI'],
 'output-release':['#SapiverForge','#AIQuality','#HumanInTheLoop','#ResponsibleAI'],
 'outcome-review':['#SapiverForge','#AIReview','#SmallBusinessAI','#ResponsibleAI'],
 notion:['#SapiverForge','#AIWorkflow','#Productivity','#HumanInTheLoop'],
 bundle:['#SapiverForge','#HumanInTheLoop','#AIGovernance','#ResponsibleAI']
};

const seen=new Map();
const posts=plan.map((slug,index)=>{
  const product=by[slug]; if(!product?.image) throw new Error(`Missing approved product artwork mapping for ${slug}.`);
  const p=profiles[slug]; const occurrence=seen.get(slug)||0; seen.set(slug,occurrence+1);
  const hookIndex=(rotation+index*3+occurrence)%hooks.length;
  const secondIndex=(rotation+index+occurrence)%p.seconds.length;
  const exampleIndex=(rotation*2+index*3+occurrence)%p.examples.length;
  const contextIndex=(rotation*3+index*5+occurrence)%contexts.length;
  const closeIndex=(rotation+index*2+occurrence)%closes.length;
  const hook=hooks[hookIndex], second=p.seconds[secondIndex], example=p.examples[exampleIndex], context=contexts[contextIndex], close=closes[closeIndex];
  const bridge=slug==='notion'?`That is what the ${product.name} is there to support.`:`That is the role of the ${product.name}.`;
  const spokenCta=index===6?'You can find the complete system through the link in bio.':'';
  const narration=[hook,second,context,example,p.method,bridge,close,spokenCta].filter(Boolean).join(' ');
  const body=[second,context,example,p.method,bridge,close].join(' ');
  const hashtags=tags[slug], hashtagText=hashtags.join(' ');
  return {index:index+1,day:days[index],angle:angles[(rotation+index)%angles.length],product_slug:slug,product:product.name,product_url:product.url,product_image:product.image,isla_opener:facts.weekly_video.isla_opener,hook,second_hook:second,narration,hashtags,link_in_bio_text:'Link in bio.',tiktok_caption:`${hook}\n\n${body}\n\nLink in bio.\n\n${hashtagText}`,youtube_title:`${hook.replace(/[.?]$/,'')} | Sapiver Forge #Shorts`,youtube_description:`${body}\n\nLink in bio.\n\n${hashtagText} #Shorts`,facebook_post:`${hook}\n\n${body}\n\nLink in bio.\n\n${hashtagText}`,social_comment:`Link in bio. ${hashtagText}`,visual_cards:[hook,second,'A named human decides',product.name],content_variant:{hook:hookIndex,second:secondIndex,example:exampleIndex,context:contextIndex,close:closeIndex}};
});
if(new Set(posts.map(p=>p.hook)).size!==7) throw new Error('Freshness guard: duplicate hooks in one pack.');
if(new Set(posts.map(p=>p.narration)).size!==7) throw new Error('Freshness guard: duplicate narrations in one pack.');

const corePack={version:3,brand:facts.brand,week,generated_at:new Date().toISOString(),research_used:false,news_used:false,content_rotation:{strategy:'workflow-run rotation',run_number:runNumber,run_attempt:runAttempt,rotation},visual_system:{isla_source_repository:facts.weekly_video.isla_source_repository,isla_opener:facts.weekly_video.isla_opener,approved_product_artwork:true,link_in_bio_cta:true},posts};
const candidate_id=crypto.createHash('sha256').update(JSON.stringify(corePack)).digest('hex');
const pack={...corePack,candidate_id};
fs.writeFileSync(path.join(out,'weekly-pack.json'),`${JSON.stringify(pack,null,2)}\n`);
fs.writeFileSync(path.join(out,'candidate-id.txt'),`${candidate_id}\n`);
fs.writeFileSync(path.join(out,'README.txt'),`Sapiver Forge weekly promotional pack\nWeek: ${week}\nCandidate ID: ${candidate_id}\nFreshness: products, hooks, second hooks, contexts and examples rotate from the GitHub workflow run number and attempt. All four core gates appear every week.\nNothing is approved until the approval workflow is run with this exact ID.\n`);
const esc=v=>String(v).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const cards=posts.map(p=>`<article><h2>${p.day}: ${esc(p.hook)}</h2><p><strong>Second hook:</strong> ${esc(p.second_hook)}</p><p><strong>Product:</strong> ${esc(p.product)}</p><p><strong>Variant:</strong> ${esc(JSON.stringify(p.content_variant))}</p><video controls preload="metadata" width="360" src="video/${String(p.index).padStart(2,'0')}-${p.day.toLowerCase()}.mp4"></video><h3>Narration</h3><p>${esc(p.narration)}</p><h3>TikTok caption</h3><pre>${esc(p.tiktok_caption)}</pre><h3>Facebook post</h3><pre>${esc(p.facebook_post)}</pre><h3>Social comment</h3><pre>${esc(p.social_comment)}</pre><h3>YouTube</h3><p><strong>${esc(p.youtube_title)}</strong></p><pre>${esc(p.youtube_description)}</pre></article>`).join('');
fs.writeFileSync(path.join(out,'human-review.html'),`<!doctype html><meta charset="utf-8"><title>Sapiver Forge weekly review</title><style>body{font:16px/1.5 system-ui;max-width:1000px;margin:auto;padding:24px;background:#f5f2ea;color:#102437}header,article{background:white;border:1px solid #d8e0e6;border-radius:12px;padding:18px;margin:14px 0}header{background:#071827;color:white}pre{white-space:pre-wrap}video{max-width:100%;background:#071827;border-radius:10px}</style><header><h1>Sapiver Forge weekly promotional pack</h1><p>Week ${week}</p><p>Candidate ID: <code>${candidate_id}</code></p><p><strong>Freshness:</strong> workflow run ${runNumber}, attempt ${runAttempt}, rotation ${rotation}. This pack is assembled from rotating product, hook, second-hook, context and example banks rather than a fixed seven-post script.</p><p><strong>AWAITING HUMAN APPROVAL — nothing has been published.</strong></p></header>${cards}`);
console.log(JSON.stringify({week,candidate_id,out,posts:7,rotation}));
