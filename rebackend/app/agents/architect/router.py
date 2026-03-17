from fastapi import APIRouter, HTTPException
from .models import BuildRequest, BuildResponse, ImpactRequest, ImpactResponse, JiraSyncRequest, JiraResponse, JiraCreateTasksRequest
from .service import architect_service

router = APIRouter()

@router.post("/build", response_model=BuildResponse, summary="Scaffold Project")
async def build_project(request: BuildRequest):
    """Generates a boilerplate project based on textual requirements."""
    print(f"\n[Architect] POST /build -> project={request.project_name}")
    try:
        return architect_service.build_project(request.requirements, request.project_name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/impact", response_model=ImpactResponse, summary="Impact Analysis")
async def analyze_impact(request: ImpactRequest):
    """Calculates the blast radius of a change using the project's knowledge graph."""
    print(f"\n[Architect] POST /impact -> project={request.project_name}, file={request.target_file}")
    try:
        return architect_service.analyze_impact(request.project_name, request.target_file, request.proposed_change)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/jira/ticket/{key}", summary="Get Jira Ticket")
async def get_jira_ticket(key: str):
    """Fetches details of a Jira ticket."""
    print(f"\n[Architect] GET /jira/ticket/{key}")
    try:
        ticket = architect_service.get_jira_ticket(key)
        return {
            "key": ticket["key"],
            "summary": ticket["fields"]["summary"],
            "status": ticket["fields"]["status"]["name"],
            "description": ticket["fields"].get("description", "")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/jira/tasks", response_model=JiraResponse, summary="Create Sub-tasks")
async def create_jira_tasks(request: JiraCreateTasksRequest):
    """Creates sub-tasks in Jira for a parent ticket."""
    print(f"\n[Architect] POST /jira/tasks -> parent={request.parent_key}, count={len(request.tasks)}")
    try:
        keys = architect_service.create_subtasks(request.parent_key, request.tasks)
        return JiraResponse(success=True, message=f"Created {len(keys)} sub-tasks: {', '.join(keys)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
