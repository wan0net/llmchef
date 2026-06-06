# End-User Adoption Guide

Use this single path to adopt the agentic runner pattern in a new or existing repository.

## 1. Preflight

From this repository, run:

```bash
scripts/adopt-agentic-runners.sh preflight \
  --target /path/to/target-repo \
  --repo owner/repo \
  --runner-label target-codex-label --runner-backend codex
```

What this checks:

- local tools (`git`, `jq`, `sed`)
- target path/repository layout
- runner-label format
- best-effort GitHub label/secret/variable access checks when `--repo` is provided

## 2. Install

```bash
scripts/adopt-agentic-runners.sh install \
  --target /path/to/target-repo \
  --repo owner/repo \
  --runner-label target-codex-label --runner-backend codex
```

This managed install copies canonical workflows, templates, support scripts, and label definitions from this repo into the target repo and writes:

- `.github/agentic-runners-managed.json`

Install keeps production protected. It does not auto-enable production deploy paths.

## 3. Configure GitHub

Create labels:

```bash
scripts/bootstrap-labels.sh owner/repo
```

Set required secret:

- `AGENT_GITHUB_TOKEN` (add `workflow` scope only if agents may edit workflow files)

Set optional variables:

- `AGENT_RUNNER_BACKEND` (`codex` or `claude-code`, default `codex`)

- `AGENT_MODEL_ARCHITECT` (optional role override for Architect)
- `AGENT_MODEL_DEVELOPER` (optional role override for Developer)
- `AGENT_MODEL_VV` (optional role override for V&V)
- `AGENT_MODEL_SECURITY` (optional role override for Security)
- `CODEX_MODEL` (optional global fallback when a role override is not set)
- `AGENT_BASE_BRANCH`
- `PRODUCTION_DEPLOY_BRANCH`
- `AGENT_PROTECTED_PATHS`

Public vs private repository notes:

- Public repos: prefer a fine-grained token or GitHub App installation token scoped to this repository only.
- Private repos: ensure token access is explicitly granted to the private target repo and includes pull request/issue/workflow mutation permissions required by your enabled workflows.
- If you disable automatic repair loops, you can omit `AGENT_GITHUB_TOKEN`, but maintainers must manually reapply approval labels for handoffs and repair cycles.
- Keep token scope minimal and avoid broad organization-wide tokens unless policy requires them.

Manual settings:

- Enable GitHub Pages if you want docs publishing.
- Keep branch protection/rulesets and CODEOWNERS on automation/protected paths.

Recommended permission baseline for `AGENT_GITHUB_TOKEN`:

- Repository permissions: Issues `Read and write`, Pull requests `Read and write`, Contents `Read and write`, Metadata `Read`.
- Add workflow mutation capability only when agents are allowed to modify workflow files.
- Rotate token regularly and keep it scoped to one repository whenever possible.

## 4. Verify and Smoke-Test

Run managed verification:

```bash
scripts/adopt-agentic-runners.sh verify --target /path/to/target-repo
```

Recommended smoke test matrix:

1. Open an issue with no labels; confirm no agent workflow starts.
2. Add `agent:approved` plus `agent:architect`; confirm Architect comments and handoff behavior.
3. Add `agent:approved` plus `agent:developer`; confirm draft PR creation.
4. Confirm V&V and Security workflows run from PR labels/events.
5. Trigger `/agent backlog`, `/agent review-close`, `/agent close-if-done`, and `/agent reconcile` from a trusted actor.

## 5. Upgrade Existing Install

```bash
scripts/adopt-agentic-runners.sh upgrade \
  --target /path/to/target-repo \
  --repo owner/repo \
  --runner-label target-codex-label --runner-backend codex
```

Then re-run `verify`.

## 6. Rollback and Uninstall

Rollback to files backed up by the last install/upgrade:

```bash
scripts/adopt-agentic-runners.sh rollback --target /path/to/target-repo
```

Remove managed artifacts:

```bash
scripts/adopt-agentic-runners.sh uninstall --target /path/to/target-repo
```

Use report mode to inspect install metadata:

```bash
scripts/adopt-agentic-runners.sh report --target /path/to/target-repo
```
