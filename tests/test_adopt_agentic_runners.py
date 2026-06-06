import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SCRIPT = REPO_ROOT / "scripts" / "adopt-agentic-runners.sh"


class AdoptAgenticRunnersTests(unittest.TestCase):
    def run_script(self, *args: str, cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["bash", str(SCRIPT), *args],
            cwd=cwd or REPO_ROOT,
            text=True,
            capture_output=True,
            check=False,
        )

    def make_target(self) -> Path:
        temp_dir = Path(tempfile.mkdtemp(prefix="adopt-agentic-runners-"))
        self.addCleanup(lambda: shutil.rmtree(temp_dir, ignore_errors=True))
        return temp_dir

    def test_install_copies_full_managed_script_set(self) -> None:
        target = self.make_target()

        result = self.run_script("install", "--target", str(target))
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

        marker = json.loads((target / ".github" / "agentic-runners-managed.json").read_text())
        expected_files = {
            "scripts/adopt-agentic-runners.sh",
            "scripts/agent-ticket-focus.sh",
            "scripts/auto-resolve-rebase-conflicts.sh",
            "scripts/bootstrap-labels.sh",
        }

        self.assertTrue(expected_files.issubset(set(marker["files"])))
        for rel_path in expected_files:
            self.assertTrue((target / rel_path).is_file(), rel_path)

    def test_verify_default_runner_label_is_clean(self) -> None:
        target = self.make_target()

        install = self.run_script("install", "--target", str(target))
        self.assertEqual(install.returncode, 0, install.stdout + install.stderr)

        verify = self.run_script("verify", "--target", str(target))
        self.assertEqual(verify.returncode, 0, verify.stdout + verify.stderr)
        self.assertNotIn("Some workflows still reference the default label", verify.stderr)
        self.assertIn("Verification passed.", verify.stdout)


if __name__ == "__main__":
    unittest.main()
