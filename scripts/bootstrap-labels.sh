#!/usr/bin/env bash
set -euo pipefail

repo="${1:?usage: bootstrap-labels.sh owner/repo}"
spec_file="${2:-.github/agent-labels.json}"

if [ ! -f "$spec_file" ]; then
  echo "label spec file not found: $spec_file" >&2
  exit 1
fi

length_errors="$(
  jq -r '
    .labels[]
    | .name as $name
    | (.description | length) as $length
    | select($length > 100)
    | "label description too long: name=\"" + $name + "\" length=" + ($length|tostring) + " max=100"
  ' "$spec_file"
)"
if [ -n "$length_errors" ]; then
  printf '%s\n' "$length_errors" >&2
  exit 1
fi

jq -r '.labels[] | @base64' "$spec_file" | while IFS= read -r encoded; do
  label="$(printf '%s' "$encoded" | base64 --decode)"
  name="$(jq -r '.name' <<<"$label")"
  color="$(jq -r '.color' <<<"$label")"
  description="$(jq -r '.description' <<<"$label")"
  gh label create "$name" --repo "$repo" --color "$color" --description "$description" --force
done
