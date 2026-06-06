#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 3 ]; then
  echo "usage: $0 <repo> <head-sha> <gate-name> [<gate-name> ...]" >&2
  exit 2
fi

repo="$1"
head_sha="$2"
shift 2

if [ -n "${CHECK_RUNS_JSON_FILE:-}" ]; then
  check_runs_json="$(cat "$CHECK_RUNS_JSON_FILE")"
else
  check_runs_json="$(gh api "repos/$repo/commits/$head_sha/check-runs")"
fi

not_ready=0

for gate_name in "$@"; do
  latest_any_gate_json="$(jq -c --arg gate_name "$gate_name" '
    [.check_runs[]
      | select(.app.slug == "github-actions" and .name == $gate_name)]
    | sort_by(.started_at // .created_at // "")
    | last // empty
  ' <<<"$check_runs_json")"

  if [ -z "$latest_any_gate_json" ]; then
    echo "Gate '$gate_name' has no GitHub Actions check run for $head_sha."
    not_ready=1
    continue
  fi

  latest_any_status="$(jq -r '.status' <<<"$latest_any_gate_json")"
  latest_any_started_at="$(jq -r '.started_at // .created_at // "unknown"' <<<"$latest_any_gate_json")"
  if [ "$latest_any_status" != "completed" ]; then
    echo "Gate '$gate_name' latest run is $latest_any_status from $latest_any_started_at; waiting."
    not_ready=1
    continue
  fi

  latest_gate_json="$(jq -c --arg gate_name "$gate_name" '
    [.check_runs[]
      | select(.app.slug == "github-actions" and .name == $gate_name)
      | select((.conclusion // "") != "skipped")]
    | sort_by(.started_at // .created_at // "")
    | last // empty
  ' <<<"$check_runs_json")"

  if [ -z "$latest_gate_json" ]; then
    echo "Gate '$gate_name' has no non-skipped GitHub Actions check run for $head_sha."
    not_ready=1
    continue
  fi

  status="$(jq -r '.status' <<<"$latest_gate_json")"
  conclusion="$(jq -r '.conclusion // ""' <<<"$latest_gate_json")"
  started_at="$(jq -r '.started_at // .created_at // "unknown"' <<<"$latest_gate_json")"

  if [ "$status" != "completed" ]; then
    echo "Gate '$gate_name' latest run is $status from $started_at; waiting."
    not_ready=1
    continue
  fi

  if [ "$conclusion" != "success" ]; then
    echo "Gate '$gate_name' latest completed run concluded '$conclusion' from $started_at."
    not_ready=1
    continue
  fi

  echo "Gate '$gate_name' latest completed run is success from $started_at."
done

exit "$not_ready"
