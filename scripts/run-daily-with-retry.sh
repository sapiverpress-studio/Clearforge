#!/usr/bin/env bash
set -uo pipefail

# Research is expensive and a rate-limited request should never occupy a runner
# for an hour. Allow one short retry only, and cap each research attempt.
max_attempts=2
attempt=1
delays=(30)
research_timeout="${CLEARFORGE_RESEARCH_TIMEOUT:-10m}"

while [ "$attempt" -le "$max_attempts" ]; do
  log_file="$(mktemp)"
  echo "Clearforge research attempt ${attempt}/${max_attempts} (hard limit ${research_timeout})"

  set +e
  timeout --signal=TERM --kill-after=30s "$research_timeout" node src/run-daily.mjs 2>&1 | tee "$log_file"
  status=${PIPESTATUS[0]}
  set -e

  if [ "$status" -eq 0 ]; then
    rm -f "$log_file"
    exit 0
  fi

  if [ "$status" -eq 124 ] || [ "$status" -eq 137 ]; then
    echo "Research attempt exceeded ${research_timeout}; stopping instead of leaving the workflow running indefinitely."
    rm -f "$log_file"
    exit 124
  fi

  if grep -Eqi '429|rate[_ -]?limit|rate_limit_exceeded|tokens per min|TPM' "$log_file"; then
    if [ "$attempt" -lt "$max_attempts" ]; then
      delay="${delays[$((attempt-1))]}"
      echo "OpenAI rate limit detected. Waiting ${delay}s for one final retry."
      rm -f "$log_file"
      sleep "$delay"
      attempt=$((attempt+1))
      continue
    fi
    echo "OpenAI rate limit still active after the final retry. Failing quickly; run again later."
  else
    echo "Research failed with a non-retryable error."
  fi

  rm -f "$log_file"
  exit "$status"
done

exit 1
