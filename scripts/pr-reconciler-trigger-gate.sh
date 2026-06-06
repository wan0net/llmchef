#!/usr/bin/env bash
set -euo pipefail

input_file="${1:?usage: pr-reconciler-trigger-gate.sh <event-json>}"
jq -e '.' "$input_file" >/dev/null

event_name="$(jq -r '.event_name // ""' "$input_file")"
comment_body="$(jq -r '.comment_body // ""' "$input_file")"
is_pr_comment="$(jq -r '.is_pr_comment // false' "$input_file")"
author_association="$(jq -r '.author_association // ""' "$input_file")"

allow="false"
reason="trigger not allowed"

if [[ "$event_name" == "schedule" || "$event_name" == "workflow_dispatch" ]]; then
  allow="true"
  reason="trusted non-comment trigger"
elif [[ "$event_name" == "issue_comment" ]]; then
  if [[ "$is_pr_comment" != "true" ]]; then
    reason="command must be posted on a PR comment"
  elif ! grep -Fxq '/agent reconcile' <<<"$comment_body"; then
    reason="missing exact /agent reconcile command line"
  elif [[ "$author_association" != "OWNER" && "$author_association" != "MEMBER" && "$author_association" != "COLLABORATOR" ]]; then
    reason="unauthorized actor association: $author_association"
  else
    allow="true"
    reason="authorized command trigger"
  fi
fi

jq -n --argjson allow "$allow" --arg reason "$reason" '{allow:$allow, reason:$reason}'
