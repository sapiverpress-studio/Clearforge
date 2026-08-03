#!/usr/bin/env bash
set -euo pipefail

bash scripts/run-fresh-daily-with-event-retry.sh

if [ -f "drafts/${CLEARFORGE_DATE}/no-public-content.json" ]; then
  echo "Campaign recorded a clean skipped day; verification and production are not required."
  exit 0
fi

npm run verify:sources
npm run rebuild:pruned
npm run facts:enforce
npm run brand:current
