import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const DATE = "2099-08-04";
const draftDir = path.join(ROOT, "drafts", DATE);
const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "sapiver-live-evidence-"));

const candidates = [
  {
    acquisition_id: "exa-bbd411ddd734",
    page_title: "Indeed’s 2026 Mid-Year UK Jobs & Hiring Trends Report: A Labour Market Under Pressure – And in Transition - Indeed Hiring Lab UK I Ireland",
    final_url: "https://www.hiringlab.org/uk/blog/2026/08/03/indeed-2026-mid-year-uk-jobs-hiring-trends-report/",
    requested_url: "https://www.hiringlab.org/uk/blog/2026/08/03/indeed-2026-mid-year-uk-jobs-hiring-trends-report/",
    publication_date: "2026-08-03T00:00:00.000Z",
    publisher_domain: "hiringlab.org",
    retrieval_status: "preflight_passed_with_exa_text",
    direct_http_status: 200,
    usable_source_text: "Indeed’s 2026 Mid-Year UK Jobs & Hiring Trends Report. UK job postings are down 11% since the start of 2026 and now stand 32% below their pre-pandemic baseline. Hiring conditions remain under pressure while the labour market continues to change.",
    evidence_passages: ["UK job postings are down 11% since the start of 2026 and now stand 32% below their pre-pandemic baseline."]
  },
  {
    acquisition_id: "exa-b7821e4e183d",
    page_title: "Orchard: An open framework for scalable agentic AI - Microsoft Research",
    final_url: "https://www.microsoft.com/en-us/research/blog/orchard-an-open-framework-for-scalable-agentic-ai/",
    requested_url: "https://www.microsoft.com/en-us/research/blog/orchard-an-open-framework-for-scalable-agentic-ai/",
    publication_date: "2026-08-03T00:00:00.000Z",
    publisher_domain: "microsoft.com",
    retrieval_status: "preflight_passed_with_exa_text",
    direct_http_status: 200,
    usable_source_text: "Microsoft Research introduced Orchard. Orchard is an open-source framework for scalable and cost-effective agentic AI research, built around Orchard Env, a reusable environment service for training and evaluating agents across task domains.",
    evidence_passages: ["Orchard is an open-source framework for scalable and cost-effective agentic AI research, built around Orchard Env, a reusable environment service for training and evaluating agents across task domains."]
  },
  {
    acquisition_id: "exa-e63b2a2b791d",
    page_title: "When people think AI did the creative work, task meaning and effort decline | Brookings",
    final_url: "https://www.brookings.edu/articles/when-people-think-ai-did-the-creative-work-task-meaning-and-effort-decline/",
    requested_url: "https://www.brookings.edu/articles/when-people-think-ai-did-the-creative-work-task-meaning-and-effort-decline/",
    publication_date: "2026-08-03T00:00:00.000Z",
    publisher_domain: "brookings.edu",
    retrieval_status: "preflight_passed_with_exa_text",
    direct_http_status: 200,
    usable_source_text: "Brookings reported research on perceptions of AI-assisted creative work. When participants believed AI had done more of the creative work, they experienced lower task meaning and contributed less effort even when the resulting output was held constant.",
    evidence_passages: ["When participants believed AI had done more of the creative work, they experienced lower task meaning and contributed less effort even when the resulting output was held constant."]
  },
  {
    acquisition_id: "exa-104ed21d4ab4",
    page_title: "OpenOctopus: Realm-Native AI Life Assistant System With Summon Technology - DEV Community",
    final_url: "https://dev.to/kevinten10/openoctopus-realm-native-ai-life-assistant-system-with-summon-technology-2jnj",
    requested_url: "https://dev.to/kevinten10/openoctopus-realm-native-ai-life-assistant-system-with-summon-technology-2jnj",
    publication_date: "2026-07-29T00:00:00.000Z",
    publisher_domain: "dev.to",
    retrieval_status: "preflight_passed_with_exa_text",
    direct_http_status: 200,
    usable_source_text: "OpenOctopus is an open source project hosted on GitHub. The author describes a realm-native personal assistant concept.",
    evidence_passages: ["OpenOctopus is an open source project hosted on GitHub."]
  },
  {
    acquisition_id: "exa-3f949c15d28d",
    page_title: "Samsung Bespoke AI Appliances Review: The Future of Smart Home Automation - Phadera Tech : Smartphone Reviews & Latest Gadget News",
    final_url: "https://www.phadera.com/samsung-bespoke-ai-review/",
    requested_url: "https://www.phadera.com/samsung-bespoke-ai-review/",
    publication_date: "2026-08-02T00:00:00.000Z",
    publisher_domain: "phadera.com",
    retrieval_status: "preflight_passed_with_exa_text",
    direct_http_status: 200,
    usable_source_text: "This review discusses Samsung Bespoke AI appliances and describes smart-home automation features. It does not independently establish customer outcomes.",
    evidence_passages: ["This review discusses Samsung Bespoke AI appliances and describes smart-home automation features."]
  }
];

