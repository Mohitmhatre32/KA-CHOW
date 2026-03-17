import requests
import time
import json

BASE_URL = "http://127.0.0.1:8000"
WEBHOOK_URL = f"{BASE_URL}/api/guardian/webhook/github"

def simulate_pr(pr_number, action="opened"):
    payload = {
        "action": action,
        "pull_request": {
            "number": pr_number,
            "changed_files": 2,
            "diff_url": f"https://github.com/test/repo/pull/{pr_number}.diff"
        },
        "repository": {
            "full_name": "test-owner/test-repo"
        }
    }
    
    headers = {
        "X-GitHub-Event": "pull_request",
        "Content-Type": "application/json"
    }
    
    print(f"--- Simulating PR #{pr_number} [{action}] ---")
    try:
        response = requests.post(WEBHOOK_URL, json=payload, headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
    except Exception as e:
        print(f"Error: {e}")
    print("-" * 40)

def main():
    print("🚀 Starting Guardian Prototype Simulation (Task 1)")
    print("This will simulate 5 Pull Request events to verify automated enforcement.\n")
    
    for i in range(1, 6):
        simulate_pr(i)
        time.sleep(1) # Small delay
    
    print("\n✅ Simulation complete.")
    print("Please check 'rebackend/storage/guardian_audit.log' for enforcement decisions.")

if __name__ == "__main__":
    main()
