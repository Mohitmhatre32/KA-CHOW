import os
import sys
import json
import time

# Ensure we can import from app
sys.path.append(os.getcwd())

from app.agents.guardian.service import guardian_service
from app.agents.librarian.service import librarian
from app.core.config import settings

def validate_task_1():
    print("\n=== Validating Task 1: Guardian Workflow ===")
    test_code = """
def calculate_sum(a, b):
    return a + b

class Calculator:
    def add(self, x, y):
        return x + y
    """
    print("[Task 1] Running structural audit on undocumented code...")
    result = guardian_service.structural_audit("test_calculator.py", test_code)
    print(f"[Task 1] Audit result: passed={result['passed']}, issues={result['issues']}")
    
    if not result['passed']:
        print("[Task 1] SUCCESS: Guardian correctly identified missing docstrings.")
    
    print("[Task 1] Checking audit log...")
    # Trigger a full review to see the log entry
    try:
        review = guardian_service.review_code("test_calculator.py", test_code, "test_repo")
        print(f"[Task 1] Review response: {review.message}")
    except Exception as e:
        print(f"[Task 1] Review failed (likely missing LLM keys): {e}")

def validate_task_2():
    print("\n=== Validating Task 2: Knowledge Graph ===")
    repo_path = os.path.join(settings.REPO_STORAGE_PATH, "DataThon")
    if not os.path.isdir(repo_path):
        repo_path = os.getcwd() # Fallback to rebackend root
        
    print(f"[Task 2] Building graph for: {repo_path}")
    # build_graph is internal, but process_request calls it. We'll use a local mock or call the builder.
    try:
        # We'll just call the builder directly to verify NetworkX usage
        graph_res, G, _, _, _ = librarian._build_graph(repo_path, "ValidationTest", "local")
        print(f"[Task 2] Graph built with {len(G.nodes)} nodes and {len(G.edges)} edges.")
        print(f"[Task 2] Sample Nodes: {list(G.nodes)[:5]}")
        if len(G.nodes) > 0:
             print("[Task 2] SUCCESS: NetworkX graph successfully generated.")
    except Exception as e:
        print(f"[Task 2] Graph build failed: {e}")

def validate_task_3():
    print("\n=== Validating Task 3: Incremental Update ===")
    repo_path = os.path.join(settings.REPO_STORAGE_PATH, "DataThon")
    if not os.path.isdir(repo_path):
        print("[Task 3] SKIP: No sample Git repo (DataThon) found for incremental test.")
        return

    print(f"[Task 3] Running incremental update on: {repo_path}")
    try:
        # This requires a cache file to exist
        cache_file = os.path.join(repo_path, "_kachow_graph.json")
        if not os.path.exists(cache_file):
            print("[Task 3] Re-running full scan to generate cache...")
            librarian.process_request(repo_path, force=True)
            
        result = librarian.incremental_update(repo_path)
        print(f"[Task 3] Update result: {result['message']}")
        if "update_time_seconds" in result:
            print(f"[Task 3] Benchmarked update time: {result['update_time_seconds']}s")
            if result['update_time_seconds'] < 10:
                print("[Task 3] SUCCESS: Update completed within <10s target.")
    except Exception as e:
        print(f"[Task 3] Incremental update failed: {e}")

if __name__ == "__main__":
    validate_task_1()
    validate_task_2()
    validate_task_3()
