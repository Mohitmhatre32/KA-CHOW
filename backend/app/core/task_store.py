import os
import json
import uuid
from typing import List, Dict, Any, Optional

class TaskStore:
    def __init__(self, filepath: str = "storage/tasks.json"):
        self.filepath = filepath
        self._ensure_file()

    def _ensure_file(self):
        os.makedirs(os.path.dirname(self.filepath), exist_ok=True)
        if not os.path.exists(self.filepath):
            with open(self.filepath, "w", encoding="utf-8") as f:
                json.dump([], f)

    def _read(self) -> List[Dict[str, Any]]:
        self._ensure_file()
        try:
            with open(self.filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return []

    def _write(self, tasks: List[Dict[str, Any]]):
        with open(self.filepath, "w", encoding="utf-8") as f:
            json.dump(tasks, f, indent=2)

    def get_tasks(self, project_name: str) -> List[Dict[str, Any]]:
        tasks = self._read()
        if project_name.lower() == "global":
            return tasks
        return [t for t in tasks if t.get("project_name") == project_name]

    def create_task(self, project_name: str, title: str, linked_nodes: List[str]) -> Dict[str, Any]:
        tasks = self._read()
        new_task = {
            "id": f"TSK-{str(uuid.uuid4())[:8]}",
            "project_name": project_name,
            "title": title,
            "status": "open",
            "linked_nodes": linked_nodes
        }
        tasks.append(new_task)
        self._write(tasks)
        return new_task

    def close_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        tasks = self._read()
        for task in tasks:
            if task.get("id") == task_id:
                task["status"] = "resolved"
                self._write(tasks)
                return task
        return None
