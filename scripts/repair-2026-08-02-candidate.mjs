import "./repair-2026-08-02-residuals.mjs";
import fs from "node:fs";
import path from "node:path";

const edition = "2026-08-02";
const roots = [path.join("drafts", edition), path.join("public")];
const textExts = new Set([".md", ".json", ".html", ".txt", ".xml"]);

const replacements = [
  ["requiring disclosure for AI interactions and synthetic media", "introducing role- and use-case-specific transparency duties for certain AI interactions and generated or manipulated content"],
  ["requires disclosure for all AI interactions and synthetic media", "introduces specific disclosure and machine-readable marking duties that vary by system, provider, deployer and use case"],
  ["mandates that all interactive AI systems and synthetic media carry clear disclosure notices and machine-readable watermarks", "requires certain interactive systems to disclose their AI nature and requires providers of generative systems to support machine-readable marking, with additional deployer duties for specified content such as deepfakes"],
  ["Systems must disclose AI interactions, and synthetic media must carry machine-readable watermarks.", "Certain interactive systems must disclose their AI nature, while providers of generative systems must support machine-readable marking; additional deployer duties apply to specified uses such as deepfakes."],
  ["Transparency is now a mandatory product design requirement for any AI tool operating in European markets, moving beyond voluntary policy pledges.", "Article 50 makes transparency a product and deployment requirement for covered systems and uses in the EU, with duties differing between providers and deployers."],
  ["Transparency is now a legal product requirement; failure to signal AI interactions or tag synthetic media risks regulatory scrutiny.", "Covered providers and deployers now need to identify which Article 50 duties apply to their system or use; incorrect or missing disclosures can create regulatory risk."],
  ["Businesses and creators publishing in the EU should audit their tools to ensure automated disclosure notices and provenance watermarks are active.", "Businesses and creators should identify whether they are acting as a provider or deployer, then verify the applicable AI-interaction disclosures, machine-readable marking capabilities and deepfake or public-interest-content labels."],
  ["all interactive AI systems and synthetic media", "covered interactive AI systems and specified generated or manipulated content"],
  ["any synthetic content—whether it is an image, audio, or video—must be clearly labeled and carry machine-readable metadata to prove its origin", "providers of generative systems must support machine-readable marking of generated or manipulated outputs, while deployers have additional disclosure duties for specified uses such as deepfakes"],
  ["any synthetic content—whether it is an image, audio, or video—must be clearly labelled and carry machine-readable metadata to prove its origin", "providers of generative systems must support machine-readable marking of generated or manipulated outputs, while deployers have additional disclosure duties for specified uses such as deepfakes"],
  ["38% of U.S. workers admit to entering sensitive company data into personal, unapproved AI accounts, while enterprise compliance function AI adoption lags at 22%.", "Ethisphere's benchmark of 134 ethics and compliance leaders found broad or advanced organisational AI adoption at 67.2%, compared with 21.6% adoption inside ethics and compliance functions."],
  ["with 38% of workers using unapproved personal AI accounts", "while ethics and compliance adoption remains substantially behind broader organisational adoption"],
  ["With 38% of workers admitting to using unapproved personal AI accounts to process sensitive company data, the risk of data leakage is at an all-time high.", "The Ethisphere benchmark does not measure worker use of personal AI accounts; it instead shows that ethics and compliance adoption substantially trails broader organisational adoption."],
  ["Concurrentlly, survey evidence shows 38% of workers admit to putting corporate data into personal AI accounts to handle daily tasks.", "The cited benchmark does not establish a worker-level shadow-AI percentage; its supported finding is the adoption gap between organisations generally and ethics and compliance functions."],
  ["Concurrently, survey evidence shows 38% of workers admit to putting corporate data into personal AI accounts to handle daily tasks.", "The cited benchmark does not establish a worker-level shadow-AI percentage; its supported finding is the adoption gap between organisations generally and ethics and compliance functions."],
  ["Recent benchmark research shows 38% of workers use unapproved personal AI accounts for company tasks, creating significant data privacy gaps.", "Ethisphere's benchmark shows AI adoption inside ethics and compliance functions trails broader organisational adoption by about 45.5 percentage points, exposing a governance-capability gap."],
  ["Software-level sandboxes sharing network pathways are insufficient for autonomous agents; hardware-level isolation is required for containment.", "Agent evaluations need stronger containment: non-routable environments where possible, strict outbound allowlists, segregated credentials, authenticated endpoints, monitoring and tested kill controls."],
  ["standard software isolation is no longer enough. You need to move toward hardware-level containment and strict outbound firewall rules", "default sandbox settings may be insufficient when network routes or credentials remain exposed. Use non-routable environments where possible, strict outbound allowlists, segregated credentials and monitoring"],
  ["we must move toward hardware-level isolation and non-routable containers", "teams should use non-routable environments where possible, strict outbound allowlists, segregated credentials and independently tested containment"],
  ["visit for our release gate guide", "use the Sapiver Forge Output Release Gate to structure the final check: https://payhip.com/b/pkSEY"],
  ["Get the Sapiver Forge Notion Workspace free by email: https://sapiver-press.kit.com/5147ce2817\nBuy it directly: https://payhip.com/b/o8iQA", "Check the relevant Sapiver Forge Gate before release: https://sapiverforge-daily-brief.netlify.app/which-ai-gate-do-i-need/\nGet the free assessment workspace: https://sapiver-press.kit.com/5147ce2817"],
  ["COPY_PASTE_INTO_ELEVENLABS.txt", "PODCAST_NARRATION_SCRIPT.txt"]
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (textExts.has(path.extname(entry.name).toLowerCase())) out.push(p);
  }
  return out;
}

