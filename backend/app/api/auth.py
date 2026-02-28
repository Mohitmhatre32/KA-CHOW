from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import requests
import os

router = APIRouter()

GITHUB_CLIENT_ID = os.environ.get("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.environ.get("GITHUB_CLIENT_SECRET", "")

class GithubTokenRequest(BaseModel):
    code: str

class GithubReposRequest(BaseModel):
    token: str

@router.get("/client-id")
async def get_client_id():
    return {"client_id": GITHUB_CLIENT_ID}

@router.post("/token")
async def exchange_token(req: GithubTokenRequest):
    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="GitHub OAuth credentials not configured on backend.")
    
    response = requests.post(
        "https://github.com/login/oauth/access_token",
        data={
            "client_id": GITHUB_CLIENT_ID,
            "client_secret": GITHUB_CLIENT_SECRET,
            "code": req.code
        },
        headers={"Accept": "application/json"}
    )
    
    if response.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to get token from GitHub")
        
    data = response.json()
    if "error" in data:
        raise HTTPException(status_code=400, detail=data["error_description"])
        
    return {"access_token": data.get("access_token")}

@router.post("/repos")
async def get_user_repos(req: GithubReposRequest):
    headers = {
        "Authorization": f"Bearer {req.token}",
        "Accept": "application/vnd.github.v3+json"
    }
    
    # We fetch repositories that the user has access to.
    response = requests.get(
        "https://api.github.com/user/repos?per_page=100&sort=updated",
        headers=headers
    )
    
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail="Failed to fetch repositories")
        
    return response.json()
