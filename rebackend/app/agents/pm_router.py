import os
import json
import glob
from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException

from app.core.task_store import TaskStore
from app.core.config import settings
from app.core.llm import client as groq_client

router = APIRouter()
store = TaskStore()

class TaskCreateRequest(BaseModel):
    project_name: str
    description: str

def _get_project_nodes(project_name: str) -> List[str]:
    """Finds the _kachow_graph.json for the project and returns all file node IDs."""
    # Since project_name might just be the visual name, we search all repos
    pattern = os.path.join(settings.REPO_STORAGE_PATH, "**", "_kachow_graph.json")
    for filepath in glob.glob(pattern, recursive=True):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                graph = json.load(f)
                # Match by explicit repo_name (folder) or project_name
                folder_name = os.path.basename(os.path.dirname(filepath))
                if graph.get("project_name") == project_name or folder_name == project_name:
                    nodes = graph.get("nodes", [])
                    return [n["id"] for n in nodes if n.get("type") == "file"]
        except Exception:
            continue
    return []

@router.get("/{project_name}")
async def get_tasks(project_name: str):
    """Returns the list of tasks for a given project from the JSON store."""
    return store.get_tasks(project_name)

@router.post("/create")
async def create_task(req: TaskCreateRequest):
    """
    Creates a new task.
    Uses an LLM to find 1 to 3 relevant file paths from the project's graph
    based on the task description.
    """
    print(f"\n[PM] POST /api/tasks/create -> {req.project_name}")
    
    valid_nodes = _get_project_nodes(req.project_name)
    if not valid_nodes:
        # If no nodes found, just create task with empty linked_nodes
        task = store.create_task(req.project_name, req.description, [])
        return task

    # Prompt the LLM to select nodes
    # We truncate the list of nodes if it's too huge to fit in context, but typically a file list is fine
    nodes_str = "\n".join(valid_nodes[:1000]) # limit to 1000 files for safety
    
    prompt = f"""
You are an expert technical project manager and software architect.
A developer has reported the following issue/task for the project '{req.project_name}':
"{req.description}"

Below is a list of valid file paths currently in the repository:
{nodes_str}

Your job is to identify 1 to 3 file paths from the list that are MOST LIKELY related to this issue and will need to be modified or reviewed.
You MUST return ONLY a valid JSON array of strings containing the exact file paths from the list. Do not include markdown formatting, backticks, or any other text.
Example output:
["src/auth/jwt.ts", "src/middleware/auth.ts"]
"""

    try:
        response = groq_client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=150,
        )
        llm_output = response.choices[0].message.content.strip()
        
        # Clean up potential markdown formatting if the LLM ignores instructions
        if llm_output.startswith("```json"):
            llm_output = llm_output[7:]
        if llm_output.startswith("```"):
            llm_output = llm_output[3:]
        if llm_output.endswith("```"):
            llm_output = llm_output[:-3]
        
        llm_output = llm_output.strip()
        
        selected_nodes = json.loads(llm_output)
        if not isinstance(selected_nodes, list):
            selected_nodes = []
            
        # Filter to ensure they actually exist in valid_nodes
        selected_nodes = [n for n in selected_nodes if n in valid_nodes][:3]
    except Exception as e:
        print(f"[PM] LLM Node Selection Error: {e}")
        selected_nodes = []

    # Create and store task
    task = store.create_task(req.project_name, req.description, selected_nodes)
    print(f"[PM] Created Task {task['id']} with nodes: {selected_nodes}")
    return task

@router.post("/{task_id}/close")
async def close_task(task_id: str):
    """Marks a task as resolved in the JSON store."""
    task = store.close_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task closed", "task": task}
