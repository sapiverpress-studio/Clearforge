#!/usr/bin/env bash
set -uo pipefail

# Failed test output must not be archived by run-daily.mjs and then immediately
# treated as novelty history. Remove the unapproved current draft first, then
# prune any older unpublished archives.
node src/prune-unapproved-current-draft.mjs
node src/prune-unpublished-run-history.mjs

max_attempts=1
attempt=1
start_epoch=$(date +%s)
wall_limit_seconds="${CLEARFORGE_FRESH_WALL_LIMIT_SECONDS:-600}"

echo "Clearforge fresh-story loop starting (one bounded story set; wall limit ${wall_limit_seconds}s)."

while [ "$attempt" -le "$max_attempts" ]; do
  elapsed=$(( $(date +%s) - start_epoch ))
  if [ "$elapsed" -ge "$wall_limit_seconds" ]; then
    echo "Fresh research reached its wall-time limit. Stopping."
    exit 124
  fi

  echo "Fresh story-set attempt ${attempt}/${max_attempts}"

  set +e
  bash scripts/run-daily-with-retry.sh
  research_status=$?
  set -e

  if [ "$research_status" -ne 0 ]; then
    echo "Research failed or timed out before event novelty could be checked."
    exit "$research_status"
  fi

  novelty_log="$(mktemp)"
  set +e
  node src/check-event-novelty.mjs 2>&1 | tee "$novelty_log"
  novelty_status=${PIPESTATUS[0]}
  set -e

  if [ "$novelty_status" -eq 0 ]; then
    rm -f "$novelty_log"
    echo "Fresh story-set passed event novelty."
    echo "Comparing verified stories and optimising each social platform for audience fit."
    node src/optimise-social-audience-fit.mjs
    echo "Audience-fit report and platform-specific social pack created."
    exit 0
  fi

  echo "Event novelty failed. No second full research cycle will be started automatically."
  rm -f "$novelty_log"
  exit "$novelty_status"
done

exit 1
