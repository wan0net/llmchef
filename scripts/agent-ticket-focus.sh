#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "usage: $0 acquire ISSUE_NUMBER ROLE_LABEL | release ISSUE_NUMBER [reason]" >&2
}

repo="${GITHUB_REPOSITORY:-}"
if [[ -z "$repo" ]]; then
  echo "GITHUB_REPOSITORY is required" >&2
  exit 2
fi
focus_settle_seconds="${AGENT_FOCUS_SETTLE_SECONDS:-2}"
max_active_issues="${MAX_ACTIVE_ISSUES:-1}"
if ! [[ "$max_active_issues" =~ ^[0-9]+$ ]] || [[ "$max_active_issues" -lt 1 ]]; then
  echo "MAX_ACTIVE_ISSUES must be an integer >= 1 (got: $max_active_issues)" >&2
  exit 2
fi

command="${1:-}"
issue_number="${2:-}"
role_label="${3:-}"
if [[ -z "$command" || -z "$issue_number" ]]; then
  usage
  exit 2
fi

ensure_labels() {
  gh label create "agent:active" --repo "$repo" --color "0052CC" --description "Runner focus is currently reserved for this issue" --force >/dev/null 2>&1 || true
  gh label create "agent:queued" --repo "$repo" --color "C5DEF5" --description "Approved agent work deferred until active issue releases" --force >/dev/null 2>&1 || true
  gh label create "agent:focus-dequeue" --repo "$repo" --color "BFDADC" --description "Transient marker for safe queued issue reactivation" --force >/dev/null 2>&1 || true
}

label_names() {
  jq -r '[.labels[].name] | @json'
}

prompt_hash_for_issue_json() {
  jq -c '{title:(.title // ""), body:(.body // "")}' | sha256sum | awk '{print $1}'
}

has_label() {
  local labels_json="$1"
  local label="$2"
  jq -e --arg label "$label" 'index($label) != null' <<<"$labels_json" >/dev/null
}

active_issues() {
  gh issue list --repo "$repo" --state open --label "agent:active" --limit 100 --json number,title,labels,updatedAt,url |
    jq -c '
      [.[] | select([.labels[].name] | index("agent:human-only") | not)]
      | sort_by(.updatedAt, .number)
    '
}

