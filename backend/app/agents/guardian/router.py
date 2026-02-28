from fastapi import APIRouter, HTTPException
from .models import PRReviewRequest, PRReviewResponse, AutoHealRequest, AutoHealResponse, EditorSaveRequest, EditorResponse
from .service import guardian

router = APIRouter()

@router.post("/review", response_model=PRReviewResponse)
async def review_pull_request(request: PRReviewRequest):
    """Intercepts code and blocks if dirty."""
    try:
        return guardian.review_pr(request.file_name, request.code_content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/heal", response_model=AutoHealResponse)
async def auto_heal(request: AutoHealRequest):
    """Rewrites bad code into clean code."""
    try:
        return guardian.auto_heal_code(request.file_name, request.code_content, request.issues)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@router.post("/save-check", response_model=EditorResponse)
async def save_and_check(request: EditorSaveRequest):
    """Saves file, checks Sonar, alerts team if bad, pushes if good."""
    return guardian.validate_and_push(request.file_path, request.content, request.project_key)