const originalSources = [
  ["exa-104ed21d4ab4", "OpenOctopus is an open-source framework that organises AI agents into Realms and uses a Summon mechanism to turn data entities into proactive agents."],
  ["exa-3f949c15d28d", "Samsung Bespoke AI appliances use computer vision and IoT sensors to automate household tasks, with claimed energy savings of 10-20%."],
  ["exa-e63b2a2b791d", "Attributing creative work to AI reduces perceived task meaning and willingness to contribute effort, even when output quality is identical."]
].map(([acquisition_id, confirmed_fact]) => {
  const candidate = candidates.find((item) => item.acquisition_id === acquisition_id);
  return {
    acquisition_id,
    source_name: candidate.publisher_domain,
    title: candidate.page_title,
    url: candidate.final_url,
    published_date: candidate.publication_date.slice(0, 10),
    coverage_lane: "human_impact",
    topic_category: "workplace_and_business",
    evidence_basis: "Initial model-authored source selection from the failed live run pattern.",
    confirmed_fact,
    interpretation: "Initial interpretation."
  };
});

const structured = {
  headline: "Initial model-selected life assistant edition",
  dek: "Initial draft before deterministic evidence preparation.",
  sources: originalSources,
  story_summaries: originalSources.map((source) => ({
    title: source.title,
    coverage_lane: source.coverage_lane,
    topic_category: source.topic_category,
    summary: source.confirmed_fact,
    why_it_matters: "Initial model interpretation.",
    practical_angle: "Initial model recommendation.",
    claim_to_verify: "NONE — verified from cited sources."
  })),
  main_article: "Initial article.",
  practical_takeaway: "Initial takeaway.",
  what_to_test_next: "Initial next step.",
  claims_to_verify: [],
  social: {},
  headline_options: []
};

function run(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    env: { ...process.env, SAPIVER_FORGE_DATE: DATE, ...extraEnv },
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  }
  return result;
}

try {
  fs.rmSync(draftDir, { recursive: true, force: true });
  fs.mkdirSync(draftDir, { recursive: true });
  fs.writeFileSync(path.join(draftDir, "source-acquisition.json"), `${JSON.stringify({ candidates }, null, 2)}\n`);
  fs.writeFileSync(path.join(draftDir, "structured_output.json"), `${JSON.stringify(structured, null, 2)}\n`);

  run(process.execPath, ["src/prepare-evidence-bound-edition.mjs"]);
  const prepared = JSON.parse(fs.readFileSync(path.join(draftDir, "structured_output.json"), "utf8"));
  const selectedIds = prepared.sources.map((source) => source.acquisition_id);

  for (const required of ["exa-bbd411ddd734", "exa-b7821e4e183d", "exa-e63b2a2b791d"]) {
    if (!selectedIds.includes(required)) throw new Error(`Authoritative evidence-rich source was not retained: ${required}`);
  }
  for (const weak of ["exa-104ed21d4ab4", "exa-3f949c15d28d"]) {
    if (selectedIds.includes(weak)) throw new Error(`Weak source outranked authoritative evidence: ${weak}`);
  }
  if (!prepared.evidence_bound_preparation || prepared.evidence_bound_preparation.candidate_count !== 5) {
    throw new Error("Evidence-bound preparation metadata is incomplete.");
  }

  prepared.sources.forEach((source, index) => {
    const candidate = candidates.find((item) => item.acquisition_id === source.acquisition_id);
    fs.writeFileSync(path.join(fixtureDir, `source-${index + 1}.html`), `<html><head><title>${candidate.page_title}</title></head><body><article><p>${candidate.usable_source_text}</p></article></body></html>`);
    fs.writeFileSync(path.join(fixtureDir, `source-${index + 1}.json`), `${JSON.stringify({ status: 200, final_url: candidate.final_url, retrieval_status: "retrieved_fixture" })}\n`);
  });

  run(process.execPath, ["src/validate-source-integrity.mjs"], {
    SAPIVER_FORGE_ALLOW_SOURCE_FIXTURES: "1",
    SOURCE_FIXTURE_DIR: fixtureDir
  });
  const report = JSON.parse(fs.readFileSync(path.join(draftDir, "source-integrity-report.json"), "utf8"));
  if (!report.passed || report.survivor_count < 3) {
    throw new Error(`Prepared live-run sources did not survive verification: ${JSON.stringify(report.results)}`);
  }

  console.log("Live evidence-bound regression passed: authoritative sources replaced weak model choices and all selected factual cores survived source verification.");
} finally {
  fs.rmSync(draftDir, { recursive: true, force: true });
  fs.rmSync(fixtureDir, { recursive: true, force: true });
}
