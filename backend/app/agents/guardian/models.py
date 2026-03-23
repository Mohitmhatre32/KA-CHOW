from typing import List
from pydantic import BaseModel

class ReviewRequest(BaseModel):
    file_name: str
    code_content: str

class PRReviewResponse(BaseModel):
    passed: bool
    issues: List[str]
    message: str

class HealRequest(BaseModel):
    file_name: str
    code_content: str
    issues: List[str]

class AutoHealResponse(BaseModel):
    fixed_code: str
    message: str

class SaveRequest(BaseModel):
    file_path: str
    content: str
