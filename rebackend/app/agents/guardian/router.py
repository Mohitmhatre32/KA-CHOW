import os
import json
from fastapi import APIRouter, HTTPException
from typing import Dict, List

from .models import ReviewRequest, PRReviewResponse, HealRequest, AutoHealResponse, SaveRequest
from .service import guardian_service

router = APIRouter()

@router.post("/review", response_model=PRReviewResponse, summary="LLM Code Review")
async def review_code(request: ReviewRequest):
    print(f"\n[Guardian] POST /review -> file={request.file_name}")
    try:
        return guardian_service.review_code(request.file_name, request.code_content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/heal", response_model=AutoHealResponse, summary="Auto-Heal Code")
async def heal_code(request: HealRequest):
    print(f"\n[Guardian] POST /heal -> file={request.file_name}")
    try:
        return guardian_service.heal_code(request.file_name, request.code_content, request.issues)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/save", summary="Save File to Disk")
async def save_file(request: SaveRequest):
    print(f"\n[Guardian] POST /save -> path={request.file_path[:50]}...")
    try:
        success = guardian_service.save_file(request.file_path, request.content)
        return {"success": success, "message": "File saved successfully."}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/audit", summary="Get PR Review Audit Logs")
async def get_audit_logs():
    """
    Reads the guardian_audit.log file and returns all records as a JSON list.
    """
    from .service import _AUDIT_LOG
    if not os.path.exists(_AUDIT_LOG):
        return []
    
    logs = []
    try:
        with open(_AUDIT_LOG, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    logs.append(json.loads(line))
        return logs[::-1] # Return most recent first
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read audit log: {e}")
