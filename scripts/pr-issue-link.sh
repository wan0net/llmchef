#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "usage: $0 <repo> <pr-number> [strict|branch-only]" >&2
}

if [[ "$#" -lt 2 || "$#" -gt 3 ]]; then
  usage
  exit 2
fi

repo="$1"
pr_number="$2"
mode="${3:-strict}"

if [[ "$mode" != "strict" && "$mode" != "branch-only" ]]; then
  echo "mode must be strict or branch-only" >&2
  exit 2
fi

pr_json="$(gh pr view "$pr_number" --repo "$repo" --json number,url,headRefName,body)"

head_ref="$(jq -r '.headRefName // ""' <<<"$pr_json")"
pr_url="$(jq -r '.url // ""' <<<"$pr_json")"
branch_issue="$(jq -r '.headRefName | (try capture("^codex/issue-(?<number>[0-9]+)$").number catch "")' <<<"$pr_json")"

body_issue_numbers_json="$(jq -c '
  [
    (.body // "")
    | scan("(?i)(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\\s+#([0-9]+)")
    | .[0]
  ]
  | unique
' <<<"$pr_json")"
body_issue_count="$(jq 'length' <<<"$body_issue_numbers_json")"
body_issue_single="$(jq -r 'if length == 1 then .[0] else "" end' <<<"$body_issue_numbers_json")"

binding_verified="false"
linked_issue=""
reason=""

if [[ -z "$branch_issue" ]]; then
  reason="branch does not match codex/issue-<number>"
elif [[ "$mode" == "strict" ]]; then
  if [[ "$body_issue_count" -eq 0 ]]; then
    reason="PR body has no close/fix/resolve issue directive"
  elif [[ "$body_issue_count" -gt 1 ]]; then
    reason="PR body references multiple closing issue numbers"
  elif [[ "$body_issue_single" != "$branch_issue" ]]; then
    reason="PR body closing issue does not match branch issue"
  else
    binding_verified="true"
    linked_issue="$branch_issue"
    reason="branch issue and PR body closing issue match"
  fi
else
  if [[ "$body_issue_count" -eq 0 ]]; then
    binding_verified="true"
    linked_issue="$branch_issue"
    reason="branch issue is valid; no PR body close directive present"
  elif [[ "$body_issue_count" -gt 1 ]]; then
    reason="PR body references multiple closing issue numbers"
  elif [[ "$body_issue_single" != "$branch_issue" ]]; then
    reason="PR body closing issue does not match branch issue"
  else
    binding_verified="true"
    linked_issue="$branch_issue"
    reason="branch issue and PR body closing issue match"
  fi
fi

jq -n \
  --arg mode "$mode" \
  --arg pr_url "$pr_url" \
  --arg head_ref "$head_ref" \
  --arg branch_issue "$branch_issue" \
  --arg linked_issue "$linked_issue" \
  --arg reason "$reason" \
  --argjson body_issue_numbers "$body_issue_numbers_json" \
  --argjson binding_verified "$binding_verified" \
  '{
    mode:$mode,
    pr_url:$pr_url,
    head_ref:$head_ref,
    branch_issue:$branch_issue,
    body_issue_numbers:$body_issue_numbers,
    linked_issue:$linked_issue,
    binding_verified:$binding_verified,
    reason:$reason
  }'
