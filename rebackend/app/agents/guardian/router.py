from fastapi import APIRouter, HTTPException
from typing import Dict

from .models import ReviewRequest, PRReviewResponse, HealRequest, AutoHealResponse, SaveRequest
from .service import guardian_service

router = APIRouter()

@router.post("/review", response_model=PRReviewResponse, summary="LLM Code Review")
async def review_code(request: ReviewRequest):
    """
    Submits a file's content to the LLM for quality analysis.
    Checks for missing docstrings, types, unused vars, and security smells.
    """
    try:
        return guardian_service.review_code(request.file_name, request.code_content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/heal", response_model=AutoHealResponse, summary="Auto-Heal Code")
async def heal_code(request: HealRequest):
    """
    Submits code and a list of issues to the LLM to generate a fully repaired version.
    """
    try:
        return guardian_service.heal_code(request.file_name, request.code_content, request.issues)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/save", summary="Save File to Disk")
async def save_file(request: SaveRequest):
    """
    Safely writes content to the absolute file path, preventing directory traversal.
    """
    try:
        success = guardian_service.save_file(request.file_path, request.content)
        return {"success": success, "message": "File saved successfully."}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
