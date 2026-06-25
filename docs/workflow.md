# Clearforge Daily AI Brief Builder Workflow

## End goal

Automated daily content pipeline:

AI news sources -> curated story list -> Clearforge article draft -> human review -> social repurpose pack -> approved posting to Facebook, Pinterest, and YouTube.

## Important principle

This is not an auto-publishing machine at the start.

It is a draft-and-review system that can later become a controlled publishing pipeline.

## Phase 1: Manual foundation

Purpose:
Prove the format before building automation.

Steps:

1. Manually collect 3 to 5 reputable AI news sources.
2. Paste them into the Daily AI Brief prompt.
3. Generate a draft article.
4. Run editorial checks.
5. Generate social repurpose formats.
6. Publish manually only after review.

## Phase 2: Semi-automated draft builder

Purpose:
Reduce daily manual effort without risking auto-published errors.

Planned pieces:

- source collection script
- source deduping
- source scoring
- article draft generation
- repurpose pack generation
- draft export to Markdown
- review checklist

Output folder idea:

```text
/drafts/YYYY-MM-DD/
├─ sources.json
├─ daily_brief.md
├─ social_pack.md
├─ claims_to_verify.md
└─ editor_checklist.md
```

## Phase 3: Blog publishing prep

Purpose:
Prepare article pages but keep human approval.

Options:

- static Markdown blog
- Netlify site
- WordPress or Ghost later
- manual copy/paste first

Recommended first route:
Static Markdown blog, reviewed before deployment.

## Phase 4: Social asset generation

Purpose:
Create social-ready material from the approved article.

Needed outputs:

- Facebook post text
- Pinterest pin title and description
- Pinterest image/card idea
- YouTube Shorts script
- optional vertical video caption file
- short quote/card lines

## Phase 5: Platform automation

Purpose:
Schedule or publish only approved content.

Target platforms:

- Facebook Page
- Pinterest board
- YouTube Shorts

Possible technical path:

- GitHub Actions scheduled workflow
- OpenAI API for draft generation
- source feeds and API/RSS/news search
- platform APIs for upload/publish
- secret storage in GitHub Actions secrets

## Required secrets later

Do not add these to files.

Likely future secrets:

- OPENAI_API_KEY
- NEWS_API_KEY or RSS source configuration
- FACEBOOK_PAGE_ID
- FACEBOOK_PAGE_ACCESS_TOKEN
- PINTEREST_ACCESS_TOKEN
- PINTEREST_BOARD_ID
- YOUTUBE_CLIENT_ID
- YOUTUBE_CLIENT_SECRET
- YOUTUBE_REFRESH_TOKEN

## Automation rule

Early automation should create drafts only.

Live publishing should be added only after:

1. manual 7-day test passes
2. source quality is good
3. claim checks are reliable
4. social output is useful
5. platform credentials are confirmed
6. human approval switch is designed

## Daily operating checklist

1. Collect sources.
2. Generate brief.
3. Check facts.
4. Check claims.
5. Edit article.
6. Approve article.
7. Generate social pack.
8. Check social pack.
9. Publish or schedule.
10. Record what was published.

## Definition of done for foundation

The foundation is ready when:

- brand notes exist
- prompt exists
- article template exists
- social template exists
- editorial rules exist
- manual 7-day test exists
- README explains the end goal
- no secret credentials are stored in repo