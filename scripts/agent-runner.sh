#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/agent-runner.sh exec --backend <codex|claude-code> --model <name> --cwd <path> [--output-schema <path>] --output-last-message <path> --prompt-file <path>
USAGE
}

command_name="${1:-}"
shift || true

backend="codex"
model=""
cwd=""
output_schema=""
output_last_message=""
prompt_file=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --backend) backend="$2"; shift 2 ;;
    --model) model="$2"; shift 2 ;;
    --cwd) cwd="$2"; shift 2 ;;
    --output-schema) output_schema="$2"; shift 2 ;;
    --output-last-message) output_last_message="$2"; shift 2 ;;
    --prompt-file) prompt_file="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

[ "$command_name" = "exec" ] || { usage >&2; exit 2; }
[ -n "$model" ] || { echo "Missing --model" >&2; exit 2; }
[ -n "$cwd" ] || { echo "Missing --cwd" >&2; exit 2; }
[ -n "$output_last_message" ] || { echo "Missing --output-last-message" >&2; exit 2; }
[ -n "$prompt_file" ] || { echo "Missing --prompt-file" >&2; exit 2; }
[ -f "$prompt_file" ] || { echo "Prompt file not found: $prompt_file" >&2; exit 2; }

if [ "$backend" = "codex" ]; then
  cmd=(codex exec --model "$model" --dangerously-bypass-approvals-and-sandbox --cd "$cwd")
  if [ -n "$output_schema" ]; then
    cmd+=(--output-schema "$output_schema")
  fi
  cmd+=(--output-last-message "$output_last_message")
  "${cmd[@]}" - < "$prompt_file"
  exit $?
fi

if [ "$backend" = "claude-code" ]; then
  tmp_json="$(mktemp)"
  trap 'rm -f "$tmp_json"' EXIT
  schema_json=""
  if [ -n "$output_schema" ]; then
    [ -f "$output_schema" ] || { echo "Output schema file not found: $output_schema" >&2; exit 2; }
    schema_json="$(cat "$output_schema")"
  fi
  (
    cd "$cwd"
    cmd=(claude -p --model "$model" --output-format json)
    if [ -n "$schema_json" ]; then
      cmd+=(--json-schema "$schema_json")
    fi
    # Stream prompt via stdin to avoid argv-size limits and prompt leakage in process args.
    "${cmd[@]}" < "$prompt_file" > "$tmp_json"
  )
  jq -r '.result // .output // .text // .content[0].text // empty' "$tmp_json" > "$output_last_message"
  if [ -n "$output_schema" ] && ! jq -e . "$output_last_message" >/dev/null; then
    echo "Claude output is not valid JSON while --output-schema was requested." >&2
    exit 1
  fi
  exit 0
fi

echo "Unsupported backend: $backend" >&2
exit 2
