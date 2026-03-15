import os
import json
from datetime import datetime, timezone
from app.core.llm import generate_json, generate_text
from app.core.alerts import alert_system
from .models import PRReviewResponse, AutoHealResponse

# Audit log path — stored in the rebackend's storage folder
_AUDIT_LOG = os.path.join(os.path.dirname(__file__), "..", "..", "..", "storage", "guardian_audit.log")


def _save_audit_log(file_name: str, passed: bool, issues: list, message: str) -> None:
    """
    Appends a single JSON-lines audit record to guardian_audit.log.
    This creates the "paper trail" so Staff Engineers can review every
    Guardian decision (Pass or Fail) without re-running the checks.
    """
    record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "file_name": file_name,
        "passed": passed,
        "issues_count": len(issues),
        "message": message,
        "issues": issues,
    }
    try:
        os.makedirs(os.path.dirname(_AUDIT_LOG), exist_ok=True)
        with open(_AUDIT_LOG, "a", encoding="utf-8") as f:
            f.write(json.dumps(record) + "\n")
    except OSError:
        pass  # Non-fatal — review still returns to caller


class GuardianService:
    def __init__(self):
        self.review_prompt = """
You are an expert, uncompromising Senior Software Engineer performing a code review.
Your job is to identify code quality issues, missing docstrings, missing type hints, unused variables, and potential security smells.

Follow these rules:
1. Be extremely strict but constructive.
2. If there are any issues whatsoever, "passed" MUST be false.
3. If the code is perfect, "passed" should be true and "issues" should be empty.
4. "issues" must be a list of clear, actionable strings.
5. "message" should be a 1-2 sentence summary of your findings.

Return ONLY valid JSON matching this schema:
{
    "passed": boolean,
    "issues": ["Issue 1", "Issue 2"],
    "message": "Summary string"
}
"""

        self.heal_prompt = """
You are an expert Senior Software Engineer. Your task is to auto-heal (refactor) the provided code to fix ALL issues identified in a code review.

Follow these strict rules:
1. Fix EVERY listed issue. This means adding comprehensive docstrings (class AND method levels), adding type hints everywhere they are missing, removing unused code, and fixing security smells.
2. DO NOT change the core logic or behavior of the code.
3. Preserve the original language and indentation style.
4. Output the COMPLETE, fully-fixed file content wrapped inside a single markdown code block (``` ... ```).
5. Do NOT use placeholders like `# ... rest of code ...`. You MUST output the entire file content.
6. You MUST briefly explain what you changed BEFORE the code block.

Return ONLY your explanation and the code block.
"""

    def review_code(self, file_name: str, code_content: str) -> PRReviewResponse:
        print(f"[Guardian:Review] Analyzing {file_name}...")
        user_prompt = f"File: {file_name}\n\nCode:\n```\n{code_content}\n```"
        try:
            result = generate_json(user_prompt, self.review_prompt)
            passed = result.get("passed", True)
            issues = result.get("issues", [])
            message = result.get("message", "Review completed.")
            
            if issues and passed:
                passed = False

            # ── Write audit log (the "paper trail") ─────────────────────────
            _save_audit_log(file_name, passed, issues, message)
                
            print(f"[Guardian:Review] Result: {'PASSED' if passed else 'BLOCKED'} ({len(issues)} issues)")
            return PRReviewResponse(passed=passed, issues=issues, message=message)
        except Exception as e:
            print(f"[Guardian:Review] Error: {e}")
            alert_system.add_alert(
                title="Guardian Review Failed",
                message=str(e),
                severity="error"
            )
            raise ValueError(f"Failed to generate review: {e}")


    def heal_code(self, file_name: str, code_content: str, issues: list[str]) -> AutoHealResponse:
        print(f"[Guardian:Heal] Attempting to fix {file_name}...")
        issues_text = "\n".join(f"- {i}" for i in issues)
        user_prompt = f"File: {file_name}\n\nIssues to fix:\n{issues_text}\n\nOriginal Code:\n```\n{code_content}\n```"
        
        try:
            result_text = generate_text(user_prompt, self.heal_prompt, temperature=0.1)
            
            # Extract the code block (more relaxed regex)
            import re
            match = re.search(r"```[a-zA-Z]*\s*([\s\S]*?)```", result_text)
            if match:
                fixed_code = match.group(1).strip()
                message = result_text[:match.start()].strip() or "Auto-heal completed."
            else:
                fixed_code = result_text.strip()
                message = "Auto-heal completed."
                
            print(f"[Guardian:Heal] Successfully generated fixed code for {file_name}")
            return AutoHealResponse(fixed_code=fixed_code, message=message)
        except Exception as e:
            print(f"[Guardian:Heal] Error: {e}")
            alert_system.add_alert(
                title="Guardian Heal Failed",
                message=str(e),
                severity="error"
            )
            raise ValueError(f"Failed to generate healed code: {e}")

    def save_file(self, file_path: str, content: str) -> bool:
        """
        Safely saves content to the given absolute file_path.
        """
        cwd = os.path.abspath(os.getcwd())
        abs_path = os.path.abspath(file_path)
        
        # Normpath to handle mixed slashes in Windows/Linux interop
        abs_path = os.path.normpath(abs_path)
        storage_dir = os.path.abspath(os.path.join(cwd, "storage"))
        
        is_safe = abs_path.startswith(cwd) or abs_path.startswith(storage_dir)
        
        if not is_safe:
            print(f"[Guardian:Save] BLOCKED: Path {abs_path} is outside allowed directories.")
            alert_system.add_alert(
                title="Security Alert",
                message=f"Blocked attempt to write to protected path: {file_path}",
                severity="error"
            )
            raise PermissionError(f"Path is outside allowed project directories: {file_path}")

        try:
            os.makedirs(os.path.dirname(abs_path), exist_ok=True)
            with open(abs_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            print(f"[Guardian:Save] Successfully saved {abs_path}")
            alert_system.add_alert(
                title="File Saved",
                message=f"Successfully updated {os.path.basename(abs_path)}",
                severity="success"
            )
            return True
        except Exception as e:
            print(f"[Guardian:Save] Failed to save {abs_path}: {e}")
            alert_system.add_alert(
                title="Save Failed",
                message=f"Could not save {file_path}: {e}",
                severity="error"
            )
            raise IOError(f"Failed to save file: {e}")

guardian_service = GuardianService()