active_other_issue() {
  active_issues |
    jq -c --arg issue "$issue_number" --argjson max "$max_active_issues" '
      [.[] | select((.number | tostring) != $issue) | select([.labels[].name] | index("agent:human-only") | not)] as $others
      | if ($others | length) >= $max then
          ($others | .[0] // empty)
        else
          empty
        end
    '
}

queue_current_issue_behind() {
  local active_json="$1"
  local active_number active_url prompt_hash
  active_number="$(jq -r '.number' <<<"$active_json")"
  active_url="$(jq -r '.url' <<<"$active_json")"
  prompt_hash="$(prompt_hash_for_issue_json <<<"$issue_json")"
  gh issue edit "$issue_number" --repo "$repo" --add-label "agent:queued" >/dev/null
  gh issue edit "$issue_number" --repo "$repo" --remove-label "agent:approved" >/dev/null 2>&1 || true
  {
    printf '## Agent Focus Queue\n\n'
    printf 'This approved issue is queued because issue #%s currently owns runner focus.\n\n' "$active_number"
    printf '<!-- agent-focus-queued-prompt-hash: %s -->\n\n' "$prompt_hash"
    printf '**Active issue:** %s\n\n' "$active_url"
    printf '**Next step:** Automation will reapply `agent:approved` when the active issue is ready for human review or becomes blocked.\n'
  } > /tmp/agent-focus-queued.md
  gh issue comment "$issue_number" --repo "$repo" --body-file /tmp/agent-focus-queued.md
  rm -f /tmp/agent-focus-queued.md
  echo "Issue #${issue_number} queued behind active issue #${active_number}."
}

dequeue_next_issue() {
  local next_issue
  next_issue="$(
    gh issue list --repo "$repo" --state open --label "agent:queued" --limit 100 --json number,title,labels,updatedAt,url |
      jq -c '
        [.[] |
          select([.labels[].name] | index("agent:human-only") | not) |
          select([.labels[].name] | index("agent:active") | not) |
          select([.labels[].name] | (index("agent:developer") or index("agent:architect")))
          | . + {
              priority_rank: (
                [
                  .labels[].name
                  | (try (capture("^P(?<rank>[1-5])$").rank | tonumber) catch empty)
                ]
                | min?
              )
            }
        ] as $candidates
        | if any($candidates[]; .priority_rank != null) then
            ($candidates | sort_by((.priority_rank // 99), .updatedAt, .number) | .[0])
          else
            ($candidates | sort_by(.updatedAt, .number) | .[0])
          end
        | . // empty
      '
  )"
  if [[ -z "$next_issue" ]]; then
    echo "No queued agent issues to release."
    return 1
  fi

  local next_number next_url
  next_number="$(jq -r '.number' <<<"$next_issue")"
  next_url="$(jq -r '.url' <<<"$next_issue")"
  gh issue edit "$next_number" --repo "$repo" --add-label "agent:focus-dequeue" >/dev/null
  gh issue edit "$next_number" --repo "$repo" --remove-label "agent:approved" >/dev/null 2>&1 || true
  gh issue edit "$next_number" --repo "$repo" --add-label "agent:approved" >/dev/null
  echo "Released queued issue #${next_number}: ${next_url}"
}

dequeue_to_capacity() {
  local active_count slots i
  active_count="$(jq 'length' <<<"$(active_issues)")"
  slots=$((max_active_issues - active_count))
  if [[ "$slots" -lt 1 ]]; then
    return 0
  fi
  for ((i = 0; i < slots; i++)); do
    if ! dequeue_next_issue; then
      break
    fi
  done
}

ensure_labels

case "$command" in
  acquire)
    if [[ "$role_label" != "agent:developer" && "$role_label" != "agent:architect" ]]; then
      echo "ROLE_LABEL must be agent:developer or agent:architect" >&2
      exit 2
    fi

    issue_json="$(gh issue view "$issue_number" --repo "$repo" --json number,title,body,state,labels,url,updatedAt)"
    issue_state="$(jq -r '.state' <<<"$issue_json")"
    labels_json="$(label_names <<<"$issue_json")"
    if [[ "$issue_state" != "OPEN" ]]; then
      echo "Denied: issue #${issue_number} is not open." >&2
      exit 1
    fi
    if has_label "$labels_json" "agent:human-only"; then
      echo "Issue #${issue_number} is human-only; no runner focus acquired."
      exit 1
    fi
    if has_label "$labels_json" "agent:active"; then
      gh issue edit "$issue_number" --repo "$repo" --remove-label "agent:queued" >/dev/null 2>&1 || true
      echo "Issue #${issue_number} already owns runner focus."
      exit 0
    fi

    active_json="$(active_other_issue)"
    if [[ -n "$active_json" ]]; then
      queue_current_issue_behind "$active_json"
      exit 78
    fi

    gh issue edit "$issue_number" --repo "$repo" --remove-label "agent:queued" >/dev/null 2>&1 || true
    gh issue edit "$issue_number" --repo "$repo" --add-label "agent:active" >/dev/null
    sleep "$focus_settle_seconds"
    active_set_json="$(active_issues)"
    active_count="$(jq 'length' <<<"$active_set_json")"
    current_is_owner="$(jq -r --arg issue "$issue_number" --argjson max "$max_active_issues" '
      ([.[0:$max][]?.number | tostring] | index($issue)) != null
    ' <<<"$active_set_json")"
    if [[ "$active_count" -gt "$max_active_issues" && "$current_is_owner" != "true" ]]; then
      active_json="$(jq -c '.[0]' <<<"$active_set_json")"
      gh issue edit "$issue_number" --repo "$repo" --remove-label "agent:active" >/dev/null 2>&1 || true
      queue_current_issue_behind "$active_json"
      exit 78
    fi
    echo "Issue #${issue_number} acquired runner focus."
    ;;

  release)
    reason="${role_label:-runner work completed or blocked}"
    issue_json="$(gh issue view "$issue_number" --repo "$repo" --json labels,state)"
    labels_json="$(label_names <<<"$issue_json")"
    had_active="false"
    if has_label "$labels_json" "agent:active"; then
      had_active="true"
    fi
    gh issue edit "$issue_number" --repo "$repo" --remove-label "agent:active" >/dev/null 2>&1 || true
    gh issue edit "$issue_number" --repo "$repo" --remove-label "agent:focus-dequeue" >/dev/null 2>&1 || true
    gh issue comment "$issue_number" --repo "$repo" --body "Agent runner focus released: ${reason}" >/dev/null 2>&1 || true
    if [[ "$had_active" == "true" ]]; then
      dequeue_to_capacity
    else
      echo "Issue #${issue_number} did not own runner focus; no queued issue released."
    fi
    ;;

  *)
    usage
    exit 2
    ;;
esac
