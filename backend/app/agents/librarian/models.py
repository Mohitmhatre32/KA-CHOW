from pydantic import BaseModel
from typing import List, Dict, Any, Optional

# Add this model at the top
class FileRequest(BaseModel):
    file_path: str
    
class ScanRequest(BaseModel):
    input_source: str 
    branch: Optional[str] = "main"

class BranchRequest(BaseModel):
    repo_url: str

class FileNode(BaseModel):
    id: str
    label: str
    type: str # 'file' or 'folder'
    sonar_health: Dict[str, Any] 
    layer: str 

class SystemHealth(BaseModel):
    bugs: int = 0
    vulnerabilities: int = 0
    code_smells: int = 0
    coverage: float = 100.0
    security_hotspots: float = 100.0
    duplications: float = 0.0
    quality_gate: str = "PASSED"

class GraphResponse(BaseModel):
    project_name: str
    branch: str
    nodes: List[FileNode]
    edges: List[Dict[str, str]]
    health_score: float
    system_health: SystemHealth
    project_root: str 
    
class CommitInfo(BaseModel):
    hash: str
    message: str
    author: str
    date: str

class HistoryRequest(BaseModel):
    repo_url: str # To identify which repo to look at

# ─── Documentation Generator ──────────────────────────────────────────────────

class DocNode(BaseModel):
    id: str
    label: str
    type: str # 'file' or 'folder'
    layer: Optional[str] = "system"
    sonar_health: Optional[Dict[str, Any]] = None

class DocEdge(BaseModel):
    source: str
    target: str
    relation: str

class DocsRequest(BaseModel):
    project_name: str
    project_root: str
    nodes: List[DocNode]
    edges: List[DocEdge]

class DocsResponse(BaseModel):
    readme: str
    prd: str
    message: str
    
