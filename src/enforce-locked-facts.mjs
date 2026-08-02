import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATE = process.env.SAPIVER_FORGE_DATE || process.env.CLEARFORGE_DATE || new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());
const draftDir = path.join(ROOT, "drafts", DATE);
const structuredPath = path.join(draftDir, "structured_output.json");
const featurePath = path.join(draftDir, "feature.md");
const socialPackPath = path.join(draftDir, "social_pack.md");
const lockPath = path.join(draftDir, "locked-facts.json");
const reportPath = path.join(draftDir, "fact-discipline-report.json");

if (!fs.existsSync(structuredPath)) throw new Error(`Missing ${structuredPath}`);
const data = JSON.parse(fs.readFileSync(structuredPath, "utf8"));
const sources = Array.isArray(data.sources) ? data.sources : [];
if (!sources.length) throw new Error("Cannot create a fact lock without sources.");

const lockedFacts = sources.map((source, index) => ({
  story_index: index,
  source_name: String(source.source_name || ""),
  source_title: String(source.title || ""),
  source_url: String(source.url || ""),
  published_date: String(source.published_date || ""),
  supported_fact: String(source.confirmed_fact || "").trim(),
  labelled_interpretation: String(source.interpretation || "").trim(),
  rule: "Factual copy may paraphrase supported_fact without widening scope or certainty. labelled_interpretation must remain clearly presented as analysis, implication or Sapiver Forge interpretation."
}));

fs.writeFileSync(lockPath, `${JSON.stringify({
  schema_version: 1,
  edition: DATE,
  production_model: "research -> locked facts -> constrained paraphrase -> labelled interpretation -> platform formatting",
  prohibited_behaviour: [
    "Do not add a named standard, technology, legal requirement, exception, consequence, quantity or certainty absent from supported_fact.",
    "Do not turn some, certain, defined or applicable cases into all, every or universal claims.",
    "Do not describe machine-checkable or independently verifiable output as infallible, guaranteed, absolutely accurate or 100% correct.",
    "Do not present Sapiver Forge interpretation as a sourced fact."
  ],
  facts: lockedFacts
}, null, 2)}\n`, "utf8");

const supportedCorpus = lockedFacts.map((item) => item.supported_fact).join("\n").toLowerCase();
const changes = [];

function replaceAndRecord(value, pattern, replacement, reason, location) {
  const input = String(value || "");
  const output = input.replace(pattern, replacement);
  if (output !== input) changes.push({ location, reason, before_pattern: String(pattern), replacement });
  return output;
}

