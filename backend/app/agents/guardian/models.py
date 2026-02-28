from pydantic import BaseModel

class PRReviewRequest(BaseModel):
    file_name: str
    code_content: str

class PRReviewResponse(BaseModel):
    status: str # "PASSED" or "BLOCKED"
    issues_found: list
    message: str

class AutoHealRequest(BaseModel):
    file_name: str
    code_content: str
    issues: list

class AutoHealResponse(BaseModel):
    fixed_code: str
    message: str

class EditorSaveRequest(BaseModel):
    file_path: str
    content: str
    project_key: str # For Sonar

class EditorResponse(BaseModel):
    status: str # "COMMITTED" or "REJECTED"
    quality_gate: str
    message: str
    sonar_metrics: dict