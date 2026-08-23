import assert from "node:assert/strict";
import { __test } from "../src/news-intelligence-sources.mjs";

const { canonicalUrl, parseRssItems, extractAnchors, titleKey, dedupeCandidates } = __test;

assert.equal(
  canonicalUrl("https://example.com/story?utm_source=x&ref=front#part", "https://example.com"),
  "https://example.com/story"
);

const rss = `<?xml version="1.0"?><rss><channel><item><title><![CDATA[AI &amp; Business move]]></title><link>https://example.com/a?utm_source=test</link><description><![CDATA[<p>Useful summary.</p>]]></description><pubDate>Fri, 21 Aug 2026 08:00:00 GMT</pubDate></item></channel></rss>`;
const parsed = parseRssItems(rss, "https://example.com");
assert.equal(parsed.length, 1);
assert.equal(parsed[0].title, "AI & Business move");
assert.equal(parsed[0].url, "https://example.com/a");
assert.equal(parsed[0].summary, "Useful summary.");

const html = `<a href="/technology/a-story-2026-08-21/">A sufficiently descriptive technology headline</a><a href="/">Home</a>`;
const anchors = extractAnchors(html, "https://www.reuters.com/technology/", (url) => new URL(url).pathname.startsWith("/technology/"));
assert.equal(anchors.length, 1);
assert.equal(anchors[0].url, "https://www.reuters.com/technology/a-story-2026-08-21/");

assert.equal(titleKey("The AI and Business Story"), "ai business story");
const deduped = dedupeCandidates([
  { source: "Reuters", source_rank: 1, source_home: "https://reuters.com", title: "Major AI business move", url: "https://reuters.com/a?utm_source=x", summary: "" },
  { source: "Techmeme", source_rank: 1, source_home: "https://techmeme.com", title: "Major AI business move", url: "https://example.com/duplicate", summary: "" },
  { source: "Sifted", source_rank: 1, source_home: "https://sifted.eu", title: "European startup funding changes", url: "https://sifted.eu/articles/funding", summary: "" }
]);
assert.equal(deduped.length, 2);
assert.equal(deduped[0].source, "Reuters");
assert.equal(deduped[1].source, "Sifted");

console.log("News intelligence source contract passed.");