function discipline(value, location) {
  let text = String(value || "");
  text = replaceAndRecord(text, /\b100%\s+(?:correct|accurate|certain)\b/gi, "machine-checkable against the stated formal rules and assumptions", "Removed unsupported absolute certainty", location);
  text = replaceAndRecord(text, /\babsolute accuracy\b/gi, "stronger verification", "Removed unsupported absolute certainty", location);
  text = replaceAndRecord(text, /\bmathematically certain\b/gi, "formally checkable", "Removed unsupported absolute certainty", location);
  text = replaceAndRecord(text, /\bguarantee(?:d|s)?\s+(?:that\s+)?every logical step is sound\b/gi, "allows each formalised step to be checked against the proof system", "Recast guarantee as checkability", location);
  text = replaceAndRecord(text, /\beliminat(?:e|es|ed|ing)\s+(?:the\s+)?(?:primary\s+)?risk\b/gi, "reduces the risk", "Removed unsupported risk elimination", location);
  text = replaceAndRecord(text, /\bthe end of ['\u2018\u2019\"]?plausible-looking['\u2018\u2019\"]? errors\b/gi, "a stronger way to detect plausible-looking errors", "Removed unsupported finality", location);
  text = replaceAndRecord(text, /\bthe era of unverified AI output has (?:officially|effectively) (?:closed|ended)\b/gi, "pressure is increasing for AI output to be verifiable", "Removed unsupported historical finality", location);
  text = replaceAndRecord(text, /\bthe era of ['\u2018\u2019\"]?trust me['\u2018\u2019\"]? AI is over\b/gi, "the case for evidence-backed AI output is getting stronger", "Removed unsupported historical finality", location);
  text = replaceAndRecord(text, /\bmandatory for all AI interactions in the EU\b/gi, "required for defined AI systems and use cases in the EU, subject to the applicable scope and exceptions", "Preserved legal scope", location);
  text = replaceAndRecord(text, /\bfor all AI interactions in the EU\b/gi, "for defined AI systems and use cases in the EU", "Preserved legal scope", location);
  text = replaceAndRecord(text, /\bC2PA metadata (?:is|are) (?:now )?mandatory\b/gi, "machine-readable marking is required in applicable cases; C2PA may be one implementation route", "Removed unsupported named-standard mandate", location);
  text = replaceAndRecord(text, /\bmandatory C2PA metadata\b/gi, "required machine-readable marking in applicable cases", "Removed unsupported named-standard mandate", location);
  text = replaceAndRecord(text, /\bembed machine-readable metadata, such as C2PA watermarks, into their outputs\b/gi, "apply machine-readable marking in the cases covered by the rules; C2PA may be one implementation route", "Preserved legal and technical scope", location);
  text = replaceAndRecord(text, /\bC2PA metadata watermarking and disclosure banners into mandatory product design features\b/gi, "machine-readable marking and relevant disclosure controls into practical product-design requirements for covered systems", "Removed unsupported named-standard mandate", location);

  const absoluteRules = [
    [/(\b(?:all|every)\s+AI-generated content\b)/gi, "AI-generated content in the covered categories", "Narrowed universal scope"],
    [/(\bany entity deploying AI systems\b)/gi, "providers and deployers covered by the relevant obligation", "Narrowed legal scope"],
    [/(\bmust now carry clear, user-facing disclosures\b)/gi, "may need clear user-facing disclosures where the obligation applies", "Preserved applicability conditions"]
  ];
  for (const [pattern, replacement, reason] of absoluteRules) {
    if (!supportedCorpus.match(pattern)) text = replaceAndRecord(text, pattern, replacement, reason, location);
  }
  return text;
}

const factualFields = ["headline", "dek", "main_article", "practical_takeaway", "what_to_test_next"];
for (const field of factualFields) data[field] = discipline(data[field], `structured_output.${field}`);

if (Array.isArray(data.story_summaries)) {
  data.story_summaries = data.story_summaries.map((story, index) => ({
    ...story,
    title: discipline(story?.title, `story_summaries[${index}].title`),
    summary: discipline(story?.summary, `story_summaries[${index}].summary`),
    why_it_matters: discipline(story?.why_it_matters, `story_summaries[${index}].why_it_matters`),
    practical_angle: discipline(story?.practical_angle, `story_summaries[${index}].practical_angle`)
  }));
}

if (data.social && typeof data.social === "object") {
  for (const [field, value] of Object.entries(data.social)) {
    if (typeof value === "string") data.social[field] = discipline(value, `social.${field}`);
    if (Array.isArray(value)) data.social[field] = value.map((item, index) => typeof item === "string" ? discipline(item, `social.${field}[${index}]`) : item);
  }
}

fs.writeFileSync(structuredPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");

for (const [file, label] of [[featurePath, "feature.md"], [socialPackPath, "social_pack.md"]]) {
  if (fs.existsSync(file)) {
    const original = fs.readFileSync(file, "utf8");
    const revised = discipline(original, label);
    if (revised !== original) fs.writeFileSync(file, revised, "utf8");
  }
}

fs.writeFileSync(reportPath, `${JSON.stringify({
  schema_version: 1,
  edition: DATE,
  locked_fact_count: lockedFacts.length,
  change_count: changes.length,
  changes,
  status: changes.length ? "copy softened to preserve source scope and certainty" : "no factual escalation patterns found"
}, null, 2)}\n`, "utf8");

console.log(`Locked ${lockedFacts.length} source fact record(s); applied ${changes.length} fact-discipline correction(s).`);
