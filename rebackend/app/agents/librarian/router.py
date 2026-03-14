"""
Librarian Router — all endpoints backed by the LibrarianService pipeline.
"""
import traceback
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query

from .models import ProcessRequest, GraphResponse, CommitInfo
from .service import librarian

router = APIRouter()


@router.post("/process", response_model=GraphResponse, summary="Load & process a repository")
async def process_repository(request: ProcessRequest):
    """
    **Stage 1 of every workflow.**

    Runs the full file-processing pipeline:
    - Clones / pulls the repo (or validates a local path)
    - Walks the file tree and builds a dependency graph via AST analysis
    - Chunks each file and embeds into ChromaDB for RAG
    - Persists graph.json for instant cache hits on subsequent calls

    Set `force=true` to bypass the cache and re-process from scratch.
    """
    try:
        return librarian.process_request(
            input_source=request.input_source,
            branch=request.branch,
            force=request.force,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Pipeline failed: {e}")


@router.get("/branches", summary="List remote branches without cloning")
async def get_branches(repo_url: str = Query(..., description="GitHub repository URL")):
    """Quickly lists all remote branches using git ls-remote."""
    try:
        branches = librarian.get_branches(repo_url)
        return {"branches": branches}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/file", summary="Read raw content of a file")
async def get_file_content(full_path: str = Query(..., description="Absolute path to the file on disk")):
    """Returns the raw text content of any file that was loaded into the system."""
    content = librarian.get_file_content(full_path)
    if content.startswith("# Error:"):
        raise HTTPException(status_code=404, detail=content)
    return {"content": content, "path": full_path}


@router.get("/history", response_model=List[CommitInfo], summary="Recent git commits")
async def get_commit_history(
    input_source: str = Query(..., description="Repo URL or local path"),
    max_count: int = Query(15, ge=1, le=50),
):
    """Returns the last N commits with type classification (feat/fix/chore…)."""
    try:
        return librarian.get_commit_history(input_source, max_count=max_count)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))