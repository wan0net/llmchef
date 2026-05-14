#!/usr/bin/env python3
import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from hermes_cli import kanban_db


PRIORITY_MAP = {
    "priority:P0": 400,
    "priority:P1": 300,
    "priority:P2": 200,
    "priority:P3": 100,
    "priority:P4": 0,
}

DEFAULT_ASSIGNEE = "ford-prefect"
DEFAULT_CREATED_BY = "github-sync"
GITHUB_API_BASE = "https://api.github.com"
READY_LABEL = "ready"
PROJECT_ROOT = Path(__file__).resolve().parents[1]


@dataclass
class Issue:
    number: int
    title: str
    body: str
    state: str
    url: str
    labels: list[str]

    @property
    def is_ready(self) -> bool:
        return READY_LABEL in self.labels

    @property
    def is_open(self) -> bool:
        return self.state.lower() == "open"


@dataclass
class TaskSpec:
    title: str
    body: str
    assignee: str
    priority: int
    workspace_kind: str
    workspace_path: str | None
    idempotency_key: str


TASK_UPDATE_SQL = {
    "title": "UPDATE tasks SET title = ? WHERE id = ?",
    "body": "UPDATE tasks SET body = ? WHERE id = ?",
    "priority": "UPDATE tasks SET priority = ? WHERE id = ?",
    "assignee": "UPDATE tasks SET assignee = ? WHERE id = ?",
    "workspace_kind": "UPDATE tasks SET workspace_kind = ? WHERE id = ?",
    "workspace_path": "UPDATE tasks SET workspace_path = ? WHERE id = ?",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sync ready GitHub issues into Hermes Kanban tasks. Dry-run by default."
    )
    parser.add_argument(
        "--write",
        action="store_true",
        help="Apply changes. Without this flag the script only prints the planned actions.",
    )
    parser.add_argument(
        "--repo",
        default=default_repo(),
        help="GitHub repo in owner/name form. Defaults to package.json repository.",
    )
    parser.add_argument(
        "--board",
        default=None,
        help="Hermes Kanban board slug. Defaults to the current Hermes board.",
    )
    parser.add_argument(
        "--db-path",
        default=None,
        help="Optional explicit kanban.db path for disposable smoke tests or isolated sync runs.",
    )
    parser.add_argument(
        "--assignee",
        default=DEFAULT_ASSIGNEE,
        help=f"Assignee for synced runnable tasks. Default: {DEFAULT_ASSIGNEE}.",
    )
    parser.add_argument(
        "--workspace",
        default="scratch",
        help=(
            "Task workspace kind: scratch, worktree, worktree:/absolute/path, or "
            "dir:/absolute/path. Bare worktree uses the current repo root. Default: scratch."
        ),
    )
    parser.add_argument(
        "--created-by",
        default=DEFAULT_CREATED_BY,
        help=f"created_by value for newly created tasks. Default: {DEFAULT_CREATED_BY}.",
    )
    parser.add_argument(
        "--issue",
        type=int,
        action="append",
        default=[],
        help="Restrict sync to specific issue numbers. Repeatable.",
    )
    parser.add_argument(
        "--issues-file",
        default=None,
        help="Optional JSON file containing issue payloads for offline smoke tests or CI.",
    )
    return parser.parse_args()


def default_repo() -> str:
    package_json = Path(__file__).resolve().parents[1] / "package.json"
    try:
        package = json.loads(package_json.read_text(encoding="utf-8"))
    except Exception:
        return "wan0net/llmchef"

    repository = package.get("repository")
    if isinstance(repository, dict):
        url = repository.get("url", "")
    else:
        url = str(repository or "")

    if not url:
        return "wan0net/llmchef"

    cleaned = url.removesuffix(".git")
    if cleaned.startswith("https://github.com/"):
        return cleaned.removeprefix("https://github.com/")
    if cleaned.startswith("git@github.com:"):
        return cleaned.removeprefix("git@github.com:")
    return "wan0net/llmchef"


def parse_workspace(workspace: str) -> tuple[str, str | None]:
    if workspace == "scratch":
        return workspace, None
    if workspace == "worktree":
        return workspace, str(PROJECT_ROOT)
    if workspace.startswith("worktree:"):
        workspace_path = workspace.removeprefix("worktree:")
        if not workspace_path.startswith("/"):
            raise ValueError("worktree: workspace must use an absolute path")
        return "worktree", workspace_path
    if workspace.startswith("dir:"):
        workspace_path = workspace.removeprefix("dir:")
        if not workspace_path.startswith("/"):
            raise ValueError("dir: workspace must use an absolute path")
        return "dir", workspace_path
    raise ValueError(
        "workspace must be scratch, worktree, worktree:/absolute/path, or dir:/absolute/path"
    )


