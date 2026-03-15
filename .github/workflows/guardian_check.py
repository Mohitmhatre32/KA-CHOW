#!/usr/bin/env python3
"""
Guardian Check Script — KA-CHOW PR Gatekeeper
==============================================
This script is called by the GitHub Actions workflow on every Pull Request.

What it does:
  1. Uses `git diff --name-only HEAD~1` to find only the changed Python files.
  2. Parses each file with Python's `ast` module (structural analysis, not LLM).
  3. Checks every FunctionDef and ClassDef for a docstring.
  4. Saves a Pass/Fail audit decision to `guardian_audit.log`.
  5. Prints a human-readable report and exits with code 1 if any checks fail,
     which causes GitHub to show a RED ❌ on the Pull Request.

Usage (run locally):
  python .github/workflows/guardian_check.py

Usage (in CI via GitHub Actions):
  The guardian_check.yml workflow calls this automatically on every PR.
"""

import ast
import json
import os
import subprocess
import sys
from datetime import datetime, timezone


# ── Config ─────────────────────────────────────────────────────────────────────

AUDIT_LOG_FILE = "guardian_audit.log"
IGNORED_FUNCTION_PREFIXES = ("test_", "_test", "__")  # Skip test helpers


# ── Helpers ────────────────────────────────────────────────────────────────────

def get_changed_python_files() -> list[str]:
    """
    Returns a list of .py files changed in this PR vs the previous commit.
    Falls back to all tracked .py files if git diff fails (e.g. first commit).
    """
    try:
        result = subprocess.run(
            ["git", "diff", "--name-only", "--diff-filter=ACM", "HEAD~1", "HEAD"],
            capture_output=True,
            text=True,
            check=True,
        )
        files = [
            f.strip()
            for f in result.stdout.splitlines()
            if f.strip().endswith(".py") and os.path.isfile(f.strip())
        ]
        return files
    except subprocess.CalledProcessError:
        # Fallback: scan all Python files in repo
        files = []
        for root, dirs, filenames in os.walk("."):
            dirs[:] = [d for d in dirs if d not in (".git", "venv", "__pycache__", "node_modules")]
            for fn in filenames:
                if fn.endswith(".py"):
                    files.append(os.path.join(root, fn))
        return files


def check_file(filepath: str) -> list[dict]:
    """
    Parses a Python file with AST and returns a list of violations.
    Each violation is: {"name": str, "type": str, "lineno": int, "issue": str}
    """
    violations = []

    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            source = f.read()
    except OSError as e:
        return [{"name": filepath, "type": "file", "lineno": 0, "issue": f"Cannot read file: {e}"}]

    try:
        tree = ast.parse(source, filename=filepath)
    except SyntaxError as e:
        return [{"name": filepath, "type": "syntax", "lineno": e.lineno or 0, "issue": f"SyntaxError: {e.msg}"}]

    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            node_type = "function"
            # Skip private helpers and test stubs if desired
            if any(node.name.startswith(p) for p in IGNORED_FUNCTION_PREFIXES):
                continue
        elif isinstance(node, ast.ClassDef):
            node_type = "class"
        else:
            continue

        if not ast.get_docstring(node):
            violations.append({
                "name": node.name,
                "type": node_type,
                "lineno": node.lineno,
                "issue": f"Missing docstring for {node_type} '{node.name}' (line {node.lineno})",
            })

    return violations


def save_audit_log(entries: list[dict]) -> None:
    """Appends a JSON-lines audit record to AUDIT_LOG_FILE."""
    record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "total_files_checked": len(entries),
        "passed": all(e["violations_count"] == 0 for e in entries),
        "files": entries,
    }
    try:
        with open(AUDIT_LOG_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(record) + "\n")
    except OSError:
        pass  # Non-fatal — CI still reports via stdout


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> int:
    """
    Entry point. Returns exit code:
      0 — All checks passed (PR can merge)
      1 — Quality gate failed (PR is blocked)
    """
    print("=" * 60)
    print("🛡️  KA-CHOW Guardian — PR Quality Gate")
    print("=" * 60)

    changed_files = get_changed_python_files()

    if not changed_files:
        print("\n✅  No Python files changed — nothing to check.")
        save_audit_log([])
        return 0

    print(f"\n📂  Checking {len(changed_files)} changed Python file(s):\n")

    all_violations: list[str] = []
    audit_entries: list[dict] = []

    for filepath in changed_files:
        violations = check_file(filepath)
        audit_entries.append({
            "file": filepath,
            "violations_count": len(violations),
            "violations": violations,
        })

        if violations:
            print(f"  ❌  {filepath}  ({len(violations)} violation(s))")
            for v in violations:
                msg = f"Merge Blocked: Missing documentation for '{v['name']}' {v['type']} (line {v['lineno']})."
                print(f"       → {msg}")
                all_violations.append(msg)
        else:
            print(f"  ✅  {filepath}  — OK")

    save_audit_log(audit_entries)

    print("\n" + "=" * 60)

    if all_violations:
        print(f"\n❌  QUALITY GATE: FAILED")
        print(f"   {len(all_violations)} violation(s) must be fixed before this PR can merge.\n")
        print("   Summary of required fixes:")
        for v in all_violations:
            print(f"   • {v}")
        print(f"\n💡  Tip: Use KA-CHOW's 'Auto-Heal' feature to fix docstrings automatically.")
        print("=" * 60)
        return 1

    print(f"\n✅  QUALITY GATE: PASSED")
    print(f"   All {len(changed_files)} file(s) meet documentation standards.")
    print(f"   This PR is approved to merge. 🎉")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
