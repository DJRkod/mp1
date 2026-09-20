#!/usr/bin/env python3
"""Rebuild llm_logs.csv from the Claude Code session transcripts for this repo.

Claude Code records every session as JSONL under
~/.claude/projects/<slug-of-repo-path>/. This script flattens those transcripts
into llm_logs.csv (one row per prompt, response, tool call, and tool result).

It is idempotent: every run re-reads all transcripts, so a response that was
still being written during the previous run ("dangling") is picked up by the
next one. Rows already in the CSV whose transcript has since been deleted are
kept.

Usage:
    python scripts/export_llm_logs.py            # regenerate llm_logs.csv
    python scripts/export_llm_logs.py --full     # do not truncate long tool output
    python scripts/export_llm_logs.py --hook     # for Claude Code hooks: report failures, never raise
"""
import argparse
import csv
import json
import os
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT = REPO_ROOT / "llm_logs.csv"
FIELDS = ["entry_id", "timestamp", "session_id", "model", "role", "kind", "content"]
# Bulky, machine-generated kinds are capped; prompts, responses and tool calls
# (which hold the generated code) are always logged in full.
CAPPED_KINDS = {"tool_result", "skill_context"}
DEFAULT_CAP = 5000
# The log is committed to a public repo. Literal terms listed one per line in
# this gitignored file are scrubbed from every row on every run, as is any
# email address not in the allowlist of addresses that are already public.
REDACT_FILE = REPO_ROOT / ".llm_log_redact.txt"
EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+")
PUBLIC_EMAILS = {"uiuc.web.programming@gmail.com", "noreply@anthropic.com", "git@github.com"}

csv.field_size_limit(2**31 - 1)


def transcript_dir():
    slug = re.sub(r"[^A-Za-z0-9]", "-", str(REPO_ROOT))
    return Path.home() / ".claude" / "projects" / slug


def block_text(block):
    """Text of a tool_result block, whose content is a string or a block list."""
    content = block.get("content")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict):
                parts.append(item.get("text") or "[%s]" % item.get("type", "non-text"))
            else:
                parts.append(str(item))
        return "\n".join(parts)
    return "" if content is None else json.dumps(content, ensure_ascii=False)


def user_kind(text, is_meta):
    if is_meta:
        return "skill_context"
    if re.search(r"<command-args>\s*[^<\s]", text):
        return "prompt"  # slash command carrying the user's actual request
    if text.lstrip().startswith(("<command-", "<local-command-")):
        return "command"
    return "prompt"


def rows_from_entry(entry):
    """Yield (suffix, role, kind, content) for one transcript line."""
    message = entry.get("message")
    if entry.get("type") not in ("user", "assistant") or not isinstance(message, dict):
        return
    role = entry["type"]
    is_meta = bool(entry.get("isMeta"))
    content = message.get("content")
    if isinstance(content, str):
        content = [{"type": "text", "text": content}]
    for index, block in enumerate(content or []):
        if not isinstance(block, dict):
            continue
        kind = block.get("type")
        if kind == "text":
            text = block.get("text", "")
            row_kind = "response" if role == "assistant" else user_kind(text, is_meta)
        elif kind == "tool_use":
            text = "%s %s" % (
                block.get("name", "?"),
                json.dumps(block.get("input", {}), ensure_ascii=False),
            )
            row_kind = "tool_call"
        elif kind == "tool_result":
            text = block_text(block)
            row_kind = "tool_result"
        else:  # thinking blocks etc. are not part of the visible exchange
            continue
        if text.strip():
            yield index, role, row_kind, text


def read_transcripts(cap):
    rows = {}
    directory = transcript_dir()
    for path in sorted(directory.rglob("*.jsonl")) if directory.is_dir() else []:
        with open(path, encoding="utf-8", errors="replace") as handle:
            for line in handle:
                try:
                    entry = json.loads(line)
                except ValueError:
                    continue  # partially written last line; next run picks it up
                if not isinstance(entry, dict):
                    continue
                model = (entry.get("message") or {}).get("model", "") if isinstance(
                    entry.get("message"), dict) else ""
                for index, role, kind, text in rows_from_entry(entry):
                    if entry.get("isSidechain"):
                        kind = "subagent_" + kind
                    if cap and kind.replace("subagent_", "") in CAPPED_KINDS and len(text) > cap:
                        text = "%s\n[... truncated, %d characters total]" % (text[:cap], len(text))
                    entry_id = "%s:%d" % (entry.get("uuid", ""), index)
                    rows[entry_id] = {
                        "entry_id": entry_id,
                        "timestamp": entry.get("timestamp", ""),
                        "session_id": entry.get("sessionId", path.stem),
                        "model": model,
                        "role": role,
                        "kind": kind,
                        "content": text,
                    }
    return rows


def build_redactor():
    terms = []
    if REDACT_FILE.exists():
        terms = [line.strip() for line in REDACT_FILE.read_text(encoding="utf-8").splitlines()]
    literal = None
    if any(terms):
        ordered = sorted((t for t in terms if t), key=len, reverse=True)
        literal = re.compile("|".join(re.escape(t) for t in ordered), re.IGNORECASE)

    def redact(text):
        text = EMAIL.sub(
            lambda m: m.group(0) if m.group(0).lower() in PUBLIC_EMAILS else "[redacted-email]", text)
        return literal.sub("[redacted]", text) if literal else text

    return redact


def read_existing():
    if not OUTPUT.exists():
        return {}
    try:
        with open(OUTPUT, encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            if reader.fieldnames != FIELDS:
                return {}  # template placeholder or foreign format: start over
            return {row["entry_id"]: row for row in reader if row.get("entry_id")}
    except (OSError, csv.Error):
        return {}


def export(args):
    rows = read_existing()
    rows.update(read_transcripts(0 if args.full else args.cap))
    ordered = sorted(rows.values(), key=lambda row: (row["timestamp"], row["entry_id"]))
    redact = build_redactor()
    for row in ordered:
        row["content"] = redact(row["content"])

    temp = OUTPUT.with_suffix(".csv.tmp")
    with open(temp, "w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS, quoting=csv.QUOTE_ALL)
        writer.writeheader()
        writer.writerows(ordered)
    os.replace(temp, OUTPUT)
    return len(ordered)


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--full", action="store_true", help="never truncate content")
    parser.add_argument("--cap", type=int, default=DEFAULT_CAP,
                        help="max characters for tool results / skill context")
    parser.add_argument("--hook", action="store_true",
                        help="Claude Code hook mode: never fail the hook, but report an "
                             "export failure to the user as a system message")
    args = parser.parse_args()

    if not args.hook:
        # A failure here raises, so the git pre-commit hook blocks the commit.
        count = export(args)
        print("llm_logs.csv: %d rows from %s" % (count, transcript_dir()), file=sys.stderr)
        return 0

    try:
        export(args)
    except Exception as error:  # a stale log must be visible, never silent
        print(json.dumps({"systemMessage": "llm_logs.csv export failed: %s: %s"
                                           % (type(error).__name__, error)}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
