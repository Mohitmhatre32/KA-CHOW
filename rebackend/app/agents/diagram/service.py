import os
import json
from typing import Dict, Any

from app.core.config import settings
from app.core.llm import generate_text
from app.core.alerts import alert_system
from .models import DiagramRequest, DiagramResponse

class DiagramService:
    def __init__(self):
        pass

    def generate_diagram(self, request: DiagramRequest) -> DiagramResponse:
        # Extract project name from URL just like Librarian/Architect does
        project_name = request.repo_url.split("/")[-1].replace(".git", "")
        # Fallback to 'project' if URL parsing fails for some reason
        if not project_name:
            project_name = "project"
            
        target_dir = os.path.join(settings.REPO_STORAGE_PATH, project_name)
        graph_path = os.path.join(target_dir, "_kachow_graph.json")

        if not os.path.exists(graph_path):
            raise FileNotFoundError(f"Knowledge graph not found for repository: {request.repo_url}. Please ingest the repository via Librarian first. (Checked path: {graph_path})")

        with open(graph_path, "r", encoding="utf-8") as f:
            graph_data = json.load(f)

        # Final robustness pruning for Groq 12k token limits
        clean_nodes = []
        for node in graph_data.get("nodes", [])[:30]:
            clean_nodes.append({
                "id": node.get("id"),
                "label": node.get("label"),
                "type": node.get("type")
            })
            
        clean_edges = []
        for edge in graph_data.get("edges", [])[:40]:
            clean_edges.append({
                "s": edge.get("source"),
                "t": edge.get("target")
            })
        
        truncated_graph = {
            "n": clean_nodes,
            "e": clean_edges
        }
        
        # Compact JSON to save tokens
        graph_str = json.dumps(truncated_graph, separators=(",", ":"))

        prompt = f"""
Architect & Designer. Create a Mermaid flowchart from: {graph_str}
Type: {request.diagram_type}

RULES:
1. Use `flowchart TD` or `flowchart LR`.
2. **DO NOT USE SUBGRAPHS.** No grouping. Just nodes and connectors.
3. Node IDs: alphanumeric only. 
4. Aesthetics:
   `classDef f fill:#3b82f6,stroke:#fff,color:#fff,rx:5;`
   `classDef b fill:#10b981,stroke:#fff,color:#fff,rx:5;`
   `classDef d fill:#8b5cf6,stroke:#fff,color:#fff,rx:5;`
5. Labels: [Filename with extension].
6. Styling: `nodeID["Label"]:::f` (or :::b, :::d).
7. OUTPUT: RAW MERMAID ONLY.
"""
        try:
            raw_mermaid = generate_text(prompt, "You are a specialized Diagram Agent.")
            raw_mermaid = raw_mermaid.strip()
            
            # Clean up markdown codeblocks if the LLM still returns them
            if raw_mermaid.startswith("```mermaid"):
                raw_mermaid = raw_mermaid[10:]
            elif raw_mermaid.startswith("```"):
                raw_mermaid = raw_mermaid[3:]
                
            if raw_mermaid.endswith("```"):
                raw_mermaid = raw_mermaid[:-3]
                
            raw_mermaid = raw_mermaid.strip()

            alert_system.add_alert(
                title="Diagram Generated",
                message=f"Architecture diagram generated for {request.repo_url}.",
                severity="success"
            )

            return DiagramResponse(
                repo_url=request.repo_url,
                diagram_type=request.diagram_type,
                mermaid_markdown=raw_mermaid,
                message="Diagram generated successfully."
            )

        except Exception as e:
            alert_system.add_alert(
                title="Diagram Generation Failed",
                message=str(e),
                severity="error"
            )
            raise ValueError(f"Failed to generate diagram: {e}")

diagram_service = DiagramService()
