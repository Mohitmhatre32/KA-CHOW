from pydantic import BaseModel
from typing import List, Dict, Any, Optional


class MentorChatRequest(BaseModel):
    question: str
    user_role: str  # e.g. "Backend", "Frontend", "SRE"
    repo_url: Optional[str] = None


class MentorChatResponse(BaseModel):
    answer: str
    sources: List[str] = []
    sonar_stats: Dict[str, Any] = {}


class OnboardingStep(BaseModel):
    id: str
    task: str
    description: str
    is_completed: bool = False


class StarterQuest(BaseModel):
    title: str
    issue_description: str
    file_path: str
    xp_reward: int
    sonar_link: str


class TimelineEvent(BaseModel):
    sha: str
    author: str
    date: str
    message: str
    type: str  # 'feat', 'fix', 'chore', 'docs', 'refactor', 'test', 'other'
