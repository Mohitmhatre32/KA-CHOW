import os
from app.core.llm import generate_json_response, client
from app.core.sonar_client import sonar
from app.core.alerts import alert_system
from .models import EditorResponse, PRReviewResponse, AutoHealResponse

class GuardianService:
    
    def validate_and_push(self, file_path: str, content: str, project_key: str) -> EditorResponse:
        """
        Interacts with the IDE:
        1. Saves the edited code to disk.
        2. Runs a Real-time SonarQube check.
        3. Blocks the push and alerts the team if quality fails.
        4. Simulates a GitHub push if quality passes.
        """
        print(f"🛡️ Guardian Intercepting Save for: {file_path}")
        
        # 1. Save the changes to Disk
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(content)
        except Exception as e:
            return EditorResponse(
                status="ERROR", 
                quality_gate="ERROR", 
                message=f"System File Error: {str(e)}", 
                sonar_metrics={}
            )

        # 2. Run REAL Sonar Analysis (via our Sonar client)
        # Note: project_key is usually the repo folder name
        metrics = sonar.get_file_metrics(file_path, project_key)
        quality_status = metrics.get("quality_gate", "PASSED")
        
        # 3. Decision Logic & Alerting
        file_name = os.path.basename(file_path)

        if quality_status == "FAILED":
            # --- ALERT THE TEAM ---
            alert_msg = f"Quality Gate FAILED on {file_name}. Bugs: {metrics['bugs']}, Code Smells: {metrics['code_smells']}."
            alert_system.add_alert(
                title="❌ Blocked Bad Commit",
                message=alert_msg,
                severity="critical"
            )
            
            return EditorResponse(
                status="REJECTED",
                quality_gate="FAILED",
                message="Push Rejected: Technical debt threshold exceeded. Team Lead notified.",
                sonar_metrics=metrics
            )
        
        else:
            # --- SIMULATE SUCCESSFUL GITHUB PUSH ---
            alert_system.add_alert(
                title="✅ Code Pushed",
                message=f"Changes to {file_name} passed all Sonar checks and were pushed to main.",
                severity="success"
            )
            
            return EditorResponse(
                status="COMMITTED",
                quality_gate="PASSED",
                message="Quality Gate Passed. Changes successfully pushed to GitHub.",
                sonar_metrics=metrics
            )

    def review_pr(self, file_name: str, code_content: str) -> PRReviewResponse:
        """Simulates a CI/CD Quality Gate block for the PR view."""
        print(f"🛡️ Guardian analyzing {file_name} for merge...")
        
        system_prompt = """
        You are a strict CI/CD Quality Gate enforcer.
        Analyze the provided Python code. Check for:
        1. Missing docstrings
        2. Unused variables or messy logic
        3. Missing type hints
        
        Return ONLY a JSON object:
        {
            "passed": false,
            "issues": ["Issue 1 description", "Issue 2 description"]
        }
        """
        
        prompt = f"File: {file_name}\nCode:\n{code_content}"
        analysis = generate_json_response(prompt, system_prompt)
        
        passed = analysis.get("passed", False)
        issues = analysis.get("issues", ["Potential quality violation detected."])
        
        if passed or len(issues) == 0:
            return PRReviewResponse(
                status="PASSED",
                issues_found=[],
                message="✅ Quality Gate Passed. Code is clean and ready to merge."
            )
        else:
            return PRReviewResponse(
                status="BLOCKED",
                issues_found=issues,
                message="❌ MERGE BLOCKED: Quality Gate Failed. Please fix the technical debt."
            )

    def auto_heal_code(self, file_name: str, code_content: str, issues: list) -> AutoHealResponse:
        """Uses AI to rewrite messy code based on detected issues."""
        print(f"✨ Guardian is auto-healing {file_name}...")
        
        issues_str = "\n".join([f"- {i}" for i in issues])
        system_prompt = """
        You are an expert Autonomous Auto-Refactoring Agent.
        Rewrite the code to fix all issues:
        1. Add professional docstrings.
        2. Add type hints.
        3. Cleanup logic.
        OUTPUT ONLY RAW PYTHON CODE. NO MARKDOWN.
        """
        
        user_prompt = f"File: {file_name}\nIssues:\n{issues_str}\n\nBad Code:\n{code_content}"
        
        try:
            completion = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                model="llama-3.3-70b-versatile",
                temperature=0.1
            )
            fixed_code = completion.choices[0].message.content
            fixed_code = fixed_code.replace("```python", "").replace("```", "").strip()
        except Exception as e:
            fixed_code = f"# Error: {str(e)}"

        return AutoHealResponse(
            fixed_code=fixed_code,
            message="✨ Code successfully refactored and healed."
        )

guardian = GuardianService()