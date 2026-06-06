#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "usage: $0 --phase <branch-prep|push-retry> --model <model> [--base-branch <name>] [--issue-branch <name>] [--max-attempts <n>]" >&2
}

phase=""
model=""
base_branch=""
issue_branch=""
max_attempts=3

while [[ $# -gt 0 ]]; do
  case "$1" in
    --phase)
      phase="${2:-}"
      shift 2
      ;;
    --model)
      model="${2:-}"
      shift 2
      ;;
    --base-branch)
      base_branch="${2:-}"
      shift 2
      ;;
    --issue-branch)
      issue_branch="${2:-}"
      shift 2
      ;;
    --max-attempts)
      max_attempts="${2:-}"
      shift 2
      ;;
    *)
      usage
      exit 2
      ;;
  esac
done

if [[ -z "$phase" || -z "$model" ]]; then
  usage
  exit 2
fi

if ! [[ "$max_attempts" =~ ^[0-9]+$ ]] || [[ "$max_attempts" -lt 1 ]]; then
  echo "max-attempts must be a positive integer" >&2
  exit 2
fi

rebase_in_progress() {
  local merge_dir apply_dir
  merge_dir="$(git rev-parse --git-path rebase-merge)"
  apply_dir="$(git rev-parse --git-path rebase-apply)"
  [[ -d "$merge_dir" || -d "$apply_dir" ]]
}

print_file_if_nonempty() {
  local file="$1"
  if [[ -s "$file" ]]; then
    sed 's/^/  /' "$file" >&2
  fi
}

is_empty_patch_failure() {
  local stderr_file="$1"
  grep -Eiq "previous cherry-pick is now empty|No changes - did you forget to use 'git add'|patch is empty|nothing to commit, working tree clean" "$stderr_file"
}

has_conflict_markers() {
  local file
  while IFS= read -r file; do
    [[ -n "$file" ]] || continue
    if grep -qE '^(<<<<<<<|=======|>>>>>>>)' "$file"; then
      return 0
    fi
  done
  return 1
}

continue_rebase_or_exit() {
  local label="$1"
  local stderr_file skip_stderr_file
  stderr_file="$tmp_dir/rebase-continue-${label}-${attempt}.stderr"

  if GIT_EDITOR=true git -c core.commentChar=';' rebase --continue >/dev/null 2>"$stderr_file"; then
    return 0
  fi

  conflict_files="$(git diff --name-only --diff-filter=U || true)"
  if [[ -n "$conflict_files" ]]; then
    return 1
  fi

  if is_empty_patch_failure "$stderr_file"; then
    if ! git diff --quiet || ! git diff --cached --quiet; then
      echo "rebase continue reported an empty patch/no changes, but local changes remain; refusing to skip" >&2
      print_file_if_nonempty "$stderr_file"
      exit 1
    fi

    skip_stderr_file="$tmp_dir/rebase-skip-${label}-${attempt}.stderr"
    echo "rebase continue reported an empty patch/no changes; skipping current patch" >&2
    if git rebase --skip >/dev/null 2>"$skip_stderr_file"; then
      return 0
    fi

    conflict_files="$(git diff --name-only --diff-filter=U || true)"
    if [[ -n "$conflict_files" ]]; then
      return 1
    fi

    echo "git rebase --skip failed after empty-patch detection:" >&2
    print_file_if_nonempty "$skip_stderr_file"
    exit 1
  fi

  echo "rebase continue failed without unmerged files:" >&2
  print_file_if_nonempty "$stderr_file"
  exit 1
}

resolve_prompt() {
  local conflict_file_list="$1"
  local prompt_file="$2"
  cat > "$prompt_file" <<PROMPT
You are resolving a git rebase conflict for phase "$phase".

Repository state:
- Base branch: ${base_branch:-unknown}
- Issue branch: ${issue_branch:-unknown}

Conflicted files:
$conflict_file_list

Hard rules:
- Resolve only git conflict markers in the listed files.
- Keep behavior from both sides unless one side is clearly obsolete.
- Preserve security checks, approvals, and workflow guardrails.
- Do not edit unrelated files.
- Do not run git commands.
- Do not add placeholders or TODOs.
PROMPT
}

tmp_dir="$(mktemp -d "/tmp/rebase-autoresolve-${phase}-XXXXXX")"
chmod 700 "$tmp_dir"
trap 'rm -rf "$tmp_dir"' EXIT

attempt=1
while rebase_in_progress; do
  conflict_files="$(git diff --name-only --diff-filter=U || true)"
  if [[ -z "$conflict_files" ]]; then
    if continue_rebase_or_exit "pre-resolve"; then
      continue
    fi
  fi

  if [[ "$attempt" -gt "$max_attempts" ]]; then
    echo "automatic rebase conflict resolution exceeded attempts ($max_attempts)" >&2
    exit 1
  fi

  printf '%s\n' "$conflict_files" > "$tmp_dir/conflict-files.txt"
  prompt_file="$tmp_dir/rebase-conflict-prompt-${attempt}.md"
  resolve_prompt "$(sed 's/^/- /' "$tmp_dir/conflict-files.txt")" "$prompt_file"

  if ! codex exec --model "$model" --dangerously-bypass-approvals-and-sandbox --cd "$PWD" --output-last-message "$tmp_dir/rebase-resolve-summary-${attempt}.md" - < "$prompt_file"; then
    echo "codex conflict resolver failed on attempt $attempt" >&2
    exit 1
  fi

  remaining_conflicts="$(git diff --name-only --diff-filter=U || true)"
  if [[ -n "$remaining_conflicts" ]]; then
    if has_conflict_markers <<<"$remaining_conflicts"; then
      attempt=$((attempt + 1))
      continue
    fi

    printf '%s\n' "$remaining_conflicts" | while IFS= read -r file; do
      [[ -n "$file" ]] || continue
      git add -- "$file"
    done
    continue_rebase_or_exit "post-marker-free-resolve" || true
    attempt=$((attempt + 1))
    continue
  fi

  git add -A
  continue_rebase_or_exit "post-resolve" || true
  attempt=$((attempt + 1))
done

echo "automatic rebase conflict resolution succeeded"
