import requests
import json
import os

BASE_URL = "http://127.0.0.1:8000"

def test_generate_docs():
    print("Testing Industry-Level Documentation Generator...")
    
    # We need a project that has been processed. 
    # Let's use 'KA-CHOW' if it exists in storage, or try a known local path.
    project_name = "KA-CHOW" 
    
    payload = {
        "project_name": project_name,
        "repo_url": "c:\\Users\\HP\\OneDrive\\Desktop\\College\\Extra\\KA-CHOW"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/librarian/generate-docs", json=payload)
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print("Successfully received documentation!")
            print(f"Message: {data.get('message')}")
            markdown = data.get('markdown', '')
            print(f"Markdown length: {len(markdown)} characters")
            print("\n--- Preview ---")
            print(markdown[:500] + "...")
            
            # Verify file was written to disk
            repo_path = payload["repo_url"]
            guide_path = os.path.join(repo_path, "PROJECT_GUIDE.md")
            if os.path.exists(guide_path):
                print(f"\n✅ PROJECT_GUIDE.md verified on disk at: {guide_path}")
            else:
                print(f"\n❌ PROJECT_GUIDE.md NOT found on disk at: {guide_path}")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Connection failed: {e}. Is the server running?")

if __name__ == "__main__":
    test_generate_docs()
