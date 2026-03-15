"""
Librarian Router — all endpoints backed by the LibrarianService pipeline.
"""
import traceback
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query

from .models import ProcessRequest, GraphResponse, CommitInfo, IncrementalUpdateRequest, GithubSyncResult
from .service import librarian

router = APIRouter()


@router.post("/process", response_model=GraphResponse, summary="Load & process a repository")
async def process_repository(request: ProcessRequest):
    print(f"\n[Router] POST /librarian/process -> source={request.input_source}")
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
    print(f"\n[Router] GET /librarian/branches -> url={repo_url}")
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


@router.get("/sync-github", response_model=GithubSyncResult, summary="Sync commits and Pull Requests")
async def sync_github_data(
    input_source: str = Query(..., description="Repo URL or local path"),
    max_count: int = Query(15, ge=1, le=50),
):
    print(f"\n[Router] GET /librarian/sync-github -> source={input_source}")
    """
    Fast-sync endpoint for GitHub data.
    Retrieves commits instantly from local git history.
    Fetches latest Pull Requests directly from the GitHub API.
    """
    try:
        return librarian.sync_github(input_source, max_count=max_count)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"GitHub sync failed: {e}")


@router.get("/history", response_model=List[CommitInfo], summary="Recent git commits")
async def get_commit_history(
    input_source: str = Query(..., description="Repo URL or local path"),
    max_count: int = Query(15, ge=1, le=50),
):
    print(f"\n[Router] GET /librarian/history -> source={input_source}")
    """Returns the last N commits with type classification (feat/fix/chore…)."""
    try:
        return librarian.get_commit_history(input_source, max_count=max_count)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/incremental-update", summary="⚡ Incremental Brain — delta re-index only changed files")
async def incremental_update(request: IncrementalUpdateRequest):
    """
    **The Incremental Brain (Task 3).**

    Instead of rescanning the entire project (which is slow), this endpoint:
    - Runs `git diff --name-only HEAD~1` to find only changed files
    - Re-chunks and re-embeds only those files into ChromaDB
    - Hot-swaps the dependency graph edges for the changed nodes
    - Returns a benchmark comparing update time vs a full-scan estimate

    Use this after committing a small change to keep the AI brain
    up-to-date in seconds rather than minutes.
    """
    try:
        result = librarian.incremental_update(request.repo_url)
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Incremental update failed: {e}")