#!/usr/bin/env bash
set -uo pipefail

# Keep the complete fresh-research stage inside the existing six-minute budget.
# The final attempt changes strategy instead of repeating the same timed-out search.
max_attempts=2
attempt=1
total_timeout_seconds="${CLEARFORGE_RESEARCH_TIMEOUT_SECONDS:-360}"
kill_grace_seconds=10
usable_timeout_seconds=$(( total_timeout_seconds - (kill_grace_seconds * max_attempts) ))
if [ "$usable_timeout_seconds" -le 0 ]; then
  echo "Research timeout must exceed the combined termination grace."
  exit 2
fi
standard_timeout_seconds=$(( usable_timeout_seconds / 2 ))
fallback_timeout_seconds=$(( usable_timeout_seconds - standard_timeout_seconds ))

while [ "$attempt" -le "$max_attempts" ]; do
  if [ "$attempt" -eq 1 ]; then
    research_mode="standard"
    attempt_timeout_seconds="$standard_timeout_seconds"
  else
    research_mode="broad_fallback"
    attempt_timeout_seconds="$fallback_timeout_seconds"
  fi

  log_file="$(mktemp)"
  echo "Sapiver Forge research attempt ${attempt}/${max_attempts}: ${research_mode} (hard limit ${attempt_timeout_seconds}s; total budget ${total_timeout_seconds}s)"

  set +e
  CLEARFORGE_RESEARCH_MODE="$research_mode" \
    timeout --signal=TERM --kill-after="${kill_grace_seconds}s" "${attempt_timeout_seconds}s" \
    node src/run-daily.mjs 2>&1 | tee "$log_file"
  status=${PIPESTATUS[0]}
  set -e

  if [ "$status" -eq 0 ]; then
    rm -f "$log_file"
    exit 0
  fi

  if grep -Eqi '429|rate[_ -]?limit|rate_limit_exceeded|tokens per min|TPM' "$log_file"; then
    echo "OpenAI rate limit detected. Stopping without a second request."
    rm -f "$log_file"
    exit "$status"
  fi

  if [ "$attempt" -eq 1 ]; then
    if [ "$status" -eq 124 ] || [ "$status" -eq 137 ]; then
      echo "Standard research exceeded ${attempt_timeout_seconds}s. Starting the broader final attempt inside the unchanged total budget."
    else
      echo "Standard research did not produce a valid pack. Starting the broader final attempt inside the unchanged total budget."
    fi
    rm -f "$log_file"
    attempt=$(( attempt + 1 ))
    continue
  fi

  if [ "$status" -eq 124 ] || [ "$status" -eq 137 ]; then
    echo "Broader final research attempt exceeded ${attempt_timeout_seconds}s."
  else
    echo "Broader final research attempt failed with status ${status}."
  fi
  rm -f "$log_file"
  exit "$status"
done

exit 1
