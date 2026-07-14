#!/usr/bin/env bash
set -uo pipefail

max_attempts=4
attempt=1

echo "Clearforge fresh-story loop starting."

while [ "$attempt" -le "$max_attempts" ]; do
  echo "Fresh story-set attempt ${attempt}/${max_attempts}"

  set +e
  bash scripts/run-daily-with-retry.sh
  research_status=$?
  set -e

  if [ "$research_status" -ne 0 ]; then
    echo "Research failed before event novelty could be checked."
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

  if grep -Eqi 'Event novelty failed|same underlying event|duplicate_events' "$novelty_log"; then
    if [ "$attempt" -lt "$max_attempts" ]; then
      echo "Event-level duplicate detected. Researching a replacement story set automatically."
      rm -f "$novelty_log"
      attempt=$((attempt+1))
      sleep 10
      continue
    fi
  fi

  echo "Event novelty failed with no retry budget left, or with a non-retryable error."
  rm -f "$novelty_log"
  exit "$novelty_status"
done

exit 1
