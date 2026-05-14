import importlib.util
import tempfile
import unittest
from pathlib import Path

from hermes_cli import kanban_db


SCRIPT_PATH = Path(__file__).resolve().parents[1] / "scripts" / "sync-github-kanban-issues.py"
SPEC = importlib.util.spec_from_file_location("sync_github_kanban_issues", SCRIPT_PATH)
sync_module = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(sync_module)


class GithubKanbanSyncTests(unittest.TestCase):
    def make_conn(self):
        tmpdir = tempfile.TemporaryDirectory()
        db_path = Path(tmpdir.name) / "kanban.db"
        conn = kanban_db.connect(db_path=db_path)
        self.addCleanup(conn.close)
        self.addCleanup(tmpdir.cleanup)
        return conn

    def make_issue(self, *, number=16, title="Ship sync", body="Detailed spec", state="open", labels=None):
        return sync_module.Issue(
            number=number,
            title=title,
            body=body,
            state=state,
            url=f"https://github.com/wan0net/llmchef/issues/{number}",
            labels=sorted(labels or []),
        )

    def test_parse_workspace_supports_repo_root_worktree(self):
        workspace_kind, workspace_path = sync_module.parse_workspace("worktree")
        self.assertEqual(workspace_kind, "worktree")
        self.assertEqual(workspace_path, str(sync_module.PROJECT_ROOT))

    def test_parse_workspace_rejects_relative_paths(self):
        with self.assertRaises(ValueError):
            sync_module.parse_workspace("worktree:relative/path")
        with self.assertRaises(ValueError):
            sync_module.parse_workspace("dir:relative/path")

    def test_issue_from_payload_supports_fixture_shapes(self):
        issue = sync_module.issue_from_payload(
            {
                "number": 42,
                "title": "Fixture issue",
                "body": "Fixture body",
                "state": "open",
                "url": "https://example.test/issues/42",
                "labels": ["ready", {"name": "priority:P1"}],
            }
        )
        self.assertEqual(issue.url, "https://example.test/issues/42")
        self.assertEqual(issue.labels, ["priority:P1", "ready"])

    def test_load_issues_from_file_supports_items_wrapper_and_issue_filter(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            payload_path = Path(tmpdir) / "issues.json"
            payload_path.write_text(
                """
                {
                  "items": [
                    {"number": 14, "title": "A", "body": "Body A", "state": "open", "html_url": "https://example.test/14", "labels": ["ready"]},
                    {"number": 15, "title": "B", "body": "Body B", "state": "closed", "html_url": "https://example.test/15", "labels": []}
                  ]
                }
                """.strip(),
                encoding="utf-8",
            )

            issues = sync_module.load_issues_from_file(str(payload_path), [15])

        self.assertEqual(len(issues), 1)
        self.assertEqual(issues[0].number, 15)

    def test_ready_issue_creates_task_with_github_context_and_is_idempotent(self):
        conn = self.make_conn()
        issue = self.make_issue(labels=["lane:backlog", "priority:P2", "ready"])

        first_actions = sync_module.sync_issue(
            conn,
            issue,
            "wan0net/llmchef",
            "ford-prefect",
            ("scratch", None),
            "github-sync",
            write=True,
        )
        self.assertEqual(len(first_actions), 1)
        self.assertRegex(first_actions[0], r"^create t_[0-9a-f]{8}$")

        task = sync_module.find_active_task(conn, sync_module.idempotency_key("wan0net/llmchef", issue.number))
        self.assertIsNotNone(task)
        assert task is not None
        self.assertEqual(task.title, "[GH-16] Ship sync")
        self.assertEqual(task.assignee, "ford-prefect")
        self.assertEqual(task.priority, 200)
        self.assertEqual(task.status, "ready")
        self.assertIn("GitHub issue source of truth: wan0net/llmchef#16", task.body)
        self.assertIn("Issue URL: https://github.com/wan0net/llmchef/issues/16", task.body)
        self.assertIn("Labels: lane:backlog, priority:P2, ready", task.body)
        self.assertIn("Detailed spec", task.body)

        second_actions = sync_module.sync_issue(
            conn,
            issue,
            "wan0net/llmchef",
            "ford-prefect",
            ("scratch", None),
            "github-sync",
            write=True,
        )
        self.assertEqual(second_actions, ["stable"])

    def test_open_non_ready_issue_blocks_existing_task(self):
        conn = self.make_conn()
        ready_issue = self.make_issue(labels=["ready", "priority:P1"])
        sync_module.sync_issue(
            conn,
            ready_issue,
            "wan0net/llmchef",
            "ford-prefect",
            ("scratch", None),
            "github-sync",
            write=True,
        )

        non_ready_issue = self.make_issue(labels=["priority:P1"])
        actions = sync_module.sync_issue(
            conn,
            non_ready_issue,
            "wan0net/llmchef",
            "ford-prefect",
            ("scratch", None),
            "github-sync",
            write=True,
        )
        self.assertEqual(actions, ["update[body]", "block:not-ready"])

        task = sync_module.find_active_task(conn, sync_module.idempotency_key("wan0net/llmchef", ready_issue.number))
        self.assertIsNotNone(task)
        assert task is not None
        self.assertEqual(task.status, "blocked")
        self.assertIn("State: open", task.body)
        self.assertIn("Labels: priority:P1", task.body)

    def test_closed_issue_archives_existing_task_and_recreates_when_reopened(self):
        conn = self.make_conn()
        ready_issue = self.make_issue(labels=["ready", "priority:P3"])
        sync_module.sync_issue(
            conn,
            ready_issue,
            "wan0net/llmchef",
            "ford-prefect",
            ("scratch", None),
            "github-sync",
            write=True,
        )

        closed_issue = self.make_issue(state="closed", labels=["priority:P3", "ready"])
        close_actions = sync_module.sync_issue(
            conn,
            closed_issue,
            "wan0net/llmchef",
            "ford-prefect",
            ("scratch", None),
            "github-sync",
            write=True,
        )
        self.assertEqual(close_actions, ["update[body]", "archive:closed"])

        task = sync_module.find_active_task(conn, sync_module.idempotency_key("wan0net/llmchef", ready_issue.number))
        self.assertIsNone(task)

        archived_rows = conn.execute(
            "SELECT * FROM tasks WHERE idempotency_key = ? ORDER BY created_at DESC",
            (sync_module.idempotency_key("wan0net/llmchef", ready_issue.number),),
        ).fetchall()
        self.assertEqual(len(archived_rows), 1)
        archived_task = kanban_db.Task.from_row(archived_rows[0])
        self.assertEqual(archived_task.status, "archived")
        self.assertIn("State: closed", archived_task.body)

        reopened_issue = self.make_issue(labels=["ready", "priority:P3"], body="Reopened scope")
        reopen_actions = sync_module.sync_issue(
            conn,
            reopened_issue,
            "wan0net/llmchef",
            "ford-prefect",
            ("scratch", None),
            "github-sync",
            write=True,
        )
        self.assertEqual(len(reopen_actions), 1)
        self.assertRegex(reopen_actions[0], r"^create t_[0-9a-f]{8}$")

        refreshed = sync_module.find_active_task(conn, sync_module.idempotency_key("wan0net/llmchef", ready_issue.number))
        self.assertIsNotNone(refreshed)
        assert refreshed is not None
        self.assertEqual(refreshed.status, "ready")
        self.assertIn("Reopened scope", refreshed.body)

    def test_resolve_connection_accepts_explicit_db_path(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "kanban.db"
            conn = sync_module.resolve_connection(None, str(db_path))
            try:
                task_id = kanban_db.create_task(conn, title="Smoke", assignee="ford-prefect")
                self.assertTrue(task_id.startswith("t_"))
            finally:
                conn.close()
            self.assertTrue(db_path.exists())


if __name__ == "__main__":
    unittest.main()
