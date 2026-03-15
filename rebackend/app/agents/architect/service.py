import os
import json
import hashlib
import time
import requests
from requests.auth import HTTPBasicAuth
from typing import List, Dict, Any
from app.core.config import settings
from app.core.llm import generate_json, generate_text
from app.core.alerts import alert_system
from app.agents.librarian.service import librarian
from .models import BuildResponse, ImpactResponse, ImpactNode, JiraTicket

class ArchitectService:
    def __init__(self):
        self.scaffold_prompt = """
ROLE: Senior Staff Software Architect.
TASK: Create a professional, enterprise-grade microservices scaffolding based on requirements.

STRICT ARCHITECTURAL & SECURITY REQUIREMENTS:
1. LAYERED ARCHITECTURE: Min 3 distinct microservices with 'api/routes', 'controllers', 'services', and 'repository' layers.
2. AUTHENTICATION: JWT-based (access & refresh tokens). Include token expiration/refresh flow logic.
3. ACCOUNT SECURITY: Password policies, account lockout after failed attempts, reset functionality, and email verification stubs.
4. VALIDATION: Strict input validation for username/password.
5. HASHING: Asynchronous password hashing (bcrypt.hash/compare).
6. MIDDLEWARE: rate limiting, secure headers (Helmet style), CORS control, and centralized error handling middleware.
7. CONFIGURATION: Use .env for environment variables. Separate dev/prod config structures.
8. MONITORING: Logging system for monitoring/debugging.
9. DOCUMENTATION: API documentation (OpenAPI/Swagger specs).
10. DATABASE: Database abstraction layer / ORM instead of raw queries.
11. DEVOPS: production-ready Dockerfile for each service + root docker-compose.yml.
12. AUTHORIZATION: Role-based authorization (RBAC) implemented across layers.
13. RELIABILITY & SCALABILITY: 
    - Microservice readiness (service-to-service communication capability). 
    - Automated testing (unit/integration) stubs.
    - Scalability patterns: Stateless auth, caching layers (Redis/Memcached stubs if needed).

OUTPUT FORMAT:
Return ONLY a valid JSON object where:
- KEY: Relative file path.
- VALUE: File content as a string.

STRICT: No conversational text. Escape all newlines as '\\n'.
"""

    def build_project(self, requirements: str, project_name: str) -> BuildResponse:
        """Generates a new project structure and auto-ingests it via Librarian."""
        try:
            # Create a unique project ID
            project_hash = hashlib.md5(requirements.encode()).hexdigest()[:8]
            timestamp = int(time.time())
            project_id = f"arch_{project_name}_{project_hash}_{timestamp}"
            target_dir = os.path.join(settings.REPO_STORAGE_PATH, project_id)
            
            # Generate file tree
            files_data = generate_json(f"Requirements: {requirements}", self.scaffold_prompt)
            
            os.makedirs(target_dir, exist_ok=True)
            
            created_files = []
            for path, content in files_data.items():
                full_path = os.path.join(target_dir, path)
                os.makedirs(os.path.dirname(full_path), exist_ok=True)
                
                # Robust cleaning of escaped newlines
                clean_content = content.replace("\\n", "\n").replace('\\"', '"')
                
                with open(full_path, "w", encoding="utf-8") as f:
                    f.write(clean_content)
                created_files.append(path)
            
            # Save blueprint metadata
            blueprint_meta = {
                "project_id": project_id,
                "project_name": project_name,
                "requirements": requirements,
                "generated_at": time.ctime(),
                "files": created_files
            }
            with open(os.path.join(target_dir, "blueprint.json"), "w") as f:
                json.dump(blueprint_meta, f, indent=4)
            
            # CRITICAL: Auto-ingest via Librarian so it appears in the graph immediately
            alert_system.add_alert(
                title="🏗️ Architect: Auto-Loading",
                message=f"Scaffolding complete. Librarian is mapping {project_id}...",
                severity="info"
            )
            
            librarian.process_request(input_source=target_dir, force=True)

            alert_system.add_alert(
                title="Architect Build Success",
                message=f"Scaffolded {len(created_files)} files. Project ready for analysis.",
                severity="success"
            )
            
            return BuildResponse(
                project_root=target_dir,
                files_created=created_files,
                message=f"Project {project_id} generated and indexed successfully."
            )
        except Exception as e:
            alert_system.add_alert(title="Architect Build Failed", message=str(e), severity="error")
            raise ValueError(f"Failed to build project: {e}")

    def analyze_impact(self, project_name: str, target_file: str, proposed_change: str) -> ImpactResponse:
        """Analyses the blast radius of a change using the Librarian graph."""
        try:
            # Locate project root (it might be a relative path or an absolute id)
            project_path = os.path.join(settings.REPO_STORAGE_PATH, project_name)
            graph_path = os.path.join(project_path, "_kachow_graph.json")
            
            if not os.path.exists(graph_path):
                raise FileNotFoundError(f"Project graph not found for {project_name}")
            
            with open(graph_path, "r") as f:
                graph_data = json.load(f)
            
            impacted = set()
            depth = 0
            
            # Transitive dependency lookup
            queue = [target_file]
            visited = {target_file}
            
            while queue:
                current = queue.pop(0)
                found_in_level = False
                for edge in graph_data.get("edges", []):
                    if edge["target"] == current and edge["source"] not in visited:
                        impacted.add(edge["source"])
                        visited.add(edge["source"])
                        queue.append(edge["source"])
                        found_in_level = True
                if found_in_level:
                    depth += 1

            # Enrich with logic-based reasoning from LLM
            impact_nodes = []
            for path in impacted:
                reasoning_prompt = f"""
                ROLE: Senior System Analyzer.
                CONTEXT: Proposed change "{proposed_change}" to file "{target_file}".
                TARGET: Analyzing impact on dependent file "{path}".
                
                TASK: Identify why this dependent file is affected and assign severity.
                
                RETURN ONLY JSON:
                {{ "severity": "high/medium/low", "reason": "logic-based explanation" }}
                """
                analysis = generate_json(reasoning_prompt, "You are a professional software architect.")
                
                impact_nodes.append(ImpactNode(
                    file_path=path,
                    severity=analysis.get("severity", "medium"),
                    reason=analysis.get("reason", "Direct dependency detected in knowledge graph.")
                ))

            return ImpactResponse(
                impacted_files=impact_nodes,
                total_impacted=len(impact_nodes),
                blast_radius_depth=depth
            )

        except Exception as e:
            raise ValueError(f"Impact analysis failed: {e}")

    def get_jira_ticket(self, key: str) -> Dict[str, Any]:
        """Fetches a Jira ticket details."""
        if not settings.JIRA_URL or not settings.JIRA_API_TOKEN:
            raise ValueError("Jira credentials not configured in .env")
            
        url = f"{settings.JIRA_URL.rstrip('/')}/rest/api/3/issue/{key}"
        auth = HTTPBasicAuth(settings.JIRA_EMAIL, settings.JIRA_API_TOKEN)
        
        resp = requests.get(url, auth=auth)
        if resp.status_code != 200:
            raise ValueError(f"Jira API error: {resp.status_code} - {resp.text}")
            
        return resp.json()

    def create_subtasks(self, parent_key: str, tasks: List[str]) -> List[str]:
        """Creates sub-tasks in Jira for a parent issue."""
        if not settings.JIRA_URL:
            raise ValueError("Jira URL not configured")

        auth = HTTPBasicAuth(settings.JIRA_EMAIL, settings.JIRA_API_TOKEN)
        created_keys = []
        
        # Get parent details to inherit project/issue type
        parent = self.get_jira_ticket(parent_key)
        project_id = parent["fields"]["project"]["id"]
        
        for summary in tasks:
            payload = {
                "fields": {
                    "project": {"id": project_id},
                    "parent": {"key": parent_key},
                    "summary": f"[Architect] {summary}",
                    "issuetype": {"name": "Sub-task"},
                    "description": {
                        "type": "doc",
                        "version": 1,
                        "content": [
                            {"type": "paragraph", "content": [{"type": "text", "text": "Automatically generated by KA-CHOW Architect."}]}
                        ]
                    }
                }
            }
            resp = requests.post(f"{settings.JIRA_URL.rstrip('/')}/rest/api/3/issue", json=payload, auth=auth)
            if resp.status_code == 201:
                created_keys.append(resp.json()["key"])
        
        return created_keys

architect_service = ArchitectService()
