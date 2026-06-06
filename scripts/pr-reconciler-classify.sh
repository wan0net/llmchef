#!/usr/bin/env bash
set -euo pipefail

input_file="${1:?usage: pr-reconciler-classify.sh <input-json>}"

jq -e '.' "$input_file" >/dev/null

state=""
summary=""
next_action=""
apply_human_only="false"
needs_issue_repair="false"

is_draft="$(jq -r '.is_draft // false' "$input_file")"
merge_state="$(jq -r '.merge_state // "UNKNOWN"' "$input_file")"
needs_branch_update="$(jq -r '.needs_branch_update // false' "$input_file")"
can_update_branch="$(jq -r '.can_update_branch // false' "$input_file")"
branch_update_failed="$(jq -r '.branch_update_failed // false' "$input_file")"
failing_checks="$(jq -r '.failing_checks // 0' "$input_file")"
pending_checks="$(jq -r '.pending_checks // 0' "$input_file")"
review_decision="$(jq -r '.review_decision // "REVIEW_REQUIRED"' "$input_file")"
all_commits_on_main="$(jq -r '.all_commits_on_main // false' "$input_file")"
linked_issue_count="$(jq -r '.linked_issue_count // 0' "$input_file")"
linked_open_issue_count="$(jq -r '.linked_open_issue_count // 0' "$input_file")"

if [[ "$linked_issue_count" -eq 0 || "$linked_open_issue_count" -eq 0 ]]; then
  state="stale_blocked"
  summary="PR has no open governing issue for agent repair."
  apply_human_only="true"
  next_action="Human should provide or reopen a governing issue so agent work has an explicit scope."
elif [[ "$all_commits_on_main" == "true" ]]; then
  state="superseded"
  summary="All commits from this PR are already reachable from the default branch."
  next_action="Recommend closing this PR and any linked issue after human confirmation."
elif [[ "$is_draft" == "false" && "$merge_state" == "CLEAN" && "$failing_checks" -eq 0 && "$pending_checks" -eq 0 && "$review_decision" == "APPROVED" ]]; then
  state="ready_decision_packet"
  summary="PR is mergeable, checks are passing, and review decision is approved."
  next_action="Prepare concise decision packet for final human merge approval."
elif [[ "$branch_update_failed" == "true" || "$merge_state" == "DIRTY" ]]; then
  state="needs_agent_repair"
  needs_issue_repair="true"
  summary="PR branch is conflicting or could not be safely refreshed from base branch."
  if [[ "$can_update_branch" != "true" ]]; then
    apply_human_only="true"
    next_action="Human maintainer must refresh or resolve conflicts because automation lacks permission."
  else
    next_action="Open or update a repair issue with explicit branch refresh and conflict resolution steps."
  fi
elif [[ "$needs_branch_update" == "true" ]]; then
  state="needs_agent_repair"
  needs_issue_repair="true"
  summary="PR branch is behind base branch and needs refresh before checks are current."
  next_action="Open or update a repair issue to rebase/merge from base and rerun checks."
elif [[ "$failing_checks" -gt 0 || "$pending_checks" -gt 0 || "$is_draft" == "true" || "$review_decision" == "CHANGES_REQUESTED" || "$review_decision" == "REVIEW_REQUIRED" ]]; then
  state="needs_agent_repair"
  needs_issue_repair="true"
  summary="PR is not currently merge-ready due to draft status, reviews, or check status."
  next_action="Open or update a repair issue with concrete implementation or review tasks."
else
  state="stale_blocked"
  summary="PR requires a non-standard decision path."
  next_action="Comment with the specific blocker and keep automation active for follow-up."
fi

jq -n \
  --arg state "$state" \
  --arg summary "$summary" \
  --arg next_action "$next_action" \
  --argjson apply_human_only "$apply_human_only" \
  --argjson needs_issue_repair "$needs_issue_repair" \
  '{state:$state, summary:$summary, next_action:$next_action, apply_human_only:$apply_human_only, needs_issue_repair:$needs_issue_repair}'