def github_request(url: str) -> Any:
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.netloc != "api.github.com":
        raise ValueError(f"refusing non-GitHub API URL: {url}")

    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "llmchef-github-kanban-sync",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"

    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request) as response:  # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected -- URL is restricted above to api.github.com over https only.
        return json.load(response)


def fetch_issues(repo: str, issue_numbers: list[int]) -> list[Issue]:
    if issue_numbers:
        issues = []
        for issue_number in sorted(set(issue_numbers)):
            payload = github_request(f"{GITHUB_API_BASE}/repos/{repo}/issues/{issue_number}")
            if "pull_request" in payload:
                continue
            issues.append(issue_from_payload(payload))
        return issues

    issues: list[Issue] = []
    page = 1
    while True:
        query = urllib.parse.urlencode({"state": "all", "per_page": 100, "page": page})
        payload = github_request(f"{GITHUB_API_BASE}/repos/{repo}/issues?{query}")
        page_issues = [issue_from_payload(item) for item in payload if "pull_request" not in item]
        issues.extend(page_issues)
        if len(payload) < 100:
            break
        page += 1
    return issues


def load_issues_from_file(path: str, issue_numbers: list[int]) -> list[Issue]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    if isinstance(payload, dict):
        if isinstance(payload.get("items"), list):
            items = payload["items"]
        elif isinstance(payload.get("issues"), list):
            items = payload["issues"]
        else:
            items = [payload]
    elif isinstance(payload, list):
        items = payload
    else:
        raise ValueError(f"issues file {path} must contain an object or array")

    issues = [issue_from_payload(item) for item in items if "pull_request" not in item]
    if issue_numbers:
        wanted = set(issue_numbers)
        issues = [issue for issue in issues if issue.number in wanted]
    return issues


def issue_from_payload(payload: dict[str, Any]) -> Issue:
    issue_url = payload.get("html_url") or payload.get("url") or payload.get("issue_url")
    if not issue_url:
        raise ValueError("issue payload missing html_url/url")

    raw_labels = payload.get("labels", [])
    labels: list[str] = []
    for label in raw_labels:
        if isinstance(label, dict):
            labels.append(str(label["name"]))
        else:
            labels.append(str(label))

    return Issue(
        number=int(payload["number"]),
        title=str(payload["title"]),
        body=str(payload.get("body") or "").strip(),
        state=str(payload["state"]),
        url=str(issue_url),
        labels=sorted(labels),
    )


def task_spec_for_issue(issue: Issue, repo: str, assignee: str, workspace: tuple[str, str | None]) -> TaskSpec:
    workspace_kind, workspace_path = workspace
    return TaskSpec(
        title=f"[GH-{issue.number}] {issue.title}",
        body=(
            f"GitHub issue source of truth: {repo}#{issue.number}\n"
            f"Issue URL: {issue.url}\n"
            f"Issue title: {issue.title}\n"
            f"State: {issue.state}\n"
            f"Labels: {', '.join(issue.labels) if issue.labels else '(none)'}\n\n"
            f"Issue body:\n"
            f"{issue.body or '(empty issue body)'}\n"
        ),
        assignee=assignee,
        priority=priority_for_issue(issue),
        workspace_kind=workspace_kind,
        workspace_path=workspace_path,
        idempotency_key=idempotency_key(repo, issue.number),
    )


def priority_for_issue(issue: Issue) -> int:
    for label in issue.labels:
        if label in PRIORITY_MAP:
            return PRIORITY_MAP[label]
    return 0


def idempotency_key(repo: str, issue_number: int) -> str:
    return f"github-issue:{repo}#{issue_number}"


def find_active_task(conn: Any, key: str) -> kanban_db.Task | None:
    row = conn.execute(
        "SELECT * FROM tasks WHERE idempotency_key = ? AND status != 'archived' "
        "ORDER BY created_at DESC LIMIT 1",
        (key,),
    ).fetchone()
    return kanban_db.Task.from_row(row) if row else None


