#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -lt 3 ]]; then
  echo "usage: $0 EVENT_JSON ROLE_LABEL OUTPUT_JSON" >&2
  exit 2
fi

event_json="$1"
role_label="$2"
output_json="$3"

repo="${GITHUB_REPOSITORY:-}"
issue_number="${ISSUE_NUMBER:-}"
actor="${GITHUB_ACTOR:-}"

if [[ -z "$repo" || -z "$issue_number" || -z "$actor" ]]; then
  echo "GITHUB_REPOSITORY, ISSUE_NUMBER, and GITHUB_ACTOR are required" >&2
  exit 2
fi

event_name="$(jq -r '.action // empty' "$event_json")"
trigger_label="$(jq -r '.label.name // empty' "$event_json")"
if [[ "$event_name" != "labeled" || "$trigger_label" != "agent:approved" ]]; then
  echo "Denied: only trusted approval label events can trigger execution." >&2
  exit 1
fi

event_issue_body="$(jq -r '.issue.body // ""' "$event_json")"
event_issue_title="$(jq -r '.issue.title // ""' "$event_json")"
event_body_hash="$(printf '%s' "$event_issue_body" | sha256sum | awk '{print $1}')"
event_prompt_hash="$(jq -c '{title:(.issue.title // ""), body:(.issue.body // "")}' "$event_json" | sha256sum | awk '{print $1}')"
event_issue_url="$(jq -r '.issue.html_url // empty' "$event_json")"
event_updated_at="$(jq -r '.issue.updated_at // empty' "$event_json")"

live_issue_file="$(mktemp "${RUNNER_TEMP:-/tmp}/issue-live-${issue_number}.XXXXXX.json")"
chmod 600 "$live_issue_file"
trap 'rm -f "$live_issue_file"' EXIT

if [[ -n "${ISSUE_GATE_LIVE_ISSUE_FILE:-}" ]]; then
  cp "$ISSUE_GATE_LIVE_ISSUE_FILE" "$live_issue_file"
else
  gh issue view "$issue_number" --repo "$repo" --json number,title,body,state,labels,url,updatedAt > "$live_issue_file"
fi

live_body="$(jq -r '.body // ""' "$live_issue_file")"
live_title="$(jq -r '.title // ""' "$live_issue_file")"
live_body_hash="$(printf '%s' "$live_body" | sha256sum | awk '{print $1}')"
live_prompt_hash="$(jq -c '{title:(.title // ""), body:(.body // "")}' "$live_issue_file" | sha256sum | awk '{print $1}')"
live_state="$(jq -r '.state // empty' "$live_issue_file")"
approval_mode="human"
repair_pr_url=""
event_has_protected_paths="$(jq -r '([.issue.labels[]?.name] | index("agent:protected-paths")) != null' "$event_json")"
live_has_protected_paths="$(jq -r '([.labels[]?.name] | index("agent:protected-paths")) != null' "$live_issue_file")"
event_has_repair_requeue="$(jq -r '([.issue.labels[]?.name] | index("agent:repair-requeue")) != null' "$event_json")"
live_has_repair_requeue="$(jq -r '([.labels[]?.name] | index("agent:repair-requeue")) != null' "$live_issue_file")"
event_has_focus_dequeue="$(jq -r '([.issue.labels[]?.name] | index("agent:focus-dequeue")) != null' "$event_json")"
live_has_focus_dequeue="$(jq -r '([.labels[]?.name] | index("agent:focus-dequeue")) != null' "$live_issue_file")"
repair_requeue_requested=false
if [[ "$event_has_repair_requeue" == "true" && "$live_has_repair_requeue" == "true" ]]; then
  repair_requeue_requested=true
fi
focus_dequeue_requested=false
if [[ "$event_has_focus_dequeue" == "true" && "$live_has_focus_dequeue" == "true" ]]; then
  focus_dequeue_requested=true
fi
approved_protected_paths=false
if [[ "$event_has_protected_paths" == "true" && "$live_has_protected_paths" == "true" ]]; then
  approved_protected_paths=true
fi

if [[ "$live_state" != "OPEN" ]]; then
  echo "Denied: issue is not open (state=${live_state})." >&2
  exit 1
fi

