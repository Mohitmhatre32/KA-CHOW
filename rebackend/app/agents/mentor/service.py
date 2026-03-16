import os
import re
from typing import List, Optional, Dict, Any
from app.core.config import settings
from app.core.sonar_client import sonar
from app.core.llm import client as _groq
from .models import (
    MentorChatRequest, MentorChatResponse,
    OnboardingStep, StarterQuest, TimelineEvent
)

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
            id="be-2", task="Review Project Models",
            description="Study the Pydantic models in each agent's directory (e.g. `app/agents/librarian/models.py`).",
            is_completed=False
        ),
        OnboardingStep(
            id="be-3", task="Study the Librarian Agent",
            description="Read `app/agents/librarian/service.py` to see the core graph and RAG indexing pipeline.",
            is_completed=False
        ),
        OnboardingStep(
            id="be-4", task="Understand the LLM Layer",
            description="Check `app/core/llm.py` — the Groq-powered completion helpers used across the brain.",
            is_completed=False
        ),
        OnboardingStep(
            id="be-5", task="Run the Backend Server",
            description="Execute `docker restart kachow_api` and explore `/docs` for the Swagger UI.",
            is_completed=False
        ),
    ],
    "frontend": [
        OnboardingStep(
            id="fe-1", task="Explore index.html",
            description="Study `app/static/index.html` — the main dashboard that orchestrates all agent views.",
            is_completed=False
        ),
        OnboardingStep(
            id="fe-2", task="Understand the API Handlers",
            description="Browse the `<script>` tags in `index.html` to see how fetch calls hit the backend agents.",
            is_completed=False
        ),
        OnboardingStep(
            id="fe-3", task="Review D3.js Graph logic",
            description="Check the `updateGraph` function to see how the Librarian's knowledge graph is rendered.",
            is_completed=False
        ),
        OnboardingStep(
            id="fe-4", task="Check Design Tokens",
            description="Review the CSS variables at the top of `index.html` for the KA-CHOW theme.",
            is_completed=False
        ),
        OnboardingStep(
            id="fe-5", task="Test Agent Interactivity",
            description="Try scaffolding a project in the Architect tab and see it auto-load into the graph.",
            is_completed=False
        ),
    ],
    "sre": [
        OnboardingStep(
            id="sre-1", task="Review Config Logic",
            description="Understand how settings are loaded from `.env` in `app/core/config.py`.",
            is_completed=False
        ),
        OnboardingStep(
            id="sre-2", task="Inspect Docker Setup",
            description="Review the `Dockerfile` and container orchestration for the KA-CHOW stack.",
            is_completed=False
        ),
        OnboardingStep(
            id="sre-3", task="Study Alerting System",
            description="Read `app/core/alerts.py` to see how cross-agent notifications are handled.",
            is_completed=False
        ),
        OnboardingStep(
            id="sre-4", task="Verify Jira Sync",
            description="Ensure `JIRA_URL` and tokens are set in `.env` for the Architect's Jira integration.",
            is_completed=False
        ),
        OnboardingStep(
            id="sre-5", task="Check API Health",
            description="Hit `GET /health` to confirm the status of Librarian, Architect, Guardian, and Mentor.",
            is_completed=False
        ),
    ],
}


# ─── XP reward map by severity ───────────────────────────────────────────────
_XP_MAP = {"BLOCKER": 500, "CRITICAL": 300, "MAJOR": 150, "MINOR": 75, "INFO": 25}


