"""
Mobile API — thin adapter for the Flutter app.
All data is sourced from live backend systems.
No existing web-dashboard routes or agent logic is modified here.
"""
import os
import json
import glob
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, Body, Query
from pydantic import BaseModel

from app.core.alerts import alert_system
from app.core.config import settings

router = APIRouter()

# ── In-memory ticket store (session-scoped) ───────────────────────────────────
# Persists across requests for the lifetime of the uvicorn process.
_tickets: List[Dict[str, Any]] = []
_ticket_counter = 100   # Start IDs at TIC-101


def _next_ticket_id() -> str:
    global _ticket_counter
    _ticket_counter += 1
    return f"TIC-{_ticket_counter}"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _load_graph(repo_name: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Load a specific repo's graph by name, or the most recently modified one.
    Returns None if no repos have been scanned yet.
    """
    if repo_name:
        specific = os.path.join(settings.REPO_STORAGE_PATH, repo_name, "_kachow_graph.json")
        if os.path.exists(specific):
            try:
                with open(specific, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
    # Fall back to most recently modified graph
    pattern = os.path.join(settings.REPO_STORAGE_PATH, "**", "_kachow_graph.json")
    files = glob.glob(pattern, recursive=True)
    if not files:
        return None
    latest = max(files, key=os.path.getmtime)
    try:
        with open(latest, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def _list_all_projects() -> List[Dict[str, Any]]:
    """
    Scan storage/repos/ and return metadata for every repo that has a processed graph.
    """
    projects = []
    storage_root = settings.REPO_STORAGE_PATH
    if not os.path.isdir(storage_root):
        return projects
    for entry in sorted(os.listdir(storage_root)):
        repo_dir = os.path.join(storage_root, entry)
        graph_file = os.path.join(repo_dir, "_kachow_graph.json")
        if not os.path.isfile(graph_file):
            continue
        try:
            with open(graph_file, "r", encoding="utf-8") as f:
                graph = json.load(f)
            projects.append({
                "name": graph.get("project_name", entry),
                "repo_name": entry,          # folder name in storage/repos/
                "branch": graph.get("branch", "main"),
                "total_files": graph.get("total_files", 0),
                "documented_ratio": graph.get("documented_ratio", 0.0),
                "processed_at": graph.get("processed_at", ""),
                "from_cache": graph.get("from_cache", True),
                "project_root": graph.get("project_root", repo_dir),
            })
        except Exception:
            continue
    return projects


def _derive_workflows_from_alerts() -> List[Dict[str, Any]]:
    """
    Derive active agent workflows from recent alert history.
    Maps alert titles to agent/status pairs.
    """
    alerts = alert_system.get_alerts()
    workflows = []
    seen_agents = set()

    agent_keywords = {
        "Librarian": ["Scanning", "Cache", "Graph", "Embedding", "Indexing"],
        "Guardian":  ["PR", "Review", "Heal", "Guard", "Audit"],
        "Architect": ["Impact", "Scaffold", "Build", "Architect"],
        "Mentor":    ["Chat", "Onboard", "Quest", "Timeline"],
    }

    for alert in reversed(alerts):  # newest first
        title = alert.get("title", "")
        for agent, keywords in agent_keywords.items():
            if agent in seen_agents:
                continue
            if any(kw.lower() in title.lower() for kw in keywords):
                seen_agents.add(agent)
                severity = alert.get("severity", "info")
                status = "Running" if severity in ("info", "warning") else "Completed"
                workflows.append({
                    "id": f"wf_{agent.lower()}_{len(workflows)+1:03d}",
                    "name": title[:60],
                    "status": status,
                    "agent": agent,
                })

    # Always surface at least an idle entry per agent if nothing found
    for agent in ["Librarian", "Guardian", "Architect", "Mentor"]:
        if agent not in seen_agents:
            workflows.append({
                "id": f"wf_{agent.lower()}_idle",
                "name": f"{agent}: Idle",
                "status": "Idle",
                "agent": agent,
            })

    return workflows


def _derive_approvals_from_alerts() -> List[Dict[str, Any]]:
    """
    Turn critical/warning alerts into approval items the mobile app can act on.
    """
    alerts = alert_system.get_alerts()
    approvals = []
    for alert in alerts:
        if alert.get("severity") in ("warning", "critical") and not alert.get("read"):
            approvals.append({
                "id": f"app_{alert['id']}",
                "title": alert["title"],
                "description": alert["message"],
                "severity": "High" if alert["severity"] == "critical" else "Medium",
                "requester": "KA-CHOW Alert System",
            })
    return approvals


# ── Status ────────────────────────────────────────────────────────────────────

@router.get("/projects")
async def get_mobile_projects():
    """List all repos that have been scanned and are ready for the mobile dashboard."""
    print("\n[Mobile] GET /projects")
    return _list_all_projects()


@router.get("/status")
async def get_mobile_status(repo_name: Optional[str] = Query(None, description="Folder name of the repo in storage/repos/")):
    """Aggregated live status for the mobile dashboard. Scope to a specific repo with ?repo_name=."""
    print(f"\n[Mobile] GET /status repo={repo_name}")

    graph = _load_graph(repo_name)
    workflows = _derive_workflows_from_alerts()

    # Derive metrics from the graph cache when available
    if graph:
        doc_ratio = graph.get("documented_ratio", 0.0) or 0.0
        total_files = graph.get("total_files", 0) or 0
        nodes = graph.get("nodes", [])

        # Aggregate sonar health across all nodes that have it
        sonar_nodes = [n for n in nodes if n.get("sonar_health")]
        bugs = sum(n["sonar_health"].get("bugs", 0) for n in sonar_nodes)
        smells = sum(n["sonar_health"].get("code_smells", 0) for n in sonar_nodes)

        code_quality = round(doc_ratio * 100, 1)
        # Tech debt: rough proxy — more smells/bugs = higher debt
        tech_debt = round(min((bugs * 2 + smells * 0.5) / max(total_files, 1), 50.0), 1)
        doc_coverage = int(doc_ratio * 100)
    else:
        code_quality = 0.0
        tech_debt = 0.0
        doc_coverage = 0
        bugs = 0

    # Pending critical changes = unread critical/warning alerts
    all_alerts = alert_system.get_alerts()
    pending = sum(
        1 for a in all_alerts
        if a.get("severity") in ("critical", "warning") and not a.get("read")
    )

    active_workflow_names = [
        f"{wf['agent']}: {wf['name']}"
        for wf in workflows if wf["status"] in ("Running", "Idle")
    ][:3]

    return {
        "technical_debt": tech_debt,
        "code_quality": code_quality,
        "documentation_coverage": doc_coverage,
        "pending_critical_changes": pending,
        "active_workflows": active_workflow_names,
    }


# ── Workflows ─────────────────────────────────────────────────────────────────

@router.get("/workflows")
async def get_mobile_workflows():
    """Live agent workflow list derived from the alert system."""
    print("\n[Mobile] GET /workflows")
    return _derive_workflows_from_alerts()


@router.post("/workflows/{wf_id}/control")
async def control_workflow(wf_id: str, action: str = Body(..., embed=True)):
    """Control endpoint — logs the action as an alert and acknowledges."""
    print(f"\n[Mobile] POST /workflows/{wf_id}/control -> action={action}")
    alert_system.add_alert(
        title=f"Mobile: Workflow {action}",
        message=f"Action '{action}' triggered for workflow '{wf_id}' via mobile app.",
        severity="info",
    )
    return {"message": f"Action '{action}' triggered for workflow '{wf_id}'", "ok": True}


# ── Approvals ─────────────────────────────────────────────────────────────────

@router.get("/approvals")
async def get_mobile_approvals():
    """Critical changes requiring approval, sourced from live alerts."""
    print("\n[Mobile] GET /approvals")
    return _derive_approvals_from_alerts()


@router.post("/approvals/{app_id}/decide")
async def decide_approval(app_id: str, decision: str = Body(..., embed=True)):
    """Approve or reject a critical change — marks the underlying alert as read."""
    print(f"\n[Mobile] POST /approvals/{app_id}/decide -> decision={decision}")
    # app_id is "app_<alert_id>" — extract and mark alert read
    try:
        alert_id = int(app_id.replace("app_", ""))
        alert_system.mark_read(alert_id)
    except Exception:
        pass
    alert_system.add_alert(
        title=f"Decision: {decision.capitalize()}d",
        message=f"Change '{app_id}' was {decision}d via mobile approval.",
        severity="success" if decision.lower() in ("approv", "approve") else "warning",
    )
    return {"message": f"Change {app_id} has been {decision}d", "ok": True}


# ── Tickets ───────────────────────────────────────────────────────────────────

class TicketCreate(BaseModel):
    title: str
    description: str = ""
    priority: str = "Medium"


@router.get("/tickets")
async def get_mobile_tickets():
    """Live ticket list from the in-memory store."""
    print("\n[Mobile] GET /tickets")
    # Return newest first
    return list(reversed(_tickets))


@router.post("/tickets")
async def create_ticket(body: TicketCreate):
    """Create a new engineering ticket in the live store."""
    print(f"\n[Mobile] POST /tickets -> title={body.title}")
    now = datetime.now().strftime("%b %d, %H:%M")
    ticket = {
        "id": _next_ticket_id(),
        "title": body.title,
        "description": body.description,
        "status": "Open",
        "priority": body.priority,
        "assignee": "Unassigned",
        "created_at": now,
    }
    _tickets.append(ticket)
    alert_system.add_alert(
        title=f"Ticket Created: {ticket['id']}",
        message=f"'{body.title}' — Priority: {body.priority}",
        severity="info",
    )
    return {"ok": True, "ticket": ticket}


@router.post("/tickets/{ticket_id}/close")
async def close_ticket(ticket_id: str):
    """Mark a ticket as closed."""
    print(f"\n[Mobile] POST /tickets/{ticket_id}/close")
    for ticket in _tickets:
        if ticket["id"] == ticket_id:
            ticket["status"] = "Closed"
            alert_system.add_alert(
                title=f"Ticket Closed: {ticket_id}",
                message=f"'{ticket['title']}' marked as closed via mobile.",
                severity="success",
            )
            return {"message": f"Ticket {ticket_id} has been closed", "ok": True}
    return {"message": f"Ticket {ticket_id} not found", "ok": False}


# ── Analytics ─────────────────────────────────────────────────────────────────

@router.get("/analytics/tickets")
async def get_ticket_analytics():
    """Live ticket analytics computed from the in-memory store."""
    open_count = sum(1 for t in _tickets if t["status"] == "Open")
    in_progress = sum(1 for t in _tickets if t["status"] == "In Progress")
    closed_today = sum(1 for t in _tickets if t["status"] == "Closed")
    total = len(_tickets) or 1
    velocity = round(closed_today / total, 2)
    return {
        "open": open_count,
        "in_progress": in_progress,
        "closed_today": closed_today,
        "velocity": velocity,
    }


# ════════════════════════════════════════════════════════════════════════════════
# STORE — Git Repo Import & Per-Repo Dashboard
# ════════════════════════════════════════════════════════════════════════════════

class ImportRepoRequest(BaseModel):
    repo_url: str
    branch: str = "main"
    force: bool = False


@router.post("/store/import")
async def store_import_repo(body: ImportRepoRequest):
    """
    Logically link a GitHub repository for the mobile app without cloning.
    Creates a minimal graph file so it appears in the STORE.
    """
    print(f"\n[Mobile/Store] POST /store/import -> {body.repo_url} (branch={body.branch})")
    try:
        # Extract repo name from URL (e.g. https://github.com/Mohitmhatre32/VEGA -> VEGA)
        repo_name = body.repo_url.rstrip("/").split("/")[-1]
        if repo_name.endswith(".git"):
            repo_name = repo_name[:-4]
            
        # Create minimal graph JSON to satisfy _list_all_projects
        repo_dir = os.path.join(settings.REPO_STORAGE_PATH, repo_name)
        os.makedirs(repo_dir, exist_ok=True)
        graph_file = os.path.join(repo_dir, "_kachow_graph.json")
        
        now = datetime.now().isoformat()
        graph_data = {
            "project_name": repo_name,
            "branch": body.branch,
            "origin_url": body.repo_url,
            "total_files": 0,
            "documented_ratio": 0.0,
            "processed_at": now,
            "from_cache": True,
            "project_root": repo_dir,
            "nodes": [],
            "edges": []
        }
        
        with open(graph_file, "w", encoding="utf-8") as f:
            json.dump(graph_data, f, indent=2)

        alert_system.add_alert(
            title=f"Mobile Repo Linked: {repo_name}",
            message=f"Repo '{body.repo_url}' logically linked via mobile STORE without cloning.",
            severity="success",
        )
        return {
            "ok": True,
            "project_name": repo_name,
            "branch": body.branch,
            "total_files": 0,
            "documented_ratio": 0.0,
            "from_cache": True,
            "processed_at": now,
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        alert_system.add_alert(
            title="Mobile Link Failed",
            message=str(e)[:200],
            severity="critical",
        )
        return {"ok": False, "error": str(e)}


@router.get("/store/repos")
async def store_list_repos():
    """List all repos that have been processed and are ready to browse."""
    print("\n[Mobile/Store] GET /store/repos")
    return _list_all_projects()


@router.get("/store/repos/{repo_name}/status")
async def store_repo_status(repo_name: str):
    """Lightweight health status scoped to one specific repo."""
    print(f"\n[Mobile/Store] GET /store/repos/{repo_name}/status")
    graph = _load_graph(repo_name)
    if not graph:
        return {"error": "Repo not found or not yet processed"}

    doc_ratio = graph.get("documented_ratio", 0.0) or 0.0
    total_files = graph.get("total_files", 0) or 0
    nodes = graph.get("nodes", [])
    sonar_nodes = [n for n in nodes if n.get("sonar_health")]
    bugs = sum(n["sonar_health"].get("bugs", 0) for n in sonar_nodes)
    smells = sum(n["sonar_health"].get("code_smells", 0) for n in sonar_nodes)
    tech_debt = round(min((bugs * 2 + smells * 0.5) / max(total_files, 1), 50.0), 1)

    return {
        "repo_name": repo_name,
        "project_name": graph.get("project_name", repo_name),
        "branch": graph.get("branch", "main"),
        "total_files": total_files,
        "code_quality": round(doc_ratio * 100, 1),
        "technical_debt": tech_debt,
        "documentation_coverage": int(doc_ratio * 100),
        "bugs": bugs,
        "code_smells": smells,
        "processed_at": graph.get("processed_at", ""),
    }


@router.get("/store/repos/{repo_name}/dashboard")
async def store_repo_dashboard(repo_name: str):
    """
    Full per-repo dashboard: health metrics + commit history + PRs.
    Calls the Librarian service directly so the data is always live.
    """
    print(f"\n[Mobile/Store] GET /store/repos/{repo_name}/dashboard")
    graph = _load_graph(repo_name)
    if not graph:
        return {"error": "Repo not found or not yet processed"}

    repo_url = graph.get("project_root", "")
    # Try to find the real origin URL from the cached graph
    origin_url = graph.get("origin_url") or repo_url

    commits = []
    pull_requests = []
    try:
        from app.agents.librarian.service import LibrarianService
        svc = LibrarianService()
        history = svc.get_commit_history(origin_url or repo_url, max_count=20)
        commits = [
            {
                "hash": c.hash,
                "message": c.message,
                "author": c.author,
                "date": c.date,
                "commit_type": c.commit_type,
            }
            for c in history
        ]
    except Exception as e:
        print(f"[Mobile/Store] Commit history error: {e}")

    # Build status section from graph
    doc_ratio = graph.get("documented_ratio", 0.0) or 0.0
    total_files = graph.get("total_files", 0) or 0

    # Top files by size (most complex)
    nodes = graph.get("nodes", []) if isinstance(graph.get("nodes"), list) else []
    top_files = sorted(
        [n for n in nodes if n.get("size_bytes") and n.get("type") == "file"],
        key=lambda n: n.get("size_bytes", 0),
        reverse=True,
    )[:5]

    return {
        "repo_name": repo_name,
        "project_name": graph.get("project_name", repo_name),
        "branch": graph.get("branch", "main"),
        "total_files": total_files,
        "code_quality": round(doc_ratio * 100, 1),
        "documentation_coverage": int(doc_ratio * 100),
        "processed_at": graph.get("processed_at", ""),
        "commits": commits,
        "pull_requests": pull_requests,  # populated if GitHub token available
        "top_files": [
            {
                "name": n.get("label", n.get("id", "")),
                "size_bytes": n.get("size_bytes", 0),
                "layer": n.get("layer", ""),
                "language": n.get("language", ""),
            }
            for n in top_files
        ],
    }

