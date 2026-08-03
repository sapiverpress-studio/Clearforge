import assert from "node:assert/strict";
import { acquireExaSources } from "../src/exa-source-acquisition.mjs";

const longText = (label) => `${label} ${"Detailed source evidence describing the announced AI development and its practical context. ".repeat(8)}`;
let searchCalls = 0;
const fetchImpl = async (url, options = {}) => {
  if (url === "https://api.exa.ai/search") {
    searchCalls += 1;
    return {
      ok: true, status: 200,
      json: async () => ({ costDollars: { total: 0.007 }, results: [
        { title: "Broken discovery result", url: "https://example.com/missing", publishedDate: "2026-08-03", text: longText("Broken") },
        { title: "Primary announcement", url: "https://primary.example/news/announcement", publishedDate: "2026-08-03", text: longText("Primary"), highlights: ["The company announced an AI feature for a defined customer workflow."] },
        { title: "Publisher-blocked report", url: "https://blocked.example/report", publishedDate: "2026-08-02", text: longText("Blocked"), highlights: ["The report describes the study and its published methodology."] },
        { title: "Thin result", url: "https://thin.example/post", publishedDate: "2026-08-03", text: "Too short." }
      ] })
    };
  }
  const status = String(url).includes("missing") ? 404 : String(url).includes("blocked") ? 429 : 200;
  return { ok: status === 200, status, url: String(url), headers: new Map(), text: async () => "" };
};

const result = await acquireExaSources({
  apiKey: "test-key", date: "2026-08-03", theme: { title: "Practical AI", focus: "controlled workflows" }, fetchImpl
});

assert.equal(searchCalls, 3, "The bounded discovery stage should make exactly three Exa searches.");
assert.equal(result.provider, "exa");
assert.equal(result.provider_cost_usd, 0.021);
assert.ok(result.candidates.some((item) => item.final_url === "https://primary.example/news/announcement"));
assert.ok(result.candidates.some((item) => item.retrieval_status === "retrieved_by_exa_after_publisher_block"));
assert.ok(!result.candidates.some((item) => item.final_url.includes("missing")), "A 404 discovery URL must never enter the source dossier.");
assert.ok(!result.candidates.some((item) => item.final_url.includes("thin")), "A result without usable body evidence must be excluded.");
assert.ok(result.candidates.every((item) => item.acquisition_id && item.usable_source_text.length >= 240));
console.log("Exa source acquisition contract passed: bad URLs are rejected before content generation.");
