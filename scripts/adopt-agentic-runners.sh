#!/usr/bin/env bash
set -euo pipefail

source_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
script_version="1"
managed_marker=".github/agentic-runners-managed.json"

command="${1:-}"
shift || true

repo=""
target=""
runner_label="agentic-codex"
runner_backend="codex"
dry_run="false"
force="false"

usage() {
  cat <<USAGE
Usage: scripts/adopt-agentic-runners.sh <command> [options]

Commands:
  preflight   Validate tools and target repo prerequisites
  install     Install/update managed workflows, scripts, and templates
  verify      Verify runner-label wiring, approval gates, and managed files
  upgrade     Alias of install for existing managed repos
  rollback    Restore managed files from backup created by install
  uninstall   Remove managed files created by install
  report      Print current managed status and next steps

Options:
  --target <path>         Target repository path (required except report without target)
  --repo <owner/name>     Target GitHub repository for label/secret/variable preflight
  --runner-label <label>  Runner label to inject (default: agentic-codex)
  --runner-backend <name> Runner backend: codex or claude-code (default: codex)
  --dry-run               Print actions without writing
  --force                 Continue install even when target is not marked managed
USAGE
}

err() { echo "[ERROR] $*" >&2; }
warn() { echo "[WARN] $*" >&2; }
info() { echo "[INFO] $*"; }

parse_args() {
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --target) target="$2"; shift 2 ;;
      --repo) repo="$2"; shift 2 ;;
      --runner-label) runner_label="$2"; shift 2 ;;
      --runner-backend) runner_backend="$2"; shift 2 ;;
      --dry-run) dry_run="true"; shift ;;
      --force) force="true"; shift ;;
      -h|--help) usage; exit 0 ;;
      *) err "Unknown option: $1"; usage; exit 2 ;;
    esac
  done
}

validate_repo_slug() {
  local slug="$1"
  if [[ ! "$slug" =~ ^[^/[:space:]]+/[^/[:space:]]+$ ]]; then
    err "Invalid --repo value '$slug'. Expected owner/repo."
    return 1
  fi
}

resolve_source_repo() {
  local candidate="${AGENTIC_RUNNERS_SOURCE_REPO:-${GITHUB_REPOSITORY:-}}"
  if [[ "$candidate" =~ ^[^/[:space:]]+/[^/[:space:]]+$ ]]; then
    printf '%s' "$candidate"
    return
  fi

  local remote_url
  remote_url="$(git -C "$source_root" remote get-url origin 2>/dev/null || true)"
  candidate="$(printf '%s' "$remote_url" | sed -E 's#\.git$##; s#^[^:]+://([^@]+@)?[^/]+/##; s#^[^@]+@[^:]+:##')"
  if [[ "$candidate" =~ ^[^/[:space:]]+/[^/[:space:]]+$ ]]; then
    printf '%s' "$candidate"
    return
  fi

  printf '%s' "wan0net/yeet2"
}

need_cmd() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || { err "Missing required command: $cmd"; return 1; }
}

validate_runner_label() {
  if [[ ! "$runner_label" =~ ^[A-Za-z0-9][A-Za-z0-9_-]*$ ]]; then
    err "Invalid runner label '$runner_label'."
    return 1
  fi
}

validate_runner_backend() {
  if [[ "$runner_backend" != "codex" && "$runner_backend" != "claude-code" ]]; then
    err "Invalid runner backend '$runner_backend'. Expected codex or claude-code."
    return 1
  fi
}

escape_sed_replacement() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//&/\\&}"
  value="${value//|/\\|}"
  printf '%s' "$value"
}

