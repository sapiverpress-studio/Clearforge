import assert from "node:assert/strict";
import { containsVisibleLegacyBrand } from "../src/legacy-brand-guard.mjs";

const allowed = `<section data-clearforge-latest-short></section>
<guid isPermaLink="false">clearforge:2026-07-31</guid>
<managingEditor>clearforge@sapiverpress.co.uk (Sapiver Forge)</managingEditor>
<form name="clearforge-weekly-digest"></form>
<script>fetch("social/clearforge/latest.json")</script>
<a href="https://music.amazon.co.uk/podcasts/8d3316de-09fa-4934-8bfe-28b4a5b576a7/clearforge-ai-briefing">Amazon Music</a>
<a href="clearforge-weekly-ai-learning-brief-2026-07-20.pdf">Download PDF</a>`;

assert.equal(containsVisibleLegacyBrand(allowed), false);
assert.equal(containsVisibleLegacyBrand("Clearforge AI Briefing"), true);
assert.equal(containsVisibleLegacyBrand("Clear Forge products"), true);
assert.equal(containsVisibleLegacyBrand("https://clearforge-daily-brief.netlify.app/posts/example"), true);
assert.equal(containsVisibleLegacyBrand("Sapiver Forge AI Briefing"), false);
console.log("Legacy brand guard regression checks passed.");
