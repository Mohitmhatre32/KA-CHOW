from fastapi import APIRouter, Request, Header, HTTPException
import hmac
import hashlib
import json
from .service import guardian_service
from app.core.config import settings

router = APIRouter()

@router.post("/webhook/github")
async def github_webhook(
    request: Request,
    x_github_event: str = Header(None),
    x_hub_signature_256: str = Header(None)
):
    """
    Task 1: GitHub PR Listener.
    Registers 'opened' and 'synchronize' events.
    """
    body = await request.body()
    
    # 1. Verify Signature (Security)
    if not _verify_signature(body, x_hub_signature_256):
        raise HTTPException(status_code=401, detail="Invalid signature")

    payload = json.loads(body)
    action = payload.get("action")
    
    # We only care about PR creation or new commits (synchronize)
    if x_github_event == "pull_request" and action in ["opened", "synchronize"]:
        pr_number = payload["pull_request"]["number"]
        repo_full_name = payload["repository"]["full_name"]
        diff_url = payload["pull_request"]["diff_url"]
        
        print(f"[Guardian:Webhook] PR #{pr_number} {action} in {repo_full_name}")
        
        # In a real system, we would:
        # 1. Download the diff
        # 2. Extract changed files
        # 3. Call guardian_service.review_code for each
        # 4. Post comments via GitHub API
        
        # Stubbing the enforcement for demonstration
        # (This would ideally move to a background task)
        return {"status": "processing", "pr": pr_number}

    return {"status": "ignored"}

def _verify_signature(payload_body: bytes, signature_header: str) -> bool:
    if not signature_header or not settings.GITHUB_WEBHOOK_SECRET:
        return True # Skip if secret not set for dev
    
    hash_object = hmac.new(
        settings.GITHUB_WEBHOOK_SECRET.encode(),
        msg=payload_body,
        digestmod=hashlib.sha256
    )
    expected_signature = "sha256=" + hash_object.hexdigest()
    return hmac.compare_digest(expected_signature, signature_header)
