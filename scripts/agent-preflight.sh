#!/usr/bin/env bash
set -euo pipefail

workflow=""
required_runner_label=""
require_agent_token="false"
runner_backend="codex"
require_backend_cli="false"
require_package_manager="false"
require_staging_script="false"
require_production_script="false"

usage() {
  cat <<'USAGE'
Usage: scripts/agent-preflight.sh [options]
  --workflow <name>
  --required-runner-label <label>
  --require-agent-token <true|false>
  --runner-backend <codex|claude-code>
  --require-backend-cli <true|false>
  --require-package-manager <true|false>
  --require-staging-script <true|false>
  --require-production-script <true|false>
USAGE
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --workflow)
      workflow="$2"
      shift 2
      ;;
    --required-runner-label)
      required_runner_label="$2"
      shift 2
      ;;
    --require-agent-token)
      require_agent_token="$2"
      shift 2
      ;;
    --runner-backend)
      runner_backend="$2"
      shift 2
      ;;
    --require-backend-cli)
      require_backend_cli="$2"
      shift 2
      ;;
    --require-package-manager)
      require_package_manager="$2"
      shift 2
      ;;
    --require-staging-script)
      require_staging_script="$2"
      shift 2
      ;;
    --require-production-script)
      require_production_script="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

failures=0
warnings=0

need_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "[ERROR] Missing required command: $cmd"
    failures=$((failures + 1))
  fi
}

warn() {
  echo "[WARN] $1"
  warnings=$((warnings + 1))
}

echo "Preflight workflow: ${workflow:-unknown}"

need_cmd jq
need_cmd gh
need_cmd git

if [ "$runner_backend" != "codex" ] && [ "$runner_backend" != "claude-code" ]; then
  echo "[ERROR] Unsupported runner backend: $runner_backend (expected codex or claude-code)."
  failures=$((failures + 1))
fi

if [ "$require_backend_cli" = "true" ]; then
  if [ "$runner_backend" = "codex" ]; then
    need_cmd codex
  else
    need_cmd claude
  fi
fi

if [ "$require_package_manager" = "true" ]; then
  if ! command -v npm >/dev/null 2>&1 && ! command -v pnpm >/dev/null 2>&1 && ! command -v yarn >/dev/null 2>&1 && ! command -v bun >/dev/null 2>&1; then
    echo "[ERROR] No supported package manager found (npm, pnpm, yarn, or bun)."
    failures=$((failures + 1))
  fi
fi

if [ "$require_agent_token" = "true" ] && [ "${HAS_AGENT_GITHUB_TOKEN:-false}" != "true" ]; then
  echo "[ERROR] Missing required secret AGENT_GITHUB_TOKEN."
  echo "        Configure repository secret AGENT_GITHUB_TOKEN with a PAT or GitHub App token that can trigger follow-on workflows."
  failures=$((failures + 1))
fi

if [ -z "${CODEX_MODEL:-}" ]; then
  warn "CODEX_MODEL is empty; workflow should set fallback (for example AGENT_MODEL_<ROLE> or CODEX_MODEL, then gpt-5.4)."
elif [ "${CODEX_MODEL}" = "gpt-5.4" ]; then
  warn "Using default model fallback (${CODEX_MODEL}). Set AGENT_MODEL_<ROLE> for role-specific selection or CODEX_MODEL for a global override."
fi

if [ -n "$required_runner_label" ]; then
  if [ "${HAS_AGENT_GITHUB_TOKEN:-false}" = "true" ]; then
    if ! gh api "repos/${GITHUB_REPOSITORY}/actions/runners" >/tmp/agent-preflight-runners.json 2>/dev/null; then
      warn "Could not query self-hosted runner labels via API with current token scope. Verify runner labels manually: expected '${required_runner_label}'."
    else
      if ! jq -e --arg label "$required_runner_label" '.runners[]? | select((.labels // []) | map(.name) | index($label))' /tmp/agent-preflight-runners.json >/dev/null; then
        echo "[ERROR] No registered self-hosted runner was found with required label '${required_runner_label}'."
        echo "        Register/update runner labels before rerunning this workflow."
        failures=$((failures + 1))
      fi
    fi
  else
    warn "Runner-label API check skipped because AGENT_GITHUB_TOKEN is not configured. Expected label: '${required_runner_label}'."
  fi
fi

if [ "$require_staging_script" = "true" ] && [ ! -x scripts/staging-deploy.sh ]; then
  echo "[ERROR] Missing executable scripts/staging-deploy.sh"
  echo "        Add this script in the target repository or remove deploy:staging label automation."
  failures=$((failures + 1))
fi

if [ "$require_production_script" = "true" ] && [ ! -x scripts/production-deploy.sh ]; then
  echo "[ERROR] Missing executable scripts/production-deploy.sh"
  echo "        Add this script in the target repository before enabling production deploy template."
  failures=$((failures + 1))
fi

if [ "$failures" -gt 0 ]; then
  echo "Preflight failed with ${failures} error(s) and ${warnings} warning(s)."
  exit 1
fi

echo "Preflight passed with ${warnings} warning(s)."
