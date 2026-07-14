#!/usr/bin/env bash
set -uo pipefail

# Keep each fresh test bounded. A rate-limited request should fail clearly rather
# than retrying into a long-running GitHub Actions job.
max_attempts=1
attempt=1
research_timeout="${CLEARFORGE_RESEARCH_TIMEOUT:-6m}"

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
    echo "Research attempt exceeded ${research_timeout}; stopping."
  elif grep -Eqi '429|rate[_ -]?limit|rate_limit_exceeded|tokens per min|TPM' "$log_file"; then
    echo "OpenAI rate limit detected. Failing quickly; run again later instead of waiting in a retry loop."
  else
    echo "Research failed with a non-retryable error."
  fi

  rm -f "$log_file"
  exit "$status"
done

exit 1
