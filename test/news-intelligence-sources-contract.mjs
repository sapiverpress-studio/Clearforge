import assert from "node:assert/strict";
import { __test } from "../src/news-intelligence-sources.mjs";

const {
  canonicalUrl,
  parseRssItems,
  extractAnchors,
  extractExternalLinks,
  parseSitemapLocs,
  parseReutersNewsSitemap,
  publisherFromTitle,
  titleKey,
  dedupeCandidates
} = __test;

assert.equal(
  canonicalUrl("https://example.com/story?utm_source=x&ref=front#part", "https://example.com"),
  "https://example.com/story"
);

const rss = `<?xml version="1.0"?><rss><channel><item><title><![CDATA[AI &amp; Business move (Financial Times)]]></title><link>https://www.techmeme.com/260824/p3</link><description><![CDATA[<p><a href="https://www.ft.com/content/example?utm_source=x">Financial Times</a>: Useful summary.</p>]]></description><pubDate>Fri, 21 Aug 2026 08:00:00 GMT</pubDate></item></channel></rss>`;
const parsed = parseRssItems(rss, "https://www.techmeme.com");
assert.equal(parsed.length, 1);
assert.equal(parsed[0].title, "AI & Business move (Financial Times)");
assert.equal(parsed[0].url, "https://www.techmeme.com/260824/p3");
assert.equal(parsed[0].summary, "Financial Times : Useful summary.");
assert.equal(
  extractExternalLinks(parsed[0].description_html, parsed[0].url, ["techmeme.com"])[0],
  "https://www.ft.com/content/example"
);
assert.equal(publisherFromTitle(parsed[0].title), "Financial Times");

const html = `<a href="/technology/a-story-2026-08-21/">A sufficiently descriptive technology headline</a><a href="/">Home</a>`;
const anchors = extractAnchors(html, "https://www.reuters.com/technology/", (url, _href, title) => title.length >= 12 && new URL(url).pathname.startsWith("/technology/"));
assert.equal(anchors.length, 1);
assert.equal(anchors[0].url, "https://www.reuters.com/technology/a-story-2026-08-21/");

const sitemapIndex = `<?xml version="1.0"?><sitemapindex><sitemap><loc>https://www.reuters.com/a.xml</loc></sitemap><sitemap><loc>https://www.reuters.com/b.xml</loc></sitemap></sitemapindex>`;
assert.deepEqual(parseSitemapLocs(sitemapIndex), ["https://www.reuters.com/a.xml", "https://www.reuters.com/b.xml"]);

const newsSitemap = `<?xml version="1.0"?><urlset xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"><url><loc>https://www.reuters.com/technology/example-ai-story-2026-08-24/</loc><news:news><news:publication_date>2026-08-24T06:00:00Z</news:publication_date><news:title><![CDATA[Nvidia backs an AI startup]]></news:title></news:news></url></urlset>`;
const reutersItems = parseReutersNewsSitemap(newsSitemap);
assert.equal(reutersItems.length, 1);
assert.equal(reutersItems[0].title, "Nvidia backs an AI startup");
assert.equal(reutersItems[0].url, "https://www.reuters.com/technology/example-ai-story-2026-08-24/");

assert.equal(titleKey("The AI and Business Story"), "ai business story");
const deduped = dedupeCandidates([
  { source: "Reuters", source_rank: 1, source_home: "https://reuters.com", title: "Major AI business move", url: "https://reuters.com/a?utm_source=x", summary: "", link_quality: "original" },
  { source: "Techmeme", source_rank: 1, source_home: "https://techmeme.com", title: "Major AI business move", url: "https://example.com/duplicate", summary: "", link_quality: "original" },
  { source: "Sifted", source_rank: 1, source_home: "https://sifted.eu", title: "European startup funding changes", url: "https://sifted.eu/articles/funding", summary: "", link_quality: "original" }
]);
assert.equal(deduped.length, 2);
assert.equal(deduped[0].source, "Reuters");
assert.equal(deduped[1].source, "Sifted");

console.log("News intelligence source contract passed.");
