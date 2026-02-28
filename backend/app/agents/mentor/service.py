import os
import re
import git
from git import Repo, InvalidGitRepositoryError
from typing import List, Optional
from groq import Groq

from app.core.config import settings
from app.core.sonar_client import sonar
from .models import (
    MentorChatRequest, MentorChatResponse,
    OnboardingStep, StarterQuest, TimelineEvent
)

# ─── Groq client ─────────────────────────────────────────────────────────────
_groq = Groq(api_key=settings.GROQ_API_KEY)

# ─── Commit-type prefix parser ────────────────────────────────────────────────
_COMMIT_TYPE_RE = re.compile(r'^(feat|fix|chore|docs|refactor|test|style|ci|build|perf)', re.IGNORECASE)


def _classify_commit(message: str) -> str:
    m = _COMMIT_TYPE_RE.match(message.strip())
    return m.group(1).lower() if m else "other"


# ─── Role-based onboarding paths ─────────────────────────────────────────────
_ONBOARDING_PATHS = {
    "backend": [
        OnboardingStep(
            id="be-1", task="Read the Core Config",
            description="Understand environment variables and settings in `app/core/config.py`.",
            is_completed=False
        ),
        OnboardingStep(
            id="be-2", task="Explore the Sonar Client",
            description="Review `app/core/sonar_client.py` to understand how code-quality metrics are fetched.",
            is_completed=False
        ),
        OnboardingStep(
            id="be-3", task="Study the Librarian Agent",
            description="Read `app/agents/librarian/service.py` to see how AST scanning + git history work.",
            is_completed=False
        ),
        OnboardingStep(
            id="be-4", task="Understand the LLM Layer",
            description="Check `app/core/llm.py` — the Groq-powered JSON generation utility used across agents.",
            is_completed=False
        ),
        OnboardingStep(
            id="be-5", task="Run the Backend Server",
            description="Execute `uvicorn app.main:app --reload` and hit `/docs` to explore all endpoints.",
            is_completed=False
        ),
    ],
    "frontend": [
        OnboardingStep(
            id="fe-1", task="Understand the API Layer",
            description="Study `frontend/lib/api.ts` — all backend calls go through typed fetch wrappers here.",
            is_completed=False
        ),
        OnboardingStep(
            id="fe-2", task="Explore the App Structure",
            description="Browse `frontend/app/` to understand the Next.js App Router page layout.",
            is_completed=False
        ),
        OnboardingStep(
            id="fe-3", task="Review Key Components",
            description="Check `frontend/components/` for reusable UI primitives (Graph, Cards, Chat windows).",
            is_completed=False
        ),
        OnboardingStep(
            id="fe-4", task="Check Global Styles",
            description="Open `frontend/app/globals.css` to understand the design tokens and Tailwind config.",
            is_completed=False
        ),
        OnboardingStep(
            id="fe-5", task="Run the Frontend Dev Server",
            description="Execute `npm run dev` in `frontend/` and open `http://localhost:3000`.",
            is_completed=False
        ),
    ],
    "sre": [
        OnboardingStep(
            id="sre-1", task="Review SonarQube Setup",
            description="Understand how SonarQube is configured via `SONAR_URL` and `SONAR_TOKEN` env vars.",
            is_completed=False
        ),
        OnboardingStep(
            id="sre-2", task="Inspect the Scanner Integration",
            description="See how `sonar.run_scanner()` triggers Docker-based SonarScanner CLI in `sonar_client.py`.",
            is_completed=False
        ),
        OnboardingStep(
            id="sre-3", task="Study Guardian Agent Alerts",
            description="Read `app/agents/guardian/` to understand automated code-quality alerting logic.",
            is_completed=False
        ),
        OnboardingStep(
            id="sre-4", task="Read the `.env` Template",
            description="Check `backend/.env` for all required secrets: GROQ_API_KEY, SONAR_TOKEN, etc.",
            is_completed=False
        ),
        OnboardingStep(
            id="sre-5", task="Review API Health Endpoint",
            description="Hit `GET /` to confirm all agents are ONLINE. Understand the alert system at `GET /api/alerts`.",
            is_completed=False
        ),
    ],
}


# ─── XP reward map by severity ───────────────────────────────────────────────
_XP_MAP = {"BLOCKER": 500, "CRITICAL": 300, "MAJOR": 150, "MINOR": 75, "INFO": 25}


