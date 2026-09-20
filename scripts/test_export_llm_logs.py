"""Tests for export_llm_logs.py.

Run with:  python -m unittest discover -s scripts -p "test_*.py"
"""
import contextlib
import csv
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))
import export_llm_logs as exporter  # noqa: E402


def entry(uuid, kind, content, timestamp, **extra):
    record = {
        "type": kind,
        "uuid": uuid,
        "sessionId": "session-1",
        "timestamp": timestamp,
        "message": {"role": kind, "content": content},
    }
    record.update(extra)
    return record


CONVERSATION = [
    entry("u1", "user", "Build me a navbar.", "2026-09-20T10:00:00Z"),
    entry("a1", "assistant", [
        {"type": "thinking", "thinking": "private reasoning"},
        {"type": "text", "text": "Here is the plan."},
        {"type": "tool_use", "name": "Bash", "input": {"command": "ls"}},
    ], "2026-09-20T10:00:05Z"),
    entry("u2", "user", [{"type": "tool_result", "content": "file-a\nfile-b"}], "2026-09-20T10:00:06Z"),
]


class ExporterTestCase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        root = Path(self.tmp.name)
        self.transcripts = root / "transcripts"
        self.transcripts.mkdir()
        self.output = root / "llm_logs.csv"
        self.redact_file = root / ".llm_log_redact.txt"
        patches = [
            mock.patch.object(exporter, "OUTPUT", self.output),
            mock.patch.object(exporter, "REDACT_FILE", self.redact_file),
            mock.patch.object(exporter, "transcript_dir", lambda: self.transcripts),
        ]
        for patch in patches:
            patch.start()
            self.addCleanup(patch.stop)

    def write_transcript(self, entries, name="session-1.jsonl"):
        lines = "\n".join(json.dumps(item) for item in entries) + "\n"
        (self.transcripts / name).write_text(lines, encoding="utf-8")

    def run_export(self, *args):
        stdout, stderr = io.StringIO(), io.StringIO()
        with mock.patch.object(sys, "argv", ["export_llm_logs.py", *args]), \
                contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            code = exporter.main()
        return code, stdout.getvalue()

    def rows(self):
        with open(self.output, encoding="utf-8-sig", newline="") as handle:
            return list(csv.DictReader(handle))


class ExportRowsTest(ExporterTestCase):
    def test_prompt_response_tool_call_and_result_become_ordered_rows(self):
        self.write_transcript(CONVERSATION)
        self.run_export()
        self.assertEqual(
            [(row["role"], row["kind"]) for row in self.rows()],
            [("user", "prompt"), ("assistant", "response"),
             ("assistant", "tool_call"), ("user", "tool_result")],
        )

    def test_thinking_blocks_are_not_exported(self):
        self.write_transcript(CONVERSATION)
        self.run_export()
        self.assertFalse(any("private reasoning" in row["content"] for row in self.rows()))

    def test_rerun_adds_no_duplicates_and_picks_up_a_dangling_response(self):
        self.write_transcript(CONVERSATION)
        self.run_export()
        first = self.rows()
        self.run_export()
        self.assertEqual(self.rows(), first)

        late = entry("a2", "assistant", [{"type": "text", "text": "Done."}], "2026-09-20T10:00:09Z")
        self.write_transcript(CONVERSATION + [late])
        self.run_export()
        rows = self.rows()
        self.assertEqual(len(rows), len(first) + 1)
        self.assertEqual(rows[-1]["content"], "Done.")

    def test_rows_survive_deletion_of_their_transcript(self):
        self.write_transcript(CONVERSATION)
        self.run_export()
        (self.transcripts / "session-1.jsonl").unlink()
        self.run_export()
        self.assertEqual(len(self.rows()), 4)

    def test_malformed_last_line_is_skipped(self):
        self.write_transcript(CONVERSATION)
        with open(self.transcripts / "session-1.jsonl", "a", encoding="utf-8") as handle:
            handle.write('{"type": "assistant", "uuid": "a9", "mess')
        self.run_export()
        self.assertEqual(len(self.rows()), 4)


class RedactionTest(ExporterTestCase):
    def test_private_email_is_redacted_and_public_one_is_kept(self):
        self.write_transcript([entry(
            "u1", "user",
            "Mail me at someone.private@example.com or uiuc.web.programming@gmail.com.",
            "2026-09-20T10:00:00Z",
        )])
        self.run_export()
        content = self.rows()[0]["content"]
        self.assertNotIn("someone.private@example.com", content)
        self.assertIn("[redacted-email]", content)
        self.assertIn("uiuc.web.programming@gmail.com", content)

    def test_listed_terms_are_scrubbed_case_insensitively(self):
        self.redact_file.write_text("secretname\n", encoding="utf-8")
        self.write_transcript([entry("u1", "user", "grep SecretName in the log", "2026-09-20T10:00:00Z")])
        self.run_export()
        content = self.rows()[0]["content"]
        self.assertNotIn("SecretName", content)
        self.assertIn("[redacted]", content)

    def test_redaction_also_covers_rows_kept_from_an_earlier_export(self):
        self.write_transcript([entry("u1", "user", "term: keepsake", "2026-09-20T10:00:00Z")])
        self.run_export()
        (self.transcripts / "session-1.jsonl").unlink()
        self.redact_file.write_text("keepsake\n", encoding="utf-8")
        self.run_export()
        self.assertNotIn("keepsake", self.rows()[0]["content"])


class FailureVisibilityTest(ExporterTestCase):
    def failing_replace(self):
        return mock.patch.object(exporter.os, "replace", side_effect=PermissionError("file is locked"))

    def test_a_failed_export_raises_so_the_pre_commit_hook_blocks(self):
        self.write_transcript(CONVERSATION)
        with self.failing_replace(), self.assertRaises(PermissionError):
            self.run_export()

    def test_hook_mode_reports_the_failure_as_a_system_message_and_exits_zero(self):
        self.write_transcript(CONVERSATION)
        with self.failing_replace():
            code, stdout = self.run_export("--hook")
        self.assertEqual(code, 0)
        message = json.loads(stdout)["systemMessage"]
        self.assertIn("llm_logs.csv", message)
        self.assertIn("file is locked", message)

    def test_hook_mode_is_silent_on_success(self):
        self.write_transcript(CONVERSATION)
        code, stdout = self.run_export("--hook")
        self.assertEqual((code, stdout), (0, ""))


if __name__ == "__main__":
    unittest.main()
