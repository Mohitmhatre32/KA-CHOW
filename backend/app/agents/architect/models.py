from pydantic import BaseModel
from typing import List

class ArchitectRequest(BaseModel):
    requirements: str 

class ArchitectResponse(BaseModel):
    status: str
    message: str
    files: List[str]
    blueprint_summary: str
    project_path: str

class ImpactAnalysisRequest(BaseModel):
    target_endpoint: str
    proposed_change: str
    repo_url: str

class AffectedService(BaseModel):
    name: str
    reason: str

class ImpactResult(BaseModel):
    severity: str # "high" | "medium" | "low"
    affected_services: List[AffectedService]
    summary: str