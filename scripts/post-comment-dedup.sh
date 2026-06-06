#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -ne 4 ]]; then
  echo "usage: $0 <repo> <issue-or-pr-number> <marker-key> <body-file>" >&2
  exit 2
fi

repo="$1"
number="$2"
marker_key="$3"
body_file="$4"

if [[ ! -f "$body_file" ]]; then
  echo "Body file not found: $body_file" >&2
  exit 2
fi

body_hash="$(sha256sum "$body_file" | awk '{print $1}')"
marker="<!-- agent-comment-fingerprint:${marker_key}:${body_hash} -->"

tmp_body="$(mktemp "${RUNNER_TEMP:-/tmp}/agent-comment-dedup.XXXXXX.md")"
trap 'rm -f "$tmp_body"' EXIT
cat "$body_file" > "$tmp_body"
printf '\n%s\n' "$marker" >> "$tmp_body"

latest_bot_comment="$(gh api "repos/$repo/issues/$number/comments?per_page=30" --jq '
  [.[] | select((.user.login // "") == "github-actions[bot]") | .body]
  | last // ""
' 2>/dev/null || true)"

if [[ -n "$latest_bot_comment" ]] && grep -Fq "$marker" <<<"$latest_bot_comment"; then
  echo "Skipping duplicate comment for $repo#$number marker=$marker_key"
  exit 0
fi

gh issue comment "$number" --repo "$repo" --body-file "$tmp_body"
