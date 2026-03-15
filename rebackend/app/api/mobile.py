from fastapi import APIRouter
from typing import List, Dict, Any

router = APIRouter()

@router.get("/status")
async def get_mobile_status():
    """
    Aggregated status for the mobile dashboard.
    Returns technical debt, code quality, and other metrics.
    """
    print("\n[Mobile] GET /status")
    return {
        "technical_debt": 12.5,
        "code_quality": 88.2,
        "documentation_coverage": 75,
        "pending_critical_changes": 3,
        "active_workflows": [
            "Librarian: Indexing Backend Repo",
            "Guardian: PR Review #42",
            "Architect: Analyzing Impact for Auth Change"
        ]
    }

@router.get("/workflows")
async def get_mobile_workflows():
    """
    Detailed list of engineering workflows for control via mobile.
    """
    print("\n[Mobile] GET /workflows")
    return [
        {"id": "wf_001", "name": "Codebase Scanning", "status": "Running", "agent": "Librarian"},
        {"id": "wf_002", "name": "Documentation Sync", "status": "Scheduled", "agent": "Librarian"},
        {"id": "wf_003", "name": "Security Audit", "status": "Completed", "agent": "Guardian"},
    ]

@router.post("/workflows/{wf_id}/control")
async def control_workflow(wf_id: str, action: str):
    """
    Control endpoint for starting/stopping/re-running workflows.
    """
    print(f"\n[Mobile] POST /workflows/{wf_id}/control -> action={action}")
    return {"message": f"Action '{action}' triggered for workflow '{wf_id}'", "ok": True}

@router.get("/approvals")
async def get_mobile_approvals():
    """
    Critical changes requiring architect approval.
    """
    print("\n[Mobile] GET /approvals")
    return [
        {
            "id": "app_001",
            "title": "Database Schema Change",
            "description": "Adding 'user_metadata' jsonb column to 'users' table.",
            "severity": "High",
            "requester": "Guardian Agent (Auto-Heal)"
        },
        {
            "id": "app_002",
            "title": "API Breaking Change",
            "description": "Renaming /api/v1/user to /api/v2/user.",
            "severity": "Medium",
            "requester": "Architect Agent"
        }
    ]

@router.post("/approvals/{app_id}/decide")
async def decide_approval(app_id: str, decision: str):
    """
    Approve or Reject a critical change.
    """
    return {"message": f"Change {app_id} has been {decision}ed", "ok": True}

@router.get("/tickets")
async def get_mobile_tickets():
    """
    List of active engineering tickets (Jira-style).
    """
    print("\n[Mobile] GET /tickets")
    return [
        {
            "id": "TIC-101",
            "title": "Fix Memory Leak in Auth Module",
            "status": "In Progress",
            "priority": "High",
            "assignee": "Architect Agent",
            "created_at": "2-24, 14:00"
        },
        {
            "id": "TIC-102",
            "title": "Implement JWT Refresh Tokens",
            "status": "Open",
            "priority": "Medium",
            "assignee": "Guardian Agent",
            "created_at": "2-25, 09:30"
        },
        {
            "id": "TIC-103",
            "title": "Optimize Database Index for Users",
            "status": "Closed",
            "priority": "Low",
            "assignee": "Librarian Agent",
            "created_at": "2-25, 11:15"
        }
    ]

@router.post("/tickets")
async def create_ticket(title: str, description: str, priority: str = "Medium"):
    """
    Create a new engineering ticket.
    """
    return {
        "ok": True,
        "ticket": {
            "id": "TIC-104",
            "title": title,
            "status": "Open",
            "priority": priority,
            "assignee": "Unassigned",
            "created_at": "Just now"
        }
    }

@router.post("/tickets/{ticket_id}/close")
async def close_ticket(ticket_id: str):
    """
    Mark a ticket as closed.
    """
    return {"message": f"Ticket {ticket_id} has been closed", "ok": True}

@router.get("/analytics/tickets")
async def get_ticket_analytics():
    """
    Analytics for ticket velocity and status distribution.
    """
    return {
        "open": 5,
        "in_progress": 3,
        "closed_today": 12,
        "velocity": 0.85
    }