managed_files() {
  cat <<FILES
.github/ISSUE_TEMPLATE/agent-task.yml
.github/PULL_REQUEST_TEMPLATE.md
.github/workflows/agent-architect.yml
.github/workflows/agent-backlog.yml
.github/workflows/agent-developer.yml
.github/workflows/agent-issue-closer.yml
.github/workflows/agent-pr-ready.yml
.github/workflows/agent-pr-reconciler.yml
.github/workflows/agent-security.yml
.github/workflows/agent-vv.yml
.github/agent-labels.json
scripts/agent-preflight.sh
scripts/agent-runner.sh
scripts/check-protected-paths.sh
scripts/issue-approval-gate.sh
scripts/post-comment-dedup.sh
scripts/pr-issue-link.sh
scripts/pr-reconciler-classify.sh
scripts/pr-reconciler-trigger-gate.sh
scripts/review-gates-ready.sh
scripts/update-review-gate-status.sh
templates/workflows/deploy-production.yml
templates/workflows/staging-deploy.yml
docs/adoption.md
FILES
}

require_target() {
  [ -n "$target" ] || { err "--target is required."; exit 2; }
  [ -d "$target" ] || { err "Target path not found: $target"; exit 2; }
}

backup_path() {
  printf '%s/.agentic-runners-backup' "$target"
}

run_preflight() {
  local failures=0
  need_cmd git || failures=$((failures + 1))
  need_cmd jq || failures=$((failures + 1))
  need_cmd sed || failures=$((failures + 1))

  require_target
  validate_runner_label || failures=$((failures + 1))
  validate_runner_backend || failures=$((failures + 1))

  if [ ! -d "$target/.git" ]; then
    warn "Target does not appear to be a git repository: $target"
  fi

  if [ -n "$repo" ]; then
    validate_repo_slug "$repo" || failures=$((failures + 1))
    if command -v gh >/dev/null 2>&1; then
      if ! gh auth status >/dev/null 2>&1; then
        warn "gh is not authenticated; cannot validate labels/secrets/variables for $repo"
      else
        if ! gh repo view "$repo" >/dev/null 2>&1; then
          warn "Could not access $repo with current gh auth context. Validate repo visibility/permissions and GitHub host login."
        fi

        info "Checking labels in $repo"
        local missing_labels
        missing_labels="$(gh label list --repo "$repo" --json name --jq --argfile defs "$source_root/.github/agent-labels.json" '($defs.labels | map(.name)) as $required | ([.[].name] | .) as $actual | $required - $actual | join(", ")' 2>/dev/null || true)"
        if [ -n "$missing_labels" ]; then
          warn "Missing expected labels: $missing_labels. Run scripts/bootstrap-labels.sh $repo"
        fi

        local has_agent_token
        has_agent_token="$(gh secret list --repo "$repo" --json name --jq 'map(.name) | index("AGENT_GITHUB_TOKEN") != null' 2>/dev/null || true)"
        if [ -z "$has_agent_token" ]; then
          warn "Could not verify AGENT_GITHUB_TOKEN secret; check repo secret permissions."
        elif [ "$has_agent_token" != "true" ]; then
          warn "Repository secret AGENT_GITHUB_TOKEN is missing. Configure it before enabling unattended repair loops and handoffs."
        fi

        local optional_vars missing_vars
        optional_vars='["CODEX_MODEL","AGENT_MODEL_ARCHITECT","AGENT_MODEL_DEVELOPER","AGENT_MODEL_VV","AGENT_MODEL_SECURITY","AGENT_RUNNER_BACKEND","AGENT_MAX_ACTIVE_ISSUES","AGENT_BASE_BRANCH","PRODUCTION_DEPLOY_BRANCH","AGENT_PROTECTED_PATHS"]'
        if ! missing_vars="$(gh variable list --repo "$repo" --json name 2>/dev/null | jq -r --argjson optional "$optional_vars" '$optional - ([.[].name] | .) | join(", ")')"; then
          warn "Could not query repository variables; confirm permissions and set AGENT_MODEL_<ROLE>/CODEX_MODEL/AGENT_BASE_BRANCH/AGENT_PROTECTED_PATHS as needed."
        elif [ -n "$missing_vars" ]; then
          warn "Optional variables not set: $missing_vars"
        fi
      fi
    else
      warn "gh is not installed; skipping GitHub settings preflight for $repo"
    fi
  else
    warn "--repo not provided; skipping GitHub labels/secrets/variables preflight"
  fi

  if [ "$failures" -gt 0 ]; then
    err "Preflight failed with $failures error(s)."
    exit 1
  fi

  info "Preflight completed."
}