class MentorService:
    """The Mentor Agent — combines Groq RAG with live codebase context to onboard engineers."""

    def ask(self, request: MentorChatRequest) -> MentorChatResponse:
        """Answer a developer question using RAG over the persisted architecture and metrics."""
        project_name = "KA-CHOW"
        repo_path = None
        arch_map = ""
        readme_content = ""
        prd_content = ""

        if request.repo_url:
            # Resolve repo path
            if request.repo_url.startswith("http"):
                project_name = request.repo_url.rstrip("/").split("/")[-1].replace(".git", "")
                repo_path = os.path.join(settings.REPO_STORAGE_PATH, project_name)
            else:
                repo_path = request.repo_url
                project_name = os.path.basename(repo_path.rstrip("/\\"))

            if os.path.isdir(repo_path):
                # Context 1: Architecture Map
                map_file = os.path.join(repo_path, "_kachow_architecture_map.md")
                if os.path.exists(map_file):
                    try:
                        with open(map_file, "r", encoding="utf-8") as f:
                            arch_map = f.read()
                    except: pass

                # Context 2: README
                readme_file = os.path.join(repo_path, "README.md")
                if os.path.exists(readme_file):
                    try:
                        with open(readme_file, "r", encoding="utf-8") as f:
                            readme_content = f.read()
                    except: pass
                
                # Context 3: PRD
                prd_file = os.path.join(repo_path, "PRD.md")
                if os.path.exists(prd_file):
                    try:
                        with open(prd_file, "r", encoding="utf-8") as f:
                            prd_content = f.read()
                    except: pass

        # Context 4: Sonar Metrics
        sonar_stats = sonar.get_project_metrics(project_key=project_name)

        system_prompt = f"""You are KA-CHOW Mentor, an expert software engineering coach.
You are talking to a **{request.user_role}** engineer.

### 📊 Codebase Health (SonarQube)
- Bugs: {sonar_stats.get('bugs', 'N/A')}
- Vulnerabilities: {sonar_stats.get('vulnerabilities', 'N/A')}
- Code Smells: {sonar_stats.get('code_smells', 'N/A')}
- Coverage: {sonar_stats.get('coverage', 'N/A')}%
- Quality Gate: {sonar_stats.get('quality_gate', 'N/A')}

{"### 🗺️ Architecture Map" if arch_map else ""}
{arch_map}

{"### 📚 README" if readme_content else ""}
{readme_content}

{"### 📋 PRD" if prd_content else ""}
{prd_content}

Use this data to give actionable, specific, and precise answers. Base your logic on the provided context. If data is missing, guide them with best practices but clarify what's unknown. Format using rich markdown.
"""

        try:
            completion = _groq.chat.completions.create(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": request.question},
                ],
                model=settings.LLM_MODEL,
                max_tokens=1024,
            )
            answer = completion.choices[0].message.content or "I couldn't generate a response."
        except Exception as e:
            answer = f"⚠️ LLM Error: {e}"

        sources = []
        if arch_map: sources.append("_kachow_architecture_map.md")
        if readme_content: sources.append("README.md")
        if prd_content: sources.append("PRD.md")
        if not sources: sources.append("Live SonarQube API")

        return MentorChatResponse(
            answer=answer,
            sources=sources,
            sonar_stats=sonar_stats,
        )

    def get_starter_quest(self, repo_url: Optional[str] = None) -> StarterQuest:
        """Fetch the easiest open issue from the local analysis cache and gamify it."""
        project_key = "KA-CHOW"
        if repo_url:
            if repo_url.startswith("http"):
                project_key = repo_url.rstrip("/").split("/")[-1].replace(".git", "")
            else:
                project_key = os.path.basename(repo_url.rstrip("/\\"))

        try:
            # New LocalCodeAnalyzer cache format:
            # sonar._cache[project_key] = { "_files": { "path/to/file.py": { "bugs": 1, ... } }, ... }
            cache = sonar._cache.get(project_key, {})
            files = cache.get("_files", {})

            # Find the file with the most issues to create a quest
            worst_file = None
            max_issues = 0
            issue_type = "smell"

            for filepath, metrics in files.items():
                bugs = metrics.get("bugs", 0)
                vulns = metrics.get("vulnerabilities", 0)
                smells = metrics.get("code_smells", 0)
                
                total = bugs + vulns + smells
                if total > max_issues:
                    max_issues = total
                    worst_file = filepath
                    if vulns > 0: issue_type = "vulnerability"
                    elif bugs > 0: issue_type = "bug"
                    else: issue_type = "smell"

            if worst_file:
                title_map = {
                    "vulnerability": "🛡️ Security: Fix Vulnerabilities",
                    "bug": "🐛 Bug Hunt: Squish the Bugs",
                    "smell": "🧹 Code Janitor: Clean up Smells"
                }
                xp_map = {
                    "vulnerability": _XP_MAP["CRITICAL"],
                    "bug": _XP_MAP["MAJOR"],
                    "smell": _XP_MAP["MINOR"]
                }
                
                return StarterQuest(
                    title=f"{title_map[issue_type]} in {os.path.basename(worst_file)}",
                    issue_description=f"Local analysis found {max_issues} issue(s) in this file. Review the code and improve its quality.",
                    file_path=worst_file,
                    xp_reward=xp_map[issue_type],
                    sonar_link="#", # Local analysis has no web UI link
                )
        except Exception as e:
            print(f"⚠️ Quest fetch failed: {e}")

        return StarterQuest(
            title="🌱 Explore the Codebase",
            issue_description="Read the architecture map and understand the agent patterns used in this project. Everything looks clean for now!",
            file_path="app/agents/",
            xp_reward=25,
            sonar_link="#",
        )

    def get_onboarding_path(self, role: str) -> List[OnboardingStep]:
        """Return role-specific onboarding checklist."""
        key = role.lower().strip()
        return _ONBOARDING_PATHS.get(key, _ONBOARDING_PATHS["backend"])

    def get_git_history(self, repo_url: Optional[str] = None) -> List[TimelineEvent]:
        """Fetch last 15 commits for the Time Machine view."""
        import git
        from git import Repo, InvalidGitRepositoryError

        repo_path = None
        if repo_url:
            if repo_url.startswith("http"):
                repo_name = repo_url.rstrip("/").split("/")[-1].replace(".git", "")
                repo_path = os.path.join(settings.REPO_STORAGE_PATH, repo_name)
            else:
                repo_path = repo_url
        
        if not repo_path or not os.path.isdir(repo_path):
            repo_path = settings.BASE_DIR

        try:
            repo = Repo(repo_path, search_parent_dirs=True)
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
        except (InvalidGitRepositoryError, Exception) as e:
            print(f"⚠️ Git history fetch failed: {e}")
            return self._fallback_timeline()

    def _fallback_timeline(self) -> List[TimelineEvent]:
        samples = [
            ("feat", "Initial commit: KA-CHOW enterprise brain"),
            ("feat", "feat: add Librarian agent with AST scanning"),
            ("feat", "feat: Architect agent for enterprise scaffolding"),
            ("fix", "fix: resolve Jira sync authorization issues"),
            ("feat", "feat: Guardian agent with quality gate alerts"),
            ("docs", "docs: update system architecture map"),
        ]
        events = []
        for i, (t, msg) in enumerate(samples):
            events.append(TimelineEvent(
                sha=f"bf{i:04d}",
                author="KA-CHOW Dev",
                date="Mar 14, 2026 · 12:00",
                message=msg,
                type=t,
            ))
        return events

mentor_service = MentorService()
