# Clearforge Daily Release Desk

## What happens automatically

The Clearforge Daily Autopilot researches and generates the edition, runs the established factual checks, prepares the article, feature, podcast and social material, builds the Release Desk report and then stops.

It does not deploy the website, publish the podcast, post to DEV or dispatch social material.

## What Jim does each day

1. Open the latest **Clearforge Daily Autopilot** workflow run in GitHub Actions.
2. Read the Release Desk summary shown on the run page.
3. Download the `clearforge-release-desk-[date]` artifact and open the HTML report on the phone.
4. Check:
   - the decision is not `STOP`;
   - hard stops are empty;
   - every surprising claim has a credible source;
   - confirmed facts and Clearforge interpretation are clearly separated;
   - every social opening matches the evidence;
   - product names, links, prices and promises are correct;
   - the proposed disclosure is present.
5. Open a complete article, podcast or video only when the report flags it or something looks questionable.
6. If satisfied, open **Clearforge Approve and Publish** in GitHub Actions.
7. Select **Run workflow**.
8. Enter the exact edition identifier shown in the report.
9. Enter `APPROVE [edition]` in the confirmation box.
10. Run the workflow and check that it finishes successfully.

## Decision rules

- `STOP`: do not approve. The edition must be corrected and the Release Desk regenerated.
- `HUMAN REVIEW` with a score below `0.960`: inspect every flag and the relevant full outputs.
- `HUMAN REVIEW` at or above `0.960`: perform the routine report review. The score reduces review depth but never publishes automatically.

## Truthful disclosure

Approved material states:

> Produced with AI assistance and released with human approval by Clearforge.

This means Jim approved the release from the evidence report. It does not claim that every word, frame or second was personally consumed.

## If Jim does nothing

Nothing publishes. The generated edition and report remain available for later review.