copy_file() {
  local rel="$1"
  local src="$source_root/$rel"
  local dst="$target/$rel"
  local dst_dir
  dst_dir="$(dirname "$dst")"

  [ -f "$src" ] || { err "Missing source file: $src"; exit 1; }

  if [ "$dry_run" = "true" ]; then
    info "[dry-run] copy $rel"
    return
  fi

  mkdir -p "$dst_dir"
  if [ -f "$dst" ]; then
    mkdir -p "$(backup_path)/$(dirname "$rel")"
    cp "$dst" "$(backup_path)/$rel"
  fi
  cp "$src" "$dst"
}

write_marker() {
  if [ "$dry_run" = "true" ]; then
    info "[dry-run] write $managed_marker"
    return
  fi

  mkdir -p "$target/.github"
  jq -n \
    --arg version "$script_version" \
    --arg runner_label "$runner_label" \
    --arg runner_backend "$runner_backend" \
    --arg installed_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --arg source_repo "$(resolve_source_repo)" \
    --argjson files "$(managed_files | jq -R . | jq -s .)" \
    '{version:$version, runner_label:$runner_label, runner_backend:$runner_backend, installed_at:$installed_at, source_repo:$source_repo, files:$files}' \
    > "$target/$managed_marker"
}

rewrite_runner_labels() {
  local safe_runner_label
  safe_runner_label="$(escape_sed_replacement "$runner_label")"
  local role_prefix="codex"
  if [ "$runner_backend" = "claude-code" ]; then
    role_prefix="claude"
  fi
  local file
  for file in "$target"/.github/workflows/agent-*.yml; do
    [ -f "$file" ] || continue
    if [ "$dry_run" = "true" ]; then
      info "[dry-run] rewrite backend + runner labels in $(basename "$file")"
    else
      sed -i.bak "s|agentic-codex|${safe_runner_label}|g" "$file"
      sed -i.bak "s|codex-architect|${role_prefix}-architect|g" "$file"
      sed -i.bak "s|codex-backlog|${role_prefix}-backlog|g" "$file"
      sed -i.bak "s|codex-developer|${role_prefix}-developer|g" "$file"
      sed -i.bak "s|codex-vv|${role_prefix}-vv|g" "$file"
      sed -i.bak "s|codex-security|${role_prefix}-security|g" "$file"
      sed -i.bak "s|codex-staging|${role_prefix}-staging|g" "$file"
      sed -i.bak "s|codex-production|${role_prefix}-production|g" "$file"
      rm -f "$file.bak"
    fi
  done
  for file in "$target"/templates/workflows/*.yml; do
    [ -f "$file" ] || continue
    if [ "$dry_run" = "true" ]; then
      info "[dry-run] rewrite backend + runner labels in $(basename "$file")"
    else
      sed -i.bak "s|agentic-codex|${safe_runner_label}|g" "$file"
      sed -i.bak "s|codex-staging|${role_prefix}-staging|g" "$file"
      sed -i.bak "s|codex-production|${role_prefix}-production|g" "$file"
      rm -f "$file.bak"
    fi
  done
}

install_or_upgrade() {
  require_target
  validate_runner_label
  validate_runner_backend

  if [ "$force" != "true" ] && [ -f "$target/$managed_marker" ] && ! jq -e '.version != null' "$target/$managed_marker" >/dev/null 2>&1; then
    err "Existing marker is invalid: $target/$managed_marker"
    exit 1
  fi

  if [ "$dry_run" != "true" ]; then
    rm -rf "$(backup_path)"
    mkdir -p "$(backup_path)"
  fi

  while IFS= read -r rel; do
    [ -n "$rel" ] || continue
    copy_file "$rel"
  done < <(managed_files)

  rewrite_runner_labels
  write_marker

  info "Install/upgrade complete for $target"
  info "Next steps:"
  echo "- Run: scripts/bootstrap-labels.sh ${repo:-owner/repo}"
  echo "- Set repo secret: AGENT_GITHUB_TOKEN (workflow scope only if agent edits workflows)"
  echo "- Set optional vars: AGENT_MODEL_ARCHITECT, AGENT_MODEL_DEVELOPER, AGENT_MODEL_VV, AGENT_MODEL_SECURITY, CODEX_MODEL, AGENT_RUNNER_BACKEND, AGENT_MAX_ACTIVE_ISSUES, AGENT_BASE_BRANCH, PRODUCTION_DEPLOY_BRANCH, AGENT_PROTECTED_PATHS"
  echo "- Enable GitHub Pages (Settings -> Pages -> GitHub Actions) if publishing docs"
}

verify_install() {
  require_target
  local failures=0
  [ -f "$target/$managed_marker" ] || { err "Missing $managed_marker"; failures=$((failures + 1)); }

  while IFS= read -r rel; do
    [ -n "$rel" ] || continue
    if [ ! -f "$target/$rel" ]; then
      err "Missing managed file: $rel"
      failures=$((failures + 1))
    fi
  done < <(managed_files)

  if [ -f "$target/.github/workflows/agent-developer.yml" ]; then
    if ! grep -q "github.event.label.name == 'agent:approved'" "$target/.github/workflows/agent-developer.yml"; then
      err "Developer workflow missing agent:approved gate"
      failures=$((failures + 1))
    fi
    if ! grep -q "contains(github.event.issue.labels.*.name, 'agent:developer')" "$target/.github/workflows/agent-developer.yml"; then
      err "Developer workflow missing agent:developer role gate"
      failures=$((failures + 1))
    fi
  fi

  if grep -R "agentic-codex" "$target/.github/workflows/agent-"*.yml >/dev/null 2>&1; then
    warn "Some workflows still reference agentic-codex; confirm intended runner label wiring."
  fi

  if [ "$failures" -gt 0 ]; then
    err "Verification failed with $failures error(s)."
    exit 1
  fi
  info "Verification passed."
}

rollback_install() {
  require_target
  local backup
  backup="$(backup_path)"
  [ -d "$backup" ] || { err "No backup found at $backup"; exit 1; }

  while IFS= read -r rel; do
    [ -n "$rel" ] || continue
    if [ -f "$backup/$rel" ]; then
      if [ "$dry_run" = "true" ]; then
        info "[dry-run] restore $rel"
      else
        mkdir -p "$target/$(dirname "$rel")"
        cp "$backup/$rel" "$target/$rel"
      fi
    fi
  done < <(managed_files)

  if [ "$dry_run" != "true" ]; then
    rm -f "$target/$managed_marker"
  fi
  info "Rollback complete."
}

uninstall_install() {
  require_target
  while IFS= read -r rel; do
    [ -n "$rel" ] || continue
    if [ "$dry_run" = "true" ]; then
      info "[dry-run] remove $rel"
    else
      rm -f "$target/$rel"
    fi
  done < <(managed_files)

  if [ "$dry_run" != "true" ]; then
    rm -f "$target/$managed_marker"
  fi
  info "Uninstall complete."
}

report_status() {
  require_target
  if [ -f "$target/$managed_marker" ]; then
    info "Managed install detected: $target/$managed_marker"
    cat "$target/$managed_marker"
  else
    warn "No managed install marker found at $target/$managed_marker"
  fi
}

case "$command" in
  preflight|install|verify|upgrade|rollback|uninstall|report) ;;
  ""|-h|--help) usage; exit 0 ;;
  *) err "Unknown command: $command"; usage; exit 2 ;;
esac

parse_args "$@"

case "$command" in
  preflight) run_preflight ;;
  install) install_or_upgrade ;;
  upgrade) install_or_upgrade ;;
  verify) verify_install ;;
  rollback) rollback_install ;;
  uninstall) uninstall_install ;;
  report) report_status ;;
esac