verify_repair_requeue() {
  if [[ "$role_label" != "agent:developer" ]]; then
    echo "Denied: bot repair reapproval is only allowed for Developer repair requeues." >&2
    exit 1
  fi

  local pr_file
  pr_file="$(mktemp "${RUNNER_TEMP:-/tmp}/repair-pr-${issue_number}.XXXXXX.json")"
  chmod 600 "$pr_file"
  if [[ -n "${ISSUE_GATE_REPAIR_PR_FILE:-}" ]]; then
    cp "$ISSUE_GATE_REPAIR_PR_FILE" "$pr_file"
  else
    local branch_pattern pr_number
    branch_pattern="^codex/issue-${issue_number}$"
    pr_number="$(gh pr list --repo "$repo" --state open --json number,headRefName --jq ".[] | select(.headRefName | test(\"${branch_pattern}\")) | .number" | head -n 1)"
    if [[ -z "$pr_number" ]]; then
      echo "Denied: bot repair reapproval requires an existing open PR branch matching ${branch_pattern}." >&2
      rm -f "$pr_file"
      exit 1
    fi
    gh pr view "$pr_number" --repo "$repo" --json number,body,headRefName,url > "$pr_file"
  fi

  local head_ref branch_issue matching_issue_count approved_hash
  head_ref="$(jq -r '.headRefName // ""' "$pr_file")"
  branch_issue="$(jq -r '.headRefName | (try capture("^codex/issue-(?<number>[0-9]+)$").number catch "")' "$pr_file")"
  if [[ "$branch_issue" != "$issue_number" ]]; then
    echo "Denied: bot repair reapproval requires PR branch codex/issue-${issue_number} (got ${head_ref})." >&2
    rm -f "$pr_file"
    exit 1
  fi

  body_issue_numbers_json="$(jq -c '
    [
      (.body // "")
      | scan("(?i)(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\\s+#([0-9]+)")
      | .[0]
    ]
    | unique
  ' "$pr_file")"
  body_issue_count="$(jq 'length' <<<"$body_issue_numbers_json")"
  body_issue_single="$(jq -r 'if length == 1 then .[0] else "" end' <<<"$body_issue_numbers_json")"
  if [[ "$body_issue_count" -eq 0 ]]; then
    echo "Denied: bot repair reapproval requires the existing PR body to close issue #${issue_number}." >&2
    rm -f "$pr_file"
    exit 1
  fi
  if [[ "$body_issue_count" -gt 1 || "$body_issue_single" != "$issue_number" ]]; then
    echo "Denied: bot repair reapproval requires a single PR body close directive matching issue #${issue_number}." >&2
    rm -f "$pr_file"
    exit 1
  fi

  approved_hash="$(jq -r '.body // "" | (try capture("agent-approved-prompt-hash: (?<hash>[a-f0-9]{64})").hash catch "")' "$pr_file")"
  if [[ -z "$approved_hash" || "$approved_hash" != "$live_prompt_hash" ]]; then
    echo "Denied: bot repair reapproval could not prove the issue prompt still matches the original human approval." >&2
    rm -f "$pr_file"
    exit 1
  fi

  repair_pr_url="$(jq -r '.url // empty' "$pr_file")"
  rm -f "$pr_file"
}

verify_focus_dequeue() {
  if [[ "$role_label" != "agent:developer" && "$role_label" != "agent:architect" ]]; then
    echo "Denied: focus dequeue approval is only allowed for Architect or Developer roles." >&2
    exit 1
  fi

  local queued_hash
  queued_hash="$(jq -r '
    [.comments[]?.body // "" | (try capture("agent-focus-queued-prompt-hash: (?<hash>[a-f0-9]{64})").hash catch empty)]
    | last // ""
  ' "$live_issue_file" 2>/dev/null || true)"
  if [[ -z "$queued_hash" && -z "${ISSUE_GATE_LIVE_ISSUE_FILE:-}" ]]; then
    queued_hash="$(gh issue view "$issue_number" --repo "$repo" --json comments --jq '
      [.comments[].body | (try capture("agent-focus-queued-prompt-hash: (?<hash>[a-f0-9]{64})").hash catch empty)]
      | last // ""
    ' 2>/dev/null || true)"
  fi

  if [[ -z "$queued_hash" ]]; then
    echo "Denied: focus dequeue approval requires a queued prompt hash comment from the original approval." >&2
    exit 1
  fi
  if [[ "$queued_hash" != "$live_prompt_hash" ]]; then
    echo "Denied: issue prompt changed while queued; maintainer reapproval is required." >&2
    echo "queued_prompt_hash=${queued_hash} live_prompt_hash=${live_prompt_hash}" >&2
    exit 1
  fi
}

actor_permission="${ISSUE_GATE_ACTOR_PERMISSION:-}"
if [[ "$repair_requeue_requested" == "true" ]]; then
  approval_mode="repair_requeue"
  verify_repair_requeue
elif [[ "$focus_dequeue_requested" == "true" ]]; then
  approval_mode="focus_dequeue"
  verify_focus_dequeue
fi

if [[ "$actor" == "github-actions" || "$actor" == "github-actions[bot]" ]]; then
  if [[ "$repair_requeue_requested" != "true" && "$focus_dequeue_requested" != "true" ]]; then
    echo "Denied: github-actions approval requires agent:repair-requeue or agent:focus-dequeue on both the approval event and live issue." >&2
    exit 1
  fi
  if [[ "$repair_requeue_requested" == "true" ]]; then
    actor_permission="actions-repair"
  else
    actor_permission="actions-focus-dequeue"
  fi
else
  if [[ -z "$actor_permission" ]]; then
    actor_permission="$(gh api "repos/${repo}/collaborators/${actor}/permission" --jq .permission 2>/dev/null || printf 'none')"
  fi
  case "$actor_permission" in
    admin|maintain|write) ;;
    *)
      echo "Denied: actor ${actor} has permission '${actor_permission}', requires write/maintain/admin." >&2
      exit 1
      ;;
  esac
fi

if ! jq -e --arg role "$role_label" '([.labels[].name] | index("agent:approved") and index($role) and (index("agent:human-only") | not))' "$live_issue_file" >/dev/null; then
  echo "Denied: live labels no longer satisfy approved role gate for ${role_label}." >&2
  exit 1
fi

if [[ "$event_prompt_hash" != "$live_prompt_hash" ]]; then
  echo "Denied: issue title or body changed after approval event; re-approval required." >&2
  echo "approved_prompt_hash=${event_prompt_hash} live_prompt_hash=${live_prompt_hash}" >&2
  exit 1
fi

if [[ "${ISSUE_GATE_SKIP_CONSUME:-false}" != "true" ]]; then
  gh issue edit "$issue_number" --repo "$repo" --remove-label "agent:approved" >/dev/null
  gh issue edit "$issue_number" --repo "$repo" --remove-label "agent:repair-requeue" >/dev/null 2>&1 || true
  gh issue edit "$issue_number" --repo "$repo" --remove-label "agent:focus-dequeue" >/dev/null 2>&1 || true
fi

jq -n \
  --arg issue_url "${event_issue_url}" \
  --arg role_label "${role_label}" \
  --arg approved_by "${actor}" \
  --arg approved_permission "${actor_permission}" \
  --arg approval_mode "${approval_mode}" \
  --arg repair_pr_url "${repair_pr_url}" \
  --arg approved_title "${event_issue_title}" \
  --arg approved_body_hash "${event_body_hash}" \
  --arg validated_body_hash "${live_body_hash}" \
  --arg approved_prompt_hash "${event_prompt_hash}" \
  --arg validated_prompt_hash "${live_prompt_hash}" \
  --arg approved_event_updated_at "${event_updated_at}" \
  --arg validated_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --argjson approved_protected_paths "${approved_protected_paths}" \
  '{issue_url:$issue_url, role_label:$role_label, approved_by:$approved_by, approved_permission:$approved_permission, approval_mode:$approval_mode, repair_pr_url:$repair_pr_url, approved_title:$approved_title, approved_body_hash:$approved_body_hash, validated_body_hash:$validated_body_hash, approved_prompt_hash:$approved_prompt_hash, validated_prompt_hash:$validated_prompt_hash, approved_event_updated_at:$approved_event_updated_at, validated_at:$validated_at, approved_protected_paths:$approved_protected_paths}' > "$output_json"

echo "Approval gate passed and approval label consumed for role ${role_label}."
