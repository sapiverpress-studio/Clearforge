# Sapiver Forge News Intelligence

## Purpose

This is a secondary current-news publishing pipeline built around five discovery sources:

1. Techmeme
2. Reuters Technology
3. Hacker News
4. Hugging Face Daily Papers
5. Sifted

The five sources are discovery inputs, not five equally authoritative proof sources. Important claims are checked again with grounded search and preference is given to primary sources and Reuters for confirmation. Hacker News and Techmeme are discovery signals. Hugging Face research claims are described cautiously unless independently confirmed.

## Daily weekday flow

`daily-news-intelligence.yml` runs Monday to Friday and can also be started manually.

It:

1. Collects current candidate stories from the five-source set.
2. Deduplicates and ranks candidates.
3. Runs a grounded verification pass.
4. Produces 3–6 selected stories with confirmed facts separated from Sapiver Forge interpretation.
5. Writes a sealed candidate under `news-intelligence/YYYY-MM-DD/`.
6. Publishes a cross-repo bridge under `bridge/news-intelligence/latest/`.
7. Syncs only new `sapiver-daily-brief` Netlify form submissions into the dedicated Brevo list `Sapiver Forge Daily Brief`.
8. Creates a Brevo campaign draft if the edition passes the verification threshold.

The workflow does **not** send the email automatically. The exact candidate must be reviewed and released through `release-daily-newsletter.yml` using its date, candidate ID and the confirmation word `SEND`.

## Subscriber consent and Brevo

The existing `BREVO_LIST_ID` is retained as the old list and as the folder anchor. Existing weekly subscribers are not silently migrated to daily email.

The first Daily Brief sync/send resolves a list named `Sapiver Forge Daily Brief`. If it does not exist, the workflow creates it in the same Brevo folder as the existing list. No second API key or new repository secret is required.

The public newsletter form is now named `sapiver-daily-brief` and explicitly asks for consent to receive weekday email.

## Weekly podcast flow

`weekly-intelligence-podcast.yml` runs on Saturday and produces a 10–15 minute synthesis from the week's verified daily intelligence manifests.

It does not simply read the daily newsletters in order. It selects and connects the developments that mattered most across AI, technology, business, research and developer activity.

The Saturday run creates a sealed candidate under `reports/weekly-intelligence/YYYY-MM-DD/` with file hashes and a candidate ID. It does **not** call ElevenLabs and does **not** publish the RSS feed.

After review, `release-weekly-intelligence-podcast.yml` requires the exact week end, candidate ID and confirmation word `PUBLISH`. It verifies the sealed file hashes, creates the MP3 with the existing ElevenLabs podcast voice and publishes it through the existing hosted podcast RSS code.

The podcast release updates repository podcast source files. Netlify production deployment remains separate/manual so this change does not add an automatic Netlify deployment every day.

## Comic repo bridge

The comic repository consumes `bridge/news-intelligence/latest/` through its own `sapiver-forge-news-intelligence.yml` workflow.

It creates a static 1080×1350 Daily Brief card and social copy package under `social/news-intelligence/YYYY-MM-DD/`. Current-news social output is explicitly marked `posting_allowed: false` and `human_approval_required: true`; this workflow does not auto-post it.

## Release thresholds

- At least 3 of the 5 discovery sources must be healthy.
- At least 8 candidates must be available before editorial selection.
- Individual selected stories below 0.72 confidence are excluded.
- Daily newsletter readiness requires overall confidence of at least 0.78.
- Failure to verify produces a blocked source-index edition rather than a sendable newsletter.

These thresholds are conservative defaults and can be adjusted after real run evidence is available.