def update_task_fields(conn: Any, task_id: str, spec: TaskSpec) -> list[str]:
    row = conn.execute(
        "SELECT * FROM tasks WHERE id = ?",
        (task_id,),
    ).fetchone()
    if row is None:
        raise RuntimeError(f"unknown task {task_id}")
    task = kanban_db.Task.from_row(row)

    desired_fields = {
        "title": spec.title,
        "body": spec.body,
        "priority": spec.priority,
    }
    if task.status != "running":
        desired_fields["assignee"] = spec.assignee
        desired_fields["workspace_kind"] = spec.workspace_kind
        desired_fields["workspace_path"] = spec.workspace_path

    changed_fields: list[str] = []
    changed_values: list[tuple[str, Any]] = []
    for field_name, desired_value in desired_fields.items():
        current_value = getattr(task, field_name)
        if current_value != desired_value:
            changed_fields.append(field_name)
            changed_values.append((field_name, desired_value))

    if not changed_fields:
        return []

    with kanban_db.write_txn(conn):
        for field_name, desired_value in changed_values:
            conn.execute(TASK_UPDATE_SQL[field_name], (desired_value, task_id))
        kanban_db._append_event(
            conn,
            task_id,
            "edited",
            {"fields": changed_fields, "source": "github-sync"},
        )
    return changed_fields


def block_for_issue(conn: Any, task: kanban_db.Task, reason: str) -> bool:
    if task.status in {"blocked", "done", "archived"}:
        return False
    if task.status in {"ready", "running"}:
        return kanban_db.block_task(conn, task.id, reason=reason)

    with kanban_db.write_txn(conn):
        cur = conn.execute(
            "UPDATE tasks SET status = 'blocked', claim_lock = NULL, claim_expires = NULL, worker_pid = NULL "
            "WHERE id = ? AND status IN ('todo', 'triage')",
            (task.id,),
        )
        if cur.rowcount != 1:
            return False
        run_id = kanban_db._synthesize_ended_run(conn, task.id, outcome="blocked", summary=reason)
        kanban_db._append_event(conn, task.id, "blocked", {"reason": reason}, run_id=run_id)
    return True


def activate_for_ready_issue(conn: Any, task: kanban_db.Task) -> str | None:
    if task.status in {"ready", "running", "todo"}:
        return None
    if task.status == "blocked":
        if kanban_db.unblock_task(conn, task.id):
            refreshed = kanban_db.get_task(conn, task.id)
            return refreshed.status if refreshed else "ready"
        return None
    if task.status in {"done", "triage"}:
        with kanban_db.write_txn(conn):
            undone_parent = conn.execute(
                "SELECT 1 FROM task_links l "
                "JOIN tasks p ON p.id = l.parent_id "
                "WHERE l.child_id = ? AND p.status != 'done' LIMIT 1",
                (task.id,),
            ).fetchone()
            new_status = "todo" if undone_parent else "ready"
            cur = conn.execute(
                "UPDATE tasks SET status = ?, completed_at = NULL, result = NULL, current_run_id = NULL "
                "WHERE id = ? AND status IN ('done', 'triage')",
                (new_status, task.id),
            )
            if cur.rowcount != 1:
                return None
            kanban_db._append_event(
                conn,
                task.id,
                "reopened",
                {"status": new_status, "source": "github-sync"},
            )
        return new_status
    return None


def create_task(conn: Any, spec: TaskSpec, created_by: str) -> str:
    return kanban_db.create_task(
        conn,
        title=spec.title,
        body=spec.body,
        assignee=spec.assignee,
        created_by=created_by,
        workspace_kind=spec.workspace_kind,
        workspace_path=spec.workspace_path,
        priority=spec.priority,
        idempotency_key=spec.idempotency_key,
    )


def sync_issue(
    conn: Any,
    issue: Issue,
    repo: str,
    assignee: str,
    workspace: tuple[str, str | None],
    created_by: str,
    write: bool,
) -> list[str]:
    spec = task_spec_for_issue(issue, repo, assignee, workspace)
    task = find_active_task(conn, spec.idempotency_key)
    actions: list[str] = []

    if issue.is_open and issue.is_ready:
        if task is None:
            if write:
                task_id = create_task(conn, spec, created_by)
                actions.append(f"create {task_id}")
            else:
                actions.append("create")
            return actions

        changed_fields = update_task_fields(conn, task.id, spec) if write else preview_field_changes(task, spec)
        if changed_fields:
            actions.append(f"update[{', '.join(changed_fields)}]")
        activation = activate_for_ready_issue(conn, task) if write else preview_activation(task)
        if activation:
            actions.append(f"activate->{activation}")
        if not actions:
            actions.append("stable")
        return actions

    if issue.is_open and not issue.is_ready:
        if task is None:
            return ["skip:not-ready"]
        changed_fields = update_task_fields(conn, task.id, spec) if write else preview_field_changes(task, spec)
        if changed_fields:
            actions.append(f"update[{', '.join(changed_fields)}]")
        reason = "GitHub issue is open but missing the ready label; sync parked the mapped task."
        parked = block_for_issue(conn, task, reason) if write else preview_block(task)
        actions.append("block:not-ready" if parked else "stable:not-ready")
        return actions

    if task is None:
        return ["skip:closed"]
    changed_fields = update_task_fields(conn, task.id, spec) if write else preview_field_changes(task, spec)
    if changed_fields:
        actions.append(f"update[{', '.join(changed_fields)}]")
    archived = kanban_db.archive_task(conn, task.id) if write else preview_archive(task)
    actions.append("archive:closed" if archived else "stable:closed")
    return actions


