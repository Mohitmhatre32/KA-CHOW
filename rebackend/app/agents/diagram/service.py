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

        # Truncate graph data to avoid token max limits if repo is huge
        nodes = graph_data.get("nodes", [])[:100]
        edges = graph_data.get("edges", [])[:200]
        
        truncated_graph = {
            "nodes": nodes,
            "edges": edges,
            "note": "Truncated for prompt size constraints" if len(graph_data.get("nodes", [])) > 100 else ""
        }
        
        graph_str = json.dumps(truncated_graph, indent=2)

        prompt = f"""
ROLE: Senior Software Architect and Visual Designer.
TASK: Generate a **beautiful, highly-styled, and premium** system architecture diagram based on the provided Knowledge Graph data.
DIAGRAM TYPE: {request.diagram_type}
USER PROMPT OVERRIDE: {request.prompt_override or "None"}

GRAPH DATA:
{graph_str}

REQUIREMENTS:
1. Analyze the nodes (files/components) and edges (dependencies/imports).
2. Create a Mermaid.js diagram using `graph LR` or `graph TD`.
3. **CRITICAL: Add premium aesthetics for a DARK THEME website.** The website background is very dark, so edges/lines must be bright and highly visible. Use `classDef` to create bright, vibrant harmonic colors that pop. All nodes must use a class.
   Example:
   `classDef frontend fill:#2563eb,stroke:#93c5fd,stroke-width:2px,color:#ffffff,rx:8px,ry:8px;`
   `classDef backend fill:#059669,stroke:#6ee7b7,stroke-width:2px,color:#ffffff,rx:8px,ry:8px;`
   `classDef database fill:#7c3aed,stroke:#c4b5fd,stroke-width:2px,color:#ffffff,rx:8px,ry:8px;`
4. Group related components into subgraphs (e.g., 'Frontend', 'Backend', 'Core Services'). Subgraphs should have a clean, logical flow.
5. Keep the diagram macro-architectural. Don't clutter it with every single utility file. Focus on the main system flow.
6. **CRITICAL MERMAID SYNTAX RULES:**
   - Node IDs MUST be pure alphanumeric (e.g., `A`, `B1`, `ClientApp`). 
   - DO NOT USE spaces, hyphens, slashes, or special characters in the Node ID itself.
   - Example CORRECT: `FrontendWeb["Frontend/Web App"]:::client`
   - Example INCORRECT: `Frontend/Web["Frontend/Web App"]:::client` (will cause a Parse Error!)
   - Use appropriate shapes (`[ ]` for normal components, `[( )]` for databases, `{{ }}` for services).
7. ONLY return the valid Mermaid code block. Do NOT use markdown code blocks like ```mermaid, JUST the raw mermaid code.

EXAMPLE OUTPUT:
%%{{ init: {{'theme': 'base', 'themeVariables': {{ 'primaryColor': '#1e293b', 'lineColor': '#f8fafc', 'textColor': '#f8fafc' }}}} }}%%
graph LR
    %% Styles
    classDef client fill:#2563eb,stroke:#93c5fd,stroke-width:2px,color:#ffffff,rx:8px,ry:8px;
    classDef server fill:#059669,stroke:#6ee7b7,stroke-width:2px,color:#ffffff,rx:8px,ry:8px;
    classDef db fill:#7c3aed,stroke:#c4b5fd,stroke-width:2px,color:#ffffff,rx:8px,ry:8px;

    subgraph "Frontend Layer"
        A[Mobile App]:::client
        B[Web Dashboard]:::client
    end
    
    subgraph "Backend Services"
        C(API Gateway):::server
        D{{Auth Service}}:::server
    end
    
    E[(PostgreSQL)]:::db

    A --> C
    B --> C
    C --> D
    D --> E
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
