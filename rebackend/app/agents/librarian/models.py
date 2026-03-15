from pydantic import BaseModel
from typing import List, Dict, Optional

class ProcessRequest(BaseModel):
    input_source: str
    branch: str = "main"
    force: bool = False

class FileNode(BaseModel):
    id: str            # relative path
    label: str         # filename
    type: str          # "file" | "folder"
    layer: str         # "backend" | "frontend" | "system"
    language: Optional[str] = None
    size_bytes: Optional[int] = None

class GraphResponse(BaseModel):
    project_name: str
    branch: str
    nodes: List[FileNode]
    edges: List[dict]
    project_root: str
    processed_at: Optional[str] = None
    total_files: int
    total_chunks_embedded: Optional[int] = None
    documented_ratio: float
    from_cache: bool = False

class CommitInfo(BaseModel):
    hash: str
    message: str
    author: str
    date: str
    commit_type: str

class IncrementalUpdateRequest(BaseModel):
    """Request body for the incremental update endpoint."""
    repo_url: str                  # local path or remote URL (already cloned)

class IncrementalUpdateResult(BaseModel):
    """Result returned after a delta re-index run."""
    changed_files: List[str]       # files re-processed
    skipped_files: int             # unchanged files that were skipped
    total_files: int               # total file count in the project
    update_time_seconds: float     # benchmark — how long this took
    full_scan_baseline_seconds: float  # estimated baseline for comparison
    graph_updated: bool            # whether the graph cache was refreshed
    message: str                   # human-readable summary