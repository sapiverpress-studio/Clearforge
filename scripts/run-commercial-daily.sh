#!/usr/bin/env bash
set -euo pipefail

bash scripts/run-fresh-daily-with-event-retry.sh

if [ -f "drafts/${SAPIVER_FORGE_DATE}/no-public-content.json" ]; then
  echo "Campaign recorded a clean skipped day; verification and production are not required."
  exit 0
fi

set +e
npm run verify:sources
verification_status=$?
set -e
if [ "$verification_status" -ne 0 ]; then
  if node src/record-no-usable-verified-core.mjs; then
    exit 0
  fi
  exit "$verification_status"
fi
npm run rebuild:pruned
npm run facts:enforce
npm run brand:current
