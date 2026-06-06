#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 [--comment-file <path>]" >&2
  exit 2
}

comment_file=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --comment-file)
      [[ $# -ge 2 ]] || usage
      comment_file="$2"
      shift 2
      ;;
    *)
      usage
      ;;
  esac
done

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "This script must run inside a git worktree." >&2
  exit 2
fi

protected_paths="${AGENT_PROTECTED_PATHS:-}"
if [[ -z "$protected_paths" ]]; then
  if [[ -n "$comment_file" ]]; then
    {
      printf '## Developer Agent stopped\n\n'
      printf '`AGENT_PROTECTED_PATHS` is not configured. Set protected paths before running Developer Agent.\n'
    } > "$comment_file"
  fi
  echo "AGENT_PROTECTED_PATHS is required and must list one or more protected pathspecs." >&2
  exit 2
fi

status_file="$(mktemp)"
trap 'rm -f "$status_file"' EXIT

git status --porcelain=v1 --untracked-files=all > "$status_file"

blocked=0
: > /tmp/protected-paths.txt
for path in $protected_paths; do
  if git status --porcelain=v1 --untracked-files=all -- "$path" | grep -q .; then
    printf -- '- `%s`\n' "$path" >> /tmp/protected-paths.txt
    blocked=1
  fi
done

if [[ "$blocked" == "0" ]]; then
  exit 0
fi

if [[ -n "$comment_file" ]]; then
  {
    printf '## Developer Agent stopped\n\n'
    printf 'The agent attempted to modify protected paths:\n\n'
    cat /tmp/protected-paths.txt
    printf '\nThese paths are blocked by `AGENT_PROTECTED_PATHS`; the workflow will apply `agent:human-only` until a maintainer deliberately approves the protected-path override.\n'
  } > "$comment_file"
fi

exit 1
