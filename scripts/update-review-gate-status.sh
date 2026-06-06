#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 4 ]; then
  echo "usage: $0 <repo> <head-sha> <current-gate-name> <current-decision>" >&2
  exit 2
fi

repo="$1"
head_sha="$2"
current_gate="$3"
current_decision="$4"
context="${AGENT_REVIEW_STATUS_CONTEXT:-Agent Review Gate}"
target_url="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-$repo}/actions/runs/${GITHUB_RUN_ID:-}"

case "$current_decision" in
  go) current_state="success" ;;
  no-go|request-changes|uncertain) current_state="failure" ;;
  *)
    echo "Unknown current decision: $current_decision" >&2
    exit 2
    ;;
esac

if [ -n "${CHECK_RUNS_JSON_FILE:-}" ]; then
  check_runs_json="$(cat "$CHECK_RUNS_JSON_FILE")"
else
  check_runs_json="$(gh api "repos/$repo/commits/$head_sha/check-runs")"
fi

state="success"
description="V&V and Security gates are green."

gate_state() {
  local gate_name="$1"
  if [ "$gate_name" = "$current_gate" ]; then
    printf '%s\n' "$current_state"
    return 0
  fi

  local latest_any latest_non_skipped latest_status latest_conclusion
  latest_any="$(jq -c --arg gate_name "$gate_name" '
    [.check_runs[]
      | select(.app.slug == "github-actions" and .name == $gate_name)]
    | sort_by(.started_at // .created_at // "")
    | last // empty
  ' <<<"$check_runs_json")"
  if [ -z "$latest_any" ]; then
    printf 'pending\n'
    return 0
  fi

  latest_status="$(jq -r '.status' <<<"$latest_any")"
  if [ "$latest_status" != "completed" ]; then
    printf 'pending\n'
    return 0
  fi

  latest_non_skipped="$(jq -c --arg gate_name "$gate_name" '
    [.check_runs[]
      | select(.app.slug == "github-actions" and .name == $gate_name)
      | select((.conclusion // "") != "skipped")]
    | sort_by(.started_at // .created_at // "")
    | last // empty
  ' <<<"$check_runs_json")"
  if [ -z "$latest_non_skipped" ]; then
    printf 'pending\n'
    return 0
  fi

  latest_status="$(jq -r '.status' <<<"$latest_non_skipped")"
  latest_conclusion="$(jq -r '.conclusion // ""' <<<"$latest_non_skipped")"
  if [ "$latest_status" != "completed" ]; then
    printf 'pending\n'
  elif [ "$latest_conclusion" = "success" ]; then
    printf 'success\n'
  else
    printf 'failure\n'
  fi
}

vv_state="$(gate_state "Verify PR")"
security_state="$(gate_state "Security review PR")"

if [ "$vv_state" = "failure" ] || [ "$security_state" = "failure" ]; then
  state="failure"
  description="V&V or Security requested changes."
elif [ "$vv_state" = "pending" ] || [ "$security_state" = "pending" ]; then
  state="pending"
  description="Waiting for V&V and Security gates."
fi

if [ -n "${STATUS_DRY_RUN_FILE:-}" ]; then
  jq -n \
    --arg state "$state" \
    --arg context "$context" \
    --arg description "$description" \
    --arg target_url "$target_url" \
    '{state:$state, context:$context, description:$description, target_url:$target_url}' > "$STATUS_DRY_RUN_FILE"
  exit 0
fi

gh api "repos/$repo/statuses/$head_sha" \
  -f "state=$state" \
  -f "context=$context" \
  -f "description=$description" \
  -f "target_url=$target_url" >/dev/null
