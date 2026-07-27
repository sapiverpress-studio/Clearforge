#!/usr/bin/env bash
set -euo pipefail

prefix="clearforge-pending-edition-"
selected_edition=""
selected_run=""
candidates="$(mktemp)"
trap 'rm -f "$candidates"' EXIT

gh api "repos/${GITHUB_REPOSITORY}/actions/artifacts?per_page=100" \
  --jq '.artifacts | map(select(.expired == false and (.name | startswith("clearforge-pending-edition-")))) | sort_by(.created_at) | reverse | .[] | "\(.id) \(.name) \(.workflow_run.id)"' \
  > "$candidates"

while read -r artifact_id artifact_name run_id; do
  [ -n "$artifact_id" ] || continue
  edition="${artifact_name#${prefix}}"
  if [[ ! "$edition" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}(-[a-z0-9-]+)?$ ]]; then
    continue
  fi

  candidate_dir="$(mktemp -d)"
  candidate_zip="$candidate_dir/pending.zip"
  if ! gh api "repos/${GITHUB_REPOSITORY}/actions/artifacts/${artifact_id}/zip" > "$candidate_zip"; then
    rm -rf "$candidate_dir"
    continue
  fi
  if ! unzip -q "$candidate_zip" -d "$candidate_dir/files"; then
    rm -rf "$candidate_dir"
    continue
  fi

  if [[ -f "$candidate_dir/files/drafts/$edition/release-desk.json" && -f "$candidate_dir/files/drafts/$edition/structured_output.json" ]]; then
    cp -R "$candidate_dir/files/." .
    selected_edition="$edition"
    selected_run="$run_id"
    rm -rf "$candidate_dir"
    break
  fi
  rm -rf "$candidate_dir"
done < "$candidates"

if [ -z "$selected_edition" ]; then
  echo "::error::No completed pending edition with a Release Desk was found."
  exit 1
fi

echo "CLEARFORGE_DATE=$selected_edition" >> "$GITHUB_ENV"
echo "CLEARFORGE_CONFIRMATION=APPROVE $selected_edition" >> "$GITHUB_ENV"
echo "Selected newest completed edition $selected_edition from workflow run $selected_run."
