#!/usr/bin/env bash
set -uo pipefail

max_attempts=4
attempt=1
delays=(20 45 90)

while [ "$attempt" -le "$max_attempts" ]; do
  log_file="$(mktemp)"
  echo "Clearforge research attempt ${attempt}/${max_attempts}"

  set +e
  node src/run-daily.mjs 2>&1 | tee "$log_file"
  status=${PIPESTATUS[0]}
  set -e

  if [ "$status" -eq 0 ]; then
    rm -f "$log_file"
    exit 0
  fi

  if grep -Eqi '429|rate[_ -]?limit|rate_limit_exceeded|tokens per min|TPM' "$log_file"; then
    if [ "$attempt" -lt "$max_attempts" ]; then
      delay="${delays[$((attempt-1))]}"
      echo "OpenAI rate limit detected. Waiting ${delay}s before automatic retry."
      rm -f "$log_file"
      sleep "$delay"
      attempt=$((attempt+1))
      continue
    fi
  fi

  echo "Research failed with a non-retryable error, or retry budget exhausted."
  rm -f "$log_file"
  exit "$status"
done

exit 1