def preview_field_changes(task: kanban_db.Task, spec: TaskSpec) -> list[str]:
    changed = []
    comparisons = {
        "title": spec.title,
        "body": spec.body,
        "priority": spec.priority,
    }
    if task.status != "running":
        comparisons["assignee"] = spec.assignee
        comparisons["workspace_kind"] = spec.workspace_kind
        comparisons["workspace_path"] = spec.workspace_path
    for field_name, desired_value in comparisons.items():
        if getattr(task, field_name) != desired_value:
            changed.append(field_name)
    return changed


def preview_activation(task: kanban_db.Task) -> str | None:
    if task.status == "blocked":
        return "ready-or-todo"
    if task.status in {"done", "triage"}:
        return "ready-or-todo"
    return None


def preview_block(task: kanban_db.Task) -> bool:
    return task.status not in {"blocked", "done", "archived"}


def preview_archive(task: kanban_db.Task) -> bool:
    return task.status != "archived"


def summarize_action(action: str) -> str:
    if action.startswith("create"):
        return "create"
    if action.startswith("update["):
        return "update"
    if action.startswith("activate->"):
        return "activate"
    if action.startswith("archive:"):
        return "archive"
    if action.startswith("block:"):
        return "block"
    if action.startswith("stable:"):
        return "stable"
    return action


def summarize(board: str, repo: str, issue_count: int, results: list[tuple[Issue, list[str]]], write: bool) -> str:
    header = (
        f"GitHub -> Kanban sync {'applied' if write else 'dry run'} for {issue_count} issues "
        f"from {repo} on board {board}."
    )
    lines = [header]
    counts: dict[str, int] = {}
    for issue, actions in results:
        label_text = ", ".join(issue.labels) if issue.labels else "(none)"
        lines.append(
            f"- #{issue.number} [{issue.state}] {issue.title} | labels: {label_text} | {', '.join(actions)}"
        )
        for action in actions:
            summary_action = summarize_action(action)
            counts[summary_action] = counts.get(summary_action, 0) + 1

    if counts:
        summary_bits = [f"{name}={counts[name]}" for name in sorted(counts)]
        lines.append(f"Summary: {', '.join(summary_bits)}")
    if not write:
        lines.append("Re-run with --write to apply changes.")
    return "\n".join(lines)


def current_board_label(board: str | None, db_path: str | None) -> str:
    if db_path:
        return db_path
    return board or kanban_db.get_current_board()


def resolve_connection(board: str | None, db_path: str | None):
    if db_path:
        return kanban_db.connect(db_path=Path(db_path))
    if board is None:
        return kanban_db.connect()
    normalized = board.strip().lower()
    if normalized == kanban_db.DEFAULT_BOARD:
        db_path_obj = kanban_db.kanban_home() / "kanban.db"
    else:
        db_path_obj = kanban_db.board_dir(normalized) / "kanban.db"
    return kanban_db.connect(db_path=db_path_obj)


def main() -> int:
    args = parse_args()
    try:
        workspace = parse_workspace(args.workspace)
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    try:
        if args.issues_file:
            issues = load_issues_from_file(args.issues_file, args.issue)
        else:
            issues = fetch_issues(args.repo, args.issue)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"error: failed to load issues: {exc}", file=sys.stderr)
        return 1
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        print(f"error: GitHub API request failed with HTTP {exc.code}: {detail}", file=sys.stderr)
        return 1
    except urllib.error.URLError as exc:
        print(f"error: GitHub API request failed: {exc}", file=sys.stderr)
        return 1

    issues.sort(key=lambda issue: issue.number)
    conn = resolve_connection(args.board, args.db_path)
    try:
        results = [
            (
                issue,
                sync_issue(
                    conn,
                    issue,
                    args.repo,
                    args.assignee,
                    workspace,
                    args.created_by,
                    args.write,
                ),
            )
            for issue in issues
        ]
    finally:
        conn.close()

    print(summarize(current_board_label(args.board, args.db_path), args.repo, len(issues), results, args.write))
    return 0


if __name__ == "__main__":
    sys.exit(main())
