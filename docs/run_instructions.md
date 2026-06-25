# Clearforge Run Instructions

## Current system status

This is a draft-first system.

It can:

- create a dated draft folder
- store source notes
- generate an AI article draft if OPENAI_API_KEY is configured
- create an editor checklist
- create an approval file
- build a static blog from approved articles only

It does not yet:

- collect news automatically
- auto-publish blog posts
- post to Facebook
- post to Pinterest
- upload YouTube Shorts

## Local run

```bash
npm install
npm run draft
npm run build:site
```

## Add sources manually

Create a file:

```text
inputs/YYYY-MM-DD-sources.md
```

Example:

```md
# Sources for YYYY-MM-DD

1. Source name
   Link: https://example.com/article
   Date: YYYY-MM-DD
   Notes: Short note on why this matters.

2. Source name
   Link: https://example.com/article
   Date: YYYY-MM-DD
   Notes: Short note on why this matters.
```

Then run:

```bash
npm run draft
```

## Add OpenAI key locally

Do not commit secrets.

PowerShell:

```powershell
$env:OPENAI_API_KEY="your_key_here"
npm run draft
```

Mac/Linux:

```bash
export OPENAI_API_KEY="your_key_here"
npm run draft
```

## GitHub Actions setup

Add this repository secret:

```text
OPENAI_API_KEY
```

Then run:

GitHub repo -> Actions -> Clearforge Daily Draft -> Run workflow

The workflow also runs daily at 07:30 UTC.

## Approval flow

Each generated draft folder contains:

```text
drafts/YYYY-MM-DD/approval.json
```

Default:

```json
{
  "article_approved": false,
  "facebook_approved": false,
  "pinterest_approved": false,
  "youtube_approved": false
}
```

Only set flags to true after human review.

## Build public site

Only approved article drafts are included in the static site.

```bash
npm run build:site
```

If no article is approved, the site shows:

```text
No approved public briefs yet.
```

## Next build phase

After this works manually, build:

1. RSS/source collection
2. source scoring and deduping
3. social pack generation from the approved article
4. simple YouTube Shorts video generator
5. Facebook/Pinterest/YouTube posting scripts with approval gate
