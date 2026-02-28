import traceback
from fastapi import APIRouter, HTTPException
from .models import ScanRequest, GraphResponse, BranchRequest, FileRequest, CommitInfo, HistoryRequest, DocsRequest, DocsResponse
from .service import librarian
from typing import List
import os 
router = APIRouter()

@router.post("/branches", response_model=List[str])
async def get_repo_branches(request: BranchRequest):
    try:
        return librarian.get_branches(request.repo_url)
    except Exception as e:
        print("\n❌ CRASH IN BRANCHES ❌")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/scan", response_model=GraphResponse)
async def scan_codebase(request: ScanRequest):
    try:
        return librarian.process_request(request.input_source, request.branch)
    except Exception as e:
        print("\n❌ CRASH DETECTED IN LIBRARIAN SCANNER ❌")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/scan/trigger")
async def trigger_scan(request: ScanRequest):
    try:
        return librarian.trigger_sonar_scan(request.input_source, request.branch)
    except Exception as e:
        print("\n❌ CRASH IN TRIGGERING SCAN ❌")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/content", response_model=str)
async def get_content(request: FileRequest):
    """Fetches raw code for the IDE."""
    normalized_path = os.path.normpath(request.file_path)
    if not os.path.exists(normalized_path):
        print(f"❌ Backend Error: Tried to open {normalized_path} but it doesn't exist.")
        return f"# Error: File not found at {normalized_path}"
    return librarian.get_file_content(normalized_path)

@router.post("/history", response_model=List[CommitInfo])
async def get_history(request: HistoryRequest):
    """Returns the timeline of commits for the selected repo."""
    return librarian.get_commit_history(request.repo_url)

@router.post("/generate-docs", response_model=DocsResponse)
async def generate_docs_endpoint(request: DocsRequest):
    """Generates README and PRD for the project."""
    try:
        res = librarian.generate_docs(
            request.project_name, 
            request.project_root, 
            request.nodes, 
            request.edges
        )
        return DocsResponse(**res)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))