from pydantic import BaseModel
from typing import Optional

class DiagramRequest(BaseModel):
    repo_url: str
    diagram_type: Optional[str] = "architecture"
    prompt_override: Optional[str] = None

class DiagramResponse(BaseModel):
    repo_url: str
    diagram_type: str
    mermaid_markdown: str
    message: str
