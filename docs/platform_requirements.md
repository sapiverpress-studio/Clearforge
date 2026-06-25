# Clearforge Platform Automation Requirements

## Purpose

This document records what will be needed later for automated posting.

Do not add secrets directly to this repo.

## Target pipeline

1. Daily source collection.
2. Article draft generation.
3. Human review.
4. Approved article published to blog.
5. Approved article repurposed into social outputs.
6. Approved posts sent to Facebook, Pinterest, and YouTube.

## Recommended automation stages

### Stage 1: Draft only

Generate:

- sources.json
- daily_brief.md
- social_pack.md
- claims_to_verify.md
- editor_checklist.md

No live publishing.

### Stage 2: Blog draft generation

Generate a dated Markdown article ready for human review.

No public deployment until approved.

### Stage 3: Social draft generation

Generate platform-specific drafts:

- Facebook post text
- Pinterest pin title, description, and card image idea
- YouTube Shorts script and caption

No live posting until approved.

### Stage 4: Controlled publishing

Only after testing, add platform posting scripts.

Publishing should require one of:

- manual run command
- approved status file
- approval checkbox in a control file
- separate reviewed branch

## OpenAI

Likely use:

- Responses API
- structured outputs where useful
- optional web/search tooling later

Needed secret:

- OPENAI_API_KEY

## GitHub Actions

Likely use:

- scheduled daily workflow
- manual workflow_dispatch trigger
- GitHub Actions secrets
- generated draft artifacts or committed draft files

Recommended first schedule:

- one daily draft build in the morning
- no auto-publish

## Facebook

Likely need:

- Meta developer app
- Facebook Page access
- Page ID
- Page access token
- required permissions for Page publishing

Needed secrets later:

- FACEBOOK_PAGE_ID
- FACEBOOK_PAGE_ACCESS_TOKEN

## Pinterest

Likely need:

- Pinterest developer app
- access token
- board ID
- approved image/card asset
- destination URL from approved article

Needed secrets later:

- PINTEREST_ACCESS_TOKEN
- PINTEREST_BOARD_ID

## YouTube

Likely need:

- Google Cloud project
- YouTube Data API enabled
- OAuth client
- refresh token
- upload scope
- generated vertical MP4

Needed secrets later:

- YOUTUBE_CLIENT_ID
- YOUTUBE_CLIENT_SECRET
- YOUTUBE_REFRESH_TOKEN

## Important YouTube note

YouTube API uploads from unverified API projects may be restricted to private viewing until the API project passes the required audit/compliance process. Plan for private/test uploads first.

## Approval gate recommendation

Create a file like:

```text
approval/YYYY-MM-DD.json
```

Example:

```json
{
  "date": "YYYY-MM-DD",
  "article_approved": false,
  "facebook_approved": false,
  "pinterest_approved": false,
  "youtube_approved": false
}
```

Publishing scripts should refuse to run unless the relevant approval flag is true.

## Brand safety

No public post should expose repository owner names, internal file paths, private workflow logs, credentials, or unrelated brand names.