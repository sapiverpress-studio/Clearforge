#!/usr/bin/env bash
set -uo pipefail

if [ -n "${CLEARFORGE_DATE:-}" ]; then
  edition="$CLEARFORGE_DATE"
else
  edition="$(TZ=Europe/London date +%F)"
fi

set +e
node src/validate-and-approve.mjs
status=$?
set -e

report="drafts/${edition}/validation.json"
interest="drafts/${edition}/social_interest_report.json"

if [ "$status" -ne 0 ]; then
  echo
  echo "===== CLEARFORGE VALIDATION FAILURE DETAILS ====="
  if [ -f "$report" ]; then
    node -e '
      const fs = require("fs");
      const file = process.argv[1];
      const data = JSON.parse(fs.readFileSync(file, "utf8"));
      console.error(`Edition: ${data.date}`);
      console.error(`Failures (${(data.failures || []).length}):`);
      for (const [i, item] of (data.failures || []).entries()) console.error(`  ${i + 1}. ${item}`);
      if ((data.warnings || []).length) {
        console.error(`Warnings (${data.warnings.length}):`);
        for (const [i, item] of data.warnings.entries()) console.error(`  ${i + 1}. ${item}`);
      }
      console.error("Stats:", JSON.stringify(data.stats || {}, null, 2));
    ' "$report"
  else
    echo "validation.json was not created."
  fi
  if [ -f "$interest" ]; then
    echo
    echo "Social-interest report:"
    cat "$interest"
  fi
  echo "===== END VALIDATION DETAILS ====="
  exit "$status"
fi

if [ -f "$report" ]; then
  echo "Validation report:"
  cat "$report"
fi
