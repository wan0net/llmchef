# GitHub Issue -> Hermes Kanban Sync

LLMChef uses two explicit one-way sync steps so GitHub stays the durable ticket source of truth while Hermes Kanban handles execution flow.

## Source-of-truth split

- GitHub Issues own the canonical ticket title, labels, and spec body.
- `docs/kanban-roadmap.md` is the ordered roadmap view and issue index.
- Hermes Kanban is the runnable execution queue for issues that are ready now.

The syncs are intentionally one-way and conservative:

1. `npm run roadmap:sync`
   - Reads `docs/kanban-roadmap.md`
   - Reconciles linked GitHub issue title, lane labels, priority labels, and open/closed state
   - Does not create runnable Hermes work

2. `npm run kanban:sync`
   - Reads GitHub Issues from `wan0net/llmchef`
   - Only turns open issues with the `ready` label into runnable Hermes Kanban tasks
   - Leaves open issues without `ready` in GitHub/backlog
   - Blocks mapped tasks that lose `ready` and archives mapped tasks whose source issue is closed

## Commands

Dry run:

```bash
npm run kanban:sync
```

Apply:

```bash
npm run kanban:sync:write
```

Useful scoped smoke test against a disposable board:

```bash
npm run kanban:sync -- --board llmchef-gh-sync-smoke --issue 14 --issue 15 --issue 16
npm run kanban:sync:write -- --board llmchef-gh-sync-smoke --issue 14 --issue 15 --issue 16
```

Offline smoke test or CI fixture mode:

```bash
npm run kanban:sync -- --board llmchef-gh-sync-smoke --issues-file /tmp/github-issues.json
npm run kanban:sync:write -- --board llmchef-gh-sync-smoke --issues-file /tmp/github-issues.json
```

If you need a fully isolated disposable database for local smoke tests, point the script at an explicit sqlite path instead of a named board:

```bash
npm run kanban:sync -- --issues-file /tmp/github-issues.json --db-path /tmp/llmchef-kanban-smoke.db
```

## Default task mapping

- Default assignee: `ford-prefect`
- Default workspace: `scratch`
- Stable task correlation key: `github-issue:<owner>/<repo>#<number>`
- Task title format: `[GH-<number>] <issue title>`

Override the intake target when needed:

```bash
npm run kanban:sync:write -- --assignee trillian --workspace worktree
```

The bare `worktree` mode maps synced tasks to the current checkout root (the repo that contains this script). To target a different existing checkout or worktree path explicitly:

```bash
npm run kanban:sync:write -- --assignee trillian --workspace worktree:/absolute/path/to/repo
```

For a shared persistent directory:

```bash
npm run kanban:sync:write -- --workspace dir:/absolute/path
```

## Ready gating behavior

- `open` + `ready`
  - create the mapped Kanban task if it does not exist
  - refresh task title/body/priority from GitHub on rerun
  - reactivate a blocked mapped task if the issue becomes ready again

- `open` without `ready`
  - do not create a runnable task
  - if a mapped task already exists, park it as blocked with a reason

- `closed`
  - do not create a runnable task
  - if a mapped task already exists, archive it so it no longer looks like fresh runnable work

## Notes

- The script uses the public GitHub REST API, so it works without `gh auth login` for public repos. Set `GITHUB_TOKEN` or `GH_TOKEN` if you want higher API rate limits.
- Kanban board selection follows Hermes defaults unless `--board` is passed.
- The script updates mapped Kanban task content from GitHub, but it never writes back into GitHub issue bodies or labels.