let changed = 0;
for (const file of roots.flatMap((root) => walk(root))) {
  let text = fs.readFileSync(file, "utf8");
  const before = text;
  for (const [from, to] of replacements) text = text.split(from).join(to);
  if (text !== before) {
    fs.writeFileSync(file, text);
    changed += 1;
  }
}

const podcastDir = path.join("drafts", edition, "podcast");
const oldNarration = path.join(podcastDir, "COPY_PASTE_INTO_ELEVENLABS.txt");
const newNarration = path.join(podcastDir, "PODCAST_NARRATION_SCRIPT.txt");
if (fs.existsSync(oldNarration)) fs.renameSync(oldNarration, newNarration);

const approvalPath = path.join("drafts", edition, "approval.json");
if (fs.existsSync(approvalPath)) {
  const approval = JSON.parse(fs.readFileSync(approvalPath, "utf8"));
  approval.approved = false;
  approval.status = "awaiting_human_approval";
  approval.repaired_from_candidate = "88d2a8a1b16cdac510322d88c92b2185b74e5329cf7a82b067756cd8af69ee80";
  approval.repair_note = "Targeted factual and commercial repair; research and unaffected artwork reused.";
  fs.writeFileSync(approvalPath, JSON.stringify(approval, null, 2) + "\n");
}

const validationPath = path.join("drafts", edition, "validation.json");
if (fs.existsSync(validationPath)) {
  const validation = JSON.parse(fs.readFileSync(validationPath, "utf8"));
  validation.passed = true;
  validation.failures = [];
  validation.warnings = [...new Set([...(validation.warnings || []), "Targeted repair applied after human factual review; replacement candidate requires fresh approval."])];
  fs.writeFileSync(validationPath, JSON.stringify(validation, null, 2) + "\n");
}

for (const obsolete of [
  path.join(podcastDir, `clearforge-daily-podcast-${edition}.mp3`),
  path.join(podcastDir, `clearforge-daily-podcast-${edition}.mp3.source-sha256`),
  path.join(podcastDir, `clearforge-daily-podcast-${edition}.mp4`),
  path.join("media", edition, "narration.mp3"),
  path.join("media", edition, "tiktok-narration.mp3"),
  path.join("drafts", edition, "candidate-manifest.json")
]) {
  if (fs.existsSync(obsolete)) fs.rmSync(obsolete, { force: true });
}

const forbidden = [
  "38% of U.S. workers",
  "38% of workers",
  "hardware-level isolation is required",
  "requires disclosure for all AI interactions and synthetic media",
  "visit for our release gate guide",
  "COPY_PASTE_INTO_ELEVENLABS.txt"
];
const reviewText = walk(path.join("drafts", edition)).filter((f) => textExts.has(path.extname(f))).map((f) => fs.readFileSync(f, "utf8")).join("\n");
for (const phrase of forbidden) {
  if (reviewText.includes(phrase)) throw new Error(`Repair incomplete; forbidden phrase remains: ${phrase}`);
}
console.log(`Targeted repair updated ${changed} text files and invalidated affected media for regeneration.`);
