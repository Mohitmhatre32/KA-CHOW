import os
import sys
import json
import unittest.mock as mock

# Ensure we can import from app
sys.path.append(os.getcwd())

from app.agents.guardian.service import guardian_service
from app.core.config import settings
from app.core.sonar_client import sonar
from app.agents.librarian.service import librarian

def test_guardian():
    print("\n--- Testing Guardian Save Path Translation ---")
    docker_path = "/app/storage/repos/DataThon/backend/app/core/config.py"
    content = "# Test Content"
    
    with mock.patch("os.makedirs"), mock.patch("builtins.open", mock.mock_open()):
        success = guardian_service.save_file(docker_path, content)
        print(f"Input: {docker_path}")
        print(f"Success: {success}")
        if success:
            print("[PASS] Guardian Fix Verified!")
        else:
            print("[FAIL] Guardian Fix Failed!")

def test_scanner():
    print("\n--- Testing Local Quality Scanner ---")
    repo_path = os.path.join(settings.REPO_STORAGE_PATH, "DataThon")
    if not os.path.isdir(repo_path):
        print(f"Repo path not found: {repo_path}. Using rebackend root for test.")
        repo_path = os.getcwd()

    # Trigger scan via LibrarianService to verify metadata integration
    result = librarian.run_sonar_scan(repo_path)
    print(f"Librarian Scan Result: {result}")
    
    cache_file = os.path.join(repo_path, "_kachow_graph.json")
    if os.path.exists(cache_file):
        with open(cache_file, "r", encoding="utf-8") as f:
            graph_data = json.load(f)
            meta = graph_data.get("metadata", {})
            print(f"Graph Metadata: health={meta.get('system_health')}, gate={meta.get('quality_gate')}")
            
            if isinstance(meta.get("system_health"), dict) and meta.get("quality_gate"):
                print("[PASS] Librarian Metadata Integration Verified!")
            else:
                print("[FAIL] Librarian Metadata Integration Failed!")
    else:
        print("[SKIP] Graph cache not found for metadata verification.")

if __name__ == "__main__":
    test_guardian()
    test_scanner()
    print("\nVerification process finished.")
