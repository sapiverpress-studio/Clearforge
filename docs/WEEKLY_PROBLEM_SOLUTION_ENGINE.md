# Clearforge Weekly Problem-Solution Engine

## Purpose

This workflow turns one week of approved Clearforge research into one evidence-led commercial opportunity and a coherent seven-day content campaign.

It does not choose a product first and then search for supporting news. The order is fixed:

1. Read approved daily editions from the previous seven days.
2. Detect repeated operational problems affecting solo creators and small businesses using AI.
3. Group supporting evidence.
4. Score the strongest problem out of 35.
5. Select the most responsible route:
   - new pack
   - existing-product extension
   - existing-product update
   - monthly-bundle component
   - free resource only
6. Produce a minimum viable product brief.
7. Produce one free entry resource.
8. Produce seven connected content briefs using the locked Clearforge editorial structure.
9. Mark the campaign for human review.

## Schedule

`.github/workflows/weekly-problem-solution.yml` runs at 19:15 UTC every Sunday and can also be run manually with an optional `week_end` date.

## Inputs

The engine reads approved editions from:

```text
drafts/YYYY-MM-DD/
├── approval.json
├── structured_output.json
└── feature.json (optional)
```

Only editions with `article_approved: true` are included.

## Outputs

```text
weekly-campaigns/YYYY-MM-DD/
├── opportunity-brief.json
├── opportunity-brief.md
├── product-brief.json
├── content-plan.json
└── manifest.json
```

The manifest is always created with:

```json
{
  "status": "human_review_required"
}
```

The workflow does not automatically publish a product, price, sales claim or campaign.

## Commercial scoring

Each opportunity is scored from 0–5 on:

- appearance across multiple credible stories
- Clearforge audience fit
- repeatable task or failure point
- solvability with a practical pack
- usefulness beyond the current week
- ease of demonstration
- fit with the existing Clearforge library

Maximum score: 35.

Guidance:

- 28–35: strong product opportunity
- 22–27: manual review required
- 16–21: normally a free resource or existing-product update
- below 16: no new paid product should be forced

## Locked content structure

The generated campaign always uses:

- Monday: weekend AI roundup
- Tuesday: AI at work
- Wednesday: AI in everyday life
- Thursday: systems and automation
- Friday: new tools, stacks and workflows, with the product presented directly
- Saturday: prediction and outlook
- Sunday: recap and preparation for the following week

All seven content briefs address the same genuine problem from distinct angles.

## Manual command

```bash
CLEARFORGE_WEEK_END=2026-07-19 \
OPENAI_API_KEY=... \
npm run opportunity:weekly
```

## Review checklist

Before using a generated campaign:

- Confirm the problem is genuinely supported by the cited approved editions.
- Confirm inference is clearly separated from fact.
- Search the existing product catalogue for duplication.
- Decide whether the route should be a new pack, extension or update.
- Check that the product actually resolves the stated problem.
- Remove unsupported urgency, income, time-saving or adoption claims.
- Confirm the product can be built and tested during the week.
