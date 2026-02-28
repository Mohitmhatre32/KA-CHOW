import traceback
from fastapi import APIRouter, HTTPException
from typing import List

from .models import (
    MentorChatRequest, MentorChatResponse,
    OnboardingStep, StarterQuest, TimelineEvent
)
from .service import mentor_service

router = APIRouter()


# ── POST /chat ────────────────────────────────────────────────────────────────
@router.post("/chat", response_model=MentorChatResponse)
async def chat_with_mentor(request: MentorChatRequest):
    """
    RAG-powered Q&A endpoint.
    Combines Groq LLM response with live SonarQube project metrics.
    """
    try:
        return mentor_service.ask(request)
    except Exception as e:
        print("\n❌ CRASH IN MENTOR CHAT ❌")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /onboarding/{role} ────────────────────────────────────────────────────
@router.get("/onboarding/{role}", response_model=List[OnboardingStep])
async def get_onboarding(role: str):
    """
    Returns a curated onboarding checklist for the given role.
    Supported roles: Backend, Frontend, SRE (case-insensitive).
    """
    try:
        return mentor_service.get_onboarding_path(role)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /quest ────────────────────────────────────────────────────────────────
@router.get("/quest", response_model=StarterQuest)
async def get_daily_quest(repo_url: str = None):
    """
    Returns the lowest-complexity open SonarQube issue as a gamified quest.
    """
    try:
        return mentor_service.get_starter_quest(repo_url)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /timeline ─────────────────────────────────────────────────────────────
@router.get("/timeline", response_model=List[TimelineEvent])
async def get_timeline(repo_url: str = None):
    """
    Returns the last 15 git commits formatted for the Architecture Time Machine.
    """
    try:
        return mentor_service.get_git_history(repo_url)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
