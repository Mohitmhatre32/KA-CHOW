import os
import sys
import json
import time
from datetime import datetime, timezone

# Ensure we can import from app
sys.path.append(os.getcwd())

from app.agents.guardian.service import guardian_service

# Define 5 PR scenarios - PROJECT RELEVANT for KA-CHOW
SCENARIOS = [
    {
        "id": 1,
        "file": "app/agents/librarian/service.py",
        "description": "Refactored Graph Building logic",
        "content": '"""Librarian graph builder."""\nclass Librarian:\n    def build_graph(self, path: str):\n        """Constructs the NetworkX representation."""\n        return True\n'
    },
    {
        "id": 2,
        "file": "app/agents/architect/router.py",
        "description": "New Architect endpoint (Missing Docs)",
        "content": 'def post_system_design(spec):\n    return {"status": "ok"}\n'
    },
    {
        "id": 3,
        "file": "app/core/sonar_client.py",
        "description": "Security Risk in scanner client",
        "content": '"""Sonar wrapper."""\ndef get_metrics():\n    api_key = "KACHOW_SECRET_123"\n    return api_key\n'
    },
    {
        "id": 4,
        "file": "app/agents/guardian/models.py",
        "description": "Clean Pydantic Models",
        "content": '"""Guardian models."""\nfrom pydantic import BaseModel\nclass ReviewRequest(BaseModel):\n    """Request schema for code review."""\n    file_name: str\n    code_content: str\n'
    },
    {
        "id": 5,
        "file": "app/agents/mentor/service.py",
        "description": "Mentor advice logic (No Docs)",
        "content": 'class Mentor:\n    def analyze_patterns(self, data):\n        for item in data:\n            process(item)\n'
    }
]

def simulate_prs():
    print("=== Simulating Task 1: 5 PR Scenarios ===")
    
    # Path to the audit log we verified earlier
    log_path = os.path.join("storage", "guardian_audit.log")
    if os.path.exists(log_path):
        os.remove(log_path) # Clear old logs for clean simulation
        print(f"Cleared existing log: {log_path}")

    for s in SCENARIOS:
        print(f"\n[PR #{s['id']}] Processing {s['file']} ({s['description']})")
        
        # Trigger the Guardian's multi-layered review
        # Note: We use a try-except because real LLM calls might fail in this environment
        try:
            # We wrap the service call to ensure it logs even if the LLM is unavailable
            # The service.review_code already calls structural_audit and health_check internally
            review = guardian_service.review_code(s['file'], s['content'], "simulation_repo")
            
            status = "PASSED" if review.passed else "BLOCKED"
            print(f"Result: {status}")
            print(f"Decision: {review.message}")
            if review.issues:
                print(f"Issues: {len(review.issues)}")
                
        except Exception as e:
            print(f"Simulation error for PR #{s['id']}: {e}")

    print("\n=== Simulation Complete ===")
    print(f"Checking {log_path} for decision trail...")
    
    if os.path.exists(log_path):
        with open(log_path, "r") as f:
            lines = f.readlines()
            print(f"Found {len(lines)} records in audit log.")
            for i, line in enumerate(lines[-5:]):
                data = json.loads(line)
                print(f"Log {i+1}: {data['file_name']} -> Passed: {data['passed']}")

if __name__ == "__main__":
    simulate_prs()
