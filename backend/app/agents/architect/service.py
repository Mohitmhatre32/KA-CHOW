import os
import json
import shutil
from llama_index.llms.groq import Groq
from app.core.config import settings
from .models import ArchitectResponse, ImpactAnalysisRequest, ImpactResult, AffectedService
from app.agents.librarian.service import librarian

from .models import ArchitectResponse, ImpactResult, AffectedService, ImpactAnalysisRequest
from app.agents.librarian.service import librarian
import re

class ScaffoldEngine:
    def __init__(self):
        # Use Groq via LlamaIndex as requested
        self.llm = Groq(model="llama-3.3-70b-versatile", api_key=settings.GROQ_API_KEY)

    def _clean_and_parse_json(self, text: str) -> dict:
        """Robustly cleans and parses JSON from LLM output."""
        # 1. Strip markdown junk
        if "```" in text:
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            else:
                text = text.split("```")[1].split("```")[0].strip()
        
        text = text.strip()
        
        # 2. Try direct load
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # 3. Handle literal newlines inside string values (common LLM error)
        # This regex tries to find "key": "value" pairs where value has literal newlines
        # and replaces them with escaped \n.
        # Note: This is a complex heuristic for a hackathon.
        lines = text.splitlines()
        cleaned_lines = []
        in_string = False
        for line in lines:
            # Very simple state machine to detect if we're likely inside a quoted value
            # that hasn't closed yet.
            quote_count = line.count('"') - line.count('\\"')
            if quote_count % 2 != 0:
                in_string = not in_string
            
            if in_string:
                cleaned_lines.append(line + "\\n")
            else:
                cleaned_lines.append(line)
        
        try:
            return json.loads(" ".join(cleaned_lines))
        except:
            # 4. Final Fallback: Regex-based extraction of "path": "content"
            # This is desperate but ensures we get SOMETHING if JSON is totally broken.
            pattern = r'"([^"]+)":\s*"([\s\S]+?)"(?=\s*[,\}])'
            matches = re.findall(pattern, text)
            if matches:
                return {k: v.replace("\\n", "\n").replace('\\"', '"') for k, v in matches}
            
            raise Exception("AI output was not valid JSON and could not be recovered.")

    def design_and_build(self, requirements: str) -> ArchitectResponse:
        import hashlib
        import time
        
        # Try to parse if it's JSON to extract summary and tech
        parsed_req = requirements
        try:
            data = json.loads(requirements)
            summary = data.get("summary", "")
            tech = data.get("tech", "")
            req_list = data.get("requirements", [])
            parsed_req = f"SUMMARY: {summary}. TECH STACK: {tech}. DETAILED REQUIREMENTS: {', '.join(req_list)}"
        except:
            pass
            
        # Create a unique project ID based on hash of original requirements + timestamp
        project_hash = hashlib.md5(requirements.encode()).hexdigest()[:8]
        timestamp = int(time.time())
        project_id = f"arch_{project_hash}_{timestamp}"
        
        output_dir = os.path.join(settings.REPO_STORAGE_PATH, project_id)
        
        # --- STEP 1: THE BLUEPRINT ---
        prompt = f"""
ROLE: Senior Staff Software Architect.
TASK: Create a professional microservices scaffolding based on: "{parsed_req}"

STRICT ARCHITECTURAL REQUIREMENTS:
1. QUANTITY: Min THREE (3) distinct microservices.
2. PATTERN: Standard Layered Architecture (api, models, services, schemas, core).
3. INFRASTRUCTURE: Dockerfiles for each + root docker-compose.yml + .env.example.
4. DOCUMENTATION: Comprehensive README.md.

OUTPUT FORMAT:
Return ONLY a valid JSON object. 
- KEY: File path.
- VALUE: Python code.

CRITICAL: 
- Values must be valid JSON strings.
- Escaped all newlines as '\\n' and all double quotes as '\\\"'.
- NO literal multi-line strings.

STRICT: Return ONLY valid JSON. No conversational text.
"""
        
        print(f"🏗️ Architect is designing project: {project_id}")
        try:
            response = self.llm.complete(prompt)
        except Exception as e:
            raise Exception(f"AI Completion Failed: {e}")
        
        # --- STEP 2: PARSE JSON ---
        try:
            file_structure = self._clean_and_parse_json(str(response))
        except Exception as e:
            print(f"DEBUG: Failed raw text: {str(response)[:500]}...")
            raise Exception(f"Error: {e}")

        # --- STEP 3: THE SCAFFOLDING ---
        os.makedirs(output_dir, exist_ok=True)

        created_files = []
        for file_path, file_content in file_structure.items():
            full_path = os.path.join(output_dir, file_path)
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            
            # Remove any artificial literal \n if they survived
            content = file_content.replace("\\n", "\n").replace('\\"', '"')
            
            with open(full_path, "w", encoding="utf-8") as f:
                f.write(content)
            
            created_files.append(file_path)

        # Save blueprint metadata for persistence
        blueprint_meta = {
            "project_id": project_id,
            "requirements": requirements,
            "generated_at": time.ctime(),
            "files": created_files
        }
        with open(os.path.join(output_dir, "blueprint.json"), "w") as f:
            json.dump(blueprint_meta, f, indent=4)

        return ArchitectResponse(
            status="success",
            message=f"Generated {len(created_files)} files in {project_id}.",
            files=created_files,
            blueprint_summary=file_structure.get("README.md", "No README generated."),
            project_path=output_dir
        )

    def analyze_impact(self, request: ImpactAnalysisRequest) -> ImpactResult:
        """Calculates real blast radius using the knowledge graph."""
        import networkx as nx
        
        # Heuristic: Find dependents in the graph
        project_root = librarian.module_map.get(request.repo_url)
        
        prompt = f"""
        PROJECT CONTEXT: A codebase with cross-file dependencies.
        CHANGE: Proposing "{request.proposed_change}" to the file/endpoint "{request.target_endpoint}".
        
        TASK:
        1. Identify potential downstream services or files that would break.
        2. Assign a severity (high/medium/low).
        3. Provide a logic-based reason for each.
        
        OUTPUT FORMAT (JSON):
        {{
            "severity": "high",
            "affected_services": [
                {{ "name": "Service A", "reason": "Reason" }}
            ],
            "summary": "Summary"
        }}
        """
        
        try:
            response = self.llm.complete(prompt)
            data = self._clean_and_parse_json(str(response))
            return ImpactResult(
                severity=data.get("severity", "medium"),
                affected_services=[AffectedService(**s) for s in data.get("affected_services", [])],
                summary=data.get("summary", "Analysis complete.")
            )
        except Exception as e:
            return ImpactResult(
                severity="low",
                affected_services=[],
                summary=f"Impact analysis failed to parse: {e}"
            )

architect = ScaffoldEngine()