class MentorService:
    """The Mentor Agent — combines Groq RAG with live SonarQube context to onboard engineers."""

    # ── 1. RAG Chat ──────────────────────────────────────────────────────────
    def ask(self, request: MentorChatRequest) -> MentorChatResponse:
        """Answer a developer question, enriching context with live Sonar metrics and architecture maps."""
        project_key = "CODESIB"
        repo_path = None
        arch_map = ""

        if request.repo_url:
            project_key = request.repo_url.rstrip("/").split("/")[-1].replace(".git", "")
            repo_path = os.path.join(settings.REPO_STORAGE_PATH, project_key)
            
            # Try to read the architecture map generated by Librarian
            map_file = os.path.join(repo_path, "_kachow_architecture_map.md")
            if os.path.exists(map_file):
                try:
                    with open(map_file, "r", encoding="utf-8") as f:
                        arch_map = f.read()
                except:
                    pass

        sonar_stats = sonar.get_project_metrics(project_key=project_key)

        system_prompt = f"""You are KA-CHOW Mentor, an expert software engineering coach embedded in the CODESIB platform.
You are talking to a **{request.user_role}** engineer.

### 📊 Live Codebase Health (from SonarQube)
- Bugs: {sonar_stats.get('bugs', 'N/A')}
- Vulnerabilities: {sonar_stats.get('vulnerabilities', 'N/A')}
- Code Smells: {sonar_stats.get('code_smells', 'N/A')}
- Coverage: {sonar_stats.get('coverage', 'N/A')}%
- Quality Gate: {sonar_stats.get('quality_gate', 'N/A')}

{"### 🗺️ Repository Architecture Map" if arch_map else ""}
{arch_map}

Use this data to give actionable, specific, and encouraging answers. Keep your response clean and professional. Use basic markdown like **bold** for emphasis and code blocks for snippets to ensure the response looks like normal, well-formatted text. Avoid over-using complex markup. Be concise and direct. """

        try:
            completion = _groq.chat.completions.create(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": request.question},
                ],
                model="llama-3.3-70b-versatile",
                max_tokens=1024,
            )
            answer = completion.choices[0].message.content or "I couldn't generate a response."
        except Exception as e:
            answer = f"⚠️ LLM Error: {e}"

        return MentorChatResponse(
            answer=answer,
            sources=["app/core/sonar_client.py", "_kachow_architecture_map.md"] if arch_map else ["app/core/sonar_client.py"],
            sonar_stats=sonar_stats,
        )

    # ── 2. Daily Quest ───────────────────────────────────────────────────────
    def get_starter_quest(self, repo_url: Optional[str] = None) -> StarterQuest:
        """Fetch the easiest open SonarQube issue and gamify it as a quest."""
        project_key = "CODESIB"
        if repo_url:
            project_key = repo_url.rstrip("/").split("/")[-1].replace(".git", "")

        try:
            url = f"{sonar.base_url}/api/issues/search"
            params = {
                "componentKeys": project_key,
                "statuses": "OPEN",
                "severities": "MINOR,INFO",
                "ps": 1,  # page size — we only need the first issue
                "p": 1,
            }
            import requests
            res = requests.get(url, params=params, auth=(sonar.token, ""), timeout=5)

            if res.status_code == 200:
                issues = res.json().get("issues", [])
                if issues:
                    issue = issues[0]
                    severity = issue.get("severity", "MINOR")
                    component = issue.get("component", "").split(":")[-1]
                    return StarterQuest(
                        title=f"🔧 Fix: {issue.get('message', 'Code smell detected')[:60]}",
                        issue_description=issue.get("message", "A code quality issue was found."),
                        file_path=component or "Unknown file",
                        xp_reward=_XP_MAP.get(severity, 50),
                        sonar_link=f"{sonar.base_url}/project/issues?id={project_key}&open={issue.get('key')}",
                    )
        except Exception as e:
            print(f"⚠️ Quest fetch failed: {e}")

        # Fallback quest
        return StarterQuest(
            title="🌱 Explore the Codebase",
            issue_description="Read the architecture map and understand the agent pattern used across the project.",
            file_path="backend/app/agents/",
            xp_reward=25,
            sonar_link=f"{sonar.base_url}/projects",
        )

    # ── 3. Onboarding Path ───────────────────────────────────────────────────
    def get_onboarding_path(self, role: str) -> List[OnboardingStep]:
        """Return role-specific onboarding checklist."""
        key = role.lower().strip()
        return _ONBOARDING_PATHS.get(key, _ONBOARDING_PATHS["backend"])

    # ── 4. Git Timeline ──────────────────────────────────────────────────────
    def get_git_history(self, repo_url: Optional[str] = None) -> List[TimelineEvent]:
        """Fetch last 15 commits from the specified or current git repo."""
        candidates = []
        if repo_url:
            repo_name = repo_url.rstrip("/").split("/")[-1].replace(".git", "")
            candidates.append(os.path.join(settings.REPO_STORAGE_PATH, repo_name))
        
        candidates.extend([
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "..")),
            settings.REPO_STORAGE_PATH,
        ])

        repo: Optional[Repo] = None
        for path in candidates:
            try:
                if not os.path.exists(path): continue
                repo = Repo(path, search_parent_dirs=True)
                break
            except (InvalidGitRepositoryError, Exception):
                continue

        if repo is None:
            return _fallback_timeline()

        try:
            commits = list(repo.iter_commits(max_count=15))
            events: List[TimelineEvent] = []
            for c in commits:
                msg = c.message.strip().split("\n")[0]
                events.append(TimelineEvent(
                    sha=c.hexsha[:7],
                    author=c.author.name,
                    date=c.committed_datetime.strftime("%b %d, %Y · %H:%M"),
                    message=msg,
                    type=_classify_commit(msg),
                ))
            return events
        except Exception as e:
            print(f"⚠️ Git history fetch failed: {e}")
            return _fallback_timeline()


def _fallback_timeline() -> List[TimelineEvent]:
    """Returns placeholder timeline when git is unavailable."""
    samples = [
        ("feat", "Initial commit: KA-CHOW enterprise brain"),
        ("feat", "feat: add Librarian agent with AST scanning"),
        ("feat", "feat: integrate SonarQube scanner pipeline"),
        ("fix", "fix: resolve CORS issues on FastAPI"),
        ("feat", "feat: Guardian agent with real-time alerts"),
        ("feat", "feat: Architect agent for project scaffolding"),
        ("chore", "chore: refactor core config settings"),
        ("docs", "docs: update README with agent descriptions"),
    ]
    events = []
    for i, (t, msg) in enumerate(samples):
        events.append(TimelineEvent(
            sha=f"abc{i:04d}",
            author="KA-CHOW Dev",
            date="Feb 22, 2026 · 06:00",
            message=msg,
            type=t,
        ))
    return events


mentor_service = MentorService()
