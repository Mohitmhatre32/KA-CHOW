from pydantic import BaseModel, Field
from typing import List, Dict, Optional

# --- Scaffolding ---
class BuildRequest(BaseModel):
    requirements: str
    project_name: str = "new_scaffold"

class BuildResponse(BaseModel):
    project_root: str
    files_created: List[str]
    message: str

# --- Impact Analysis ---
class ImpactRequest(BaseModel):
    target_file: str  # relative path
    proposed_change: str
    project_name: str

class ImpactNode(BaseModel):
    file_path: str
    severity: str  # "high", "medium", "low"
    reason: str

class ImpactResponse(BaseModel):
    impacted_files: List[ImpactNode]
    total_impacted: int
    blast_radius_depth: int

# --- Jira Integration ---
class JiraTicket(BaseModel):
    id: str
    key: str
    summary: str
    description: Optional[str] = None
    status: str

class JiraSyncRequest(BaseModel):
    ticket_key: str

class JiraCreateTasksRequest(BaseModel):
    parent_key: str
    tasks: List[str] # List of sub-task summaries based on impact

class JiraResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Dict] = None
