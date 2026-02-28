import os
import ast
import networkx as nx
import git
from git import Repo
from typing import Dict, List, Any
from app.core.config import settings
from app.core.sonar_client import sonar
from app.core.alerts import alert_system
from app.core.llm import client as groq_client
from .models import GraphResponse, FileNode, BranchRequest, FileRequest, CommitInfo, HistoryRequest, SystemHealth
import json

class LibrarianService:
    def __init__(self):
        self.graph = nx.DiGraph()
        self.module_map = {} 

    def get_branches(self, url: str) -> List[str]:
        """Fetches a list of all remote branches without cloning the whole repo."""
        try:
            g = git.cmd.Git()
            remote_refs = g.ls_remote("--heads", url)
            if not remote_refs:
                return ["main"]
                
            remote_refs = remote_refs.split("\n")
            branches = [ref.split("refs/heads/")[-1] for ref in remote_refs if "refs/heads/" in ref]
            return branches if branches else ["main"]
        except Exception as e:
            print(f"Error fetching branches: {e}")
            return ["main"]

    def _clone_repo(self, url: str, branch: str) -> str:
        repo_name = url.rstrip("/").split("/")[-1].replace(".git", "")
        target_path = os.path.join(settings.REPO_STORAGE_PATH, repo_name)
        
        if os.path.exists(target_path):
            try:
                repo = Repo(target_path)
                repo.remotes.origin.fetch()
                repo.git.checkout(branch)
                repo.remotes.origin.pull(branch)
            except Exception as e:
                print(f"Git pull/checkout failed: {e}")
        else:
            print(f"Cloning branch '{branch}' from {url}...")
            Repo.clone_from(url, target_path, branch=branch)
        return target_path

    def process_request(self, input_source: str, branch: str = "main") -> GraphResponse:
        if input_source.startswith("http"):
            path = self._clone_repo(input_source, branch)
        else:
            path = input_source # Local path from Architect
            branch = "local-generated"
        
        return self._build_enhanced_graph(path, branch)

    def _file_to_module(self, rel_path: str) -> str:
        """Converts 'app/core/config.py' -> 'app.core.config'"""
        return rel_path.replace(".py", "").replace(os.sep, ".")

    def _resolve_import(self, target_import: str) -> str:
        """Deep Resolve Logic for Cross-Folder Imports"""
        if target_import in self.module_map:
            return self.module_map[target_import]
        if f"{target_import}.__init__" in self.module_map:
            return self.module_map[f"{target_import}.__init__"]

        matches = []
        for mod_name, path in self.module_map.items():
            if mod_name.endswith(f".{target_import}") or target_import.endswith(f".{mod_name}"):
                matches.append(path)
        
        if matches:
            matches.sort(key=len)
            return matches[0]

        return None

    def _build_enhanced_graph(self, root_path: str, branch: str) -> GraphResponse:
        self.graph.clear()
        self.module_map.clear()
        
        nodes_data = []
        edges_data = []
        total_debt = 0
        file_count = 0
        
        repo_name = os.path.basename(root_path)
        
        # 🔔 Alert: Scan Started
        alert_system.add_alert(
            title=f"Librarian: Scanning {repo_name}",
            message=f"Beginning architectural analysis and quality gate check for branch '{branch}'.",
            severity="info"
        )

        # =========================================================
        # 🚨 SONARQUBE SCANNER REMOVED FROM INITIAL INGESTION
        # It is now triggered independently via trigger_sonar_scan
        # =========================================================

        # =========================================================
        # PASS 1: SCAN & MAP
        # =========================================================
        for dirpath, _, filenames in os.walk(root_path):
            if any(x in dirpath for x in ["venv", ".git", "__pycache__", "node_modules", ".idea"]): 
                continue
            
            for file in filenames:
                if file.endswith((".py", ".js", ".ts", ".tsx", ".jsx", ".html", ".css", ".java", ".cpp", ".c", ".go", ".rb")):
                    full_path = os.path.join(dirpath, file)
                    rel_path = os.path.relpath(full_path, root_path).replace("\\", "/")
                    
                    mod_name = self._file_to_module(rel_path)
                    self.module_map[mod_name] = rel_path

                    # Get Sonar Metrics (using repo_name as the project key)
                    metrics = sonar.get_file_metrics(rel_path, project_key=repo_name)
                    total_debt += metrics['code_smells']
                    file_count += 1

                    try:
                        with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                            content = f.read()
                    except: content = ""

                    self.graph.add_node(rel_path, metrics=metrics, content=content, type="file")
                    nodes_data.append(FileNode(
                        id=rel_path, label=file, type="file", sonar_health=metrics, layer="backend"
                    ))

        # =========================================================
        # PASS 2: DEEP IMPORT ANALYSIS
        # =========================================================
        for node_id in self.graph.nodes:
            if self.graph.nodes[node_id].get("type") != "file": continue
            
            content = self.graph.nodes[node_id].get("content", "")
            try:
                tree = ast.parse(content)
                for node in ast.walk(tree):
                    targets = []

                    if isinstance(node, ast.Import):
                        for alias in node.names:
                            targets.append(alias.name)
                    
                    elif isinstance(node, ast.ImportFrom) and node.module:
                        targets.append(node.module)
                        for alias in node.names:
                            targets.append(f"{node.module}.{alias.name}")

                    for t in targets:
                        resolved_path = self._resolve_import(t)
                        if resolved_path and resolved_path != node_id:
                            if not self.graph.has_edge(node_id, resolved_path):
                                self.graph.add_edge(node_id, resolved_path)
                                edges_data.append({"source": node_id, "target": resolved_path, "relation": "imports"})
            except: pass

        # =========================================================
        # PASS 3: ORPHAN RESCUE (Connect to Folders)
        # =========================================================
        for node_id in list(self.graph.nodes):
            parent_dir = os.path.dirname(node_id)
            if parent_dir and parent_dir != ".":
                if parent_dir not in self.graph:
                    self.graph.add_node(parent_dir, type="folder")
                    nodes_data.append(FileNode(
                        id=parent_dir, label=f"📂 {os.path.basename(parent_dir)}", 
                        type="folder", sonar_health={"bugs":0, "vulnerabilities":0, "code_smells":0, "coverage":100, "quality_gate":"PASSED"}, 
                        layer="system"
                    ))
                
                if not self.graph.has_edge(parent_dir, node_id):
                    self.graph.add_edge(parent_dir, node_id)
                    edges_data.append({"source": parent_dir, "target": node_id, "relation": "contains"})

        avg_health = 100 - (total_debt / file_count) if file_count > 0 else 100
        
        # =========================================================
        # 🌟 WRITE THE MAP FOR THE RAG ENGINE (Agent 3)
        # =========================================================
        map_path = os.path.join(root_path, "_kachow_architecture_map.md")
        try:
            with open(map_path, "w", encoding="utf-8") as f:
                f.write("# KA-CHOW System Architecture & Dependency Map\n\n")
                f.write("## 1. File Modules\n")
                for n, d in self.graph.nodes(data=True):
                    f.write(f"- `{n}` (Type: {d.get('type', 'file')})\n")
                
                f.write("\n## 2. Dependencies & Directory Tree\n")
                for u, v, d in self.graph.edges(data=True):
                    f.write(f"- `{u}` -> {d.get('relation', 'imports')} -> `{v}`\n")
        except Exception as e: 
            print(f"Warning: Could not write architecture map for RAG: {e}")

        # Get Project-Level Metrics
        system_metrics = sonar.get_project_metrics(project_key=repo_name)
        
        # 🔔 Alert: Scan Complete
        bugs = system_metrics.get("bugs", 0)
        vulns = system_metrics.get("vulnerabilities", 0)
        
        if vulns > 0:
            alert_system.add_alert(
                title="Critical Issues Found",
                message=f"{repo_name}: Detected {vulns} vulnerabilities during scan. Immediate review required.",
                severity="critical"
            )
        elif bugs > 10:
             alert_system.add_alert(
                title="High Bug Count",
                message=f"{repo_name}: Analysis found {bugs} potential bugs. Consider checking the health panel.",
                severity="warning"
            )
        else:
            alert_system.add_alert(
                title="Knowledge Graph Ready",
                message=f"Successfully mapped {file_count} nodes for {repo_name}. Overall Health: {avg_health:.0f}%",
                severity="success"
            )

        return GraphResponse(
            project_name=os.path.basename(root_path),
            branch=branch,
            nodes=nodes_data,
            edges=edges_data,
            health_score=round(avg_health, 2),
            system_health=SystemHealth(**system_metrics),
            project_root=os.path.abspath(root_path) 
        )
        
    def trigger_sonar_scan(self, input_source: str, branch: str = "main") -> Dict[str, Any]:
        """Triggers the SonarQube scanner for a given repository."""
        repo_name = input_source.rstrip("/").split("/")[-1].replace(".git", "")
        
        # Determine the root path of the project
        if input_source.startswith("http"):
            path = os.path.join(settings.REPO_STORAGE_PATH, repo_name)
            if not os.path.exists(path):
                # If it doesn't exist, clone it first
                path = self._clone_repo(input_source, branch)
        else:
            path = input_source # Local path from Architect
            
        # Alert that scan has started
        alert_system.add_alert(
            title=f"Security Scan Started",
            message=f"Deep analysis for '{repo_name}' is running in the background.",
            severity="info"
        )
        
        # Run the actual scanner
        success = sonar.run_scanner(project_path=path, project_key=repo_name)
        
        if success:
            system_metrics = sonar.get_project_metrics(project_key=repo_name)
            bugs = system_metrics.get("bugs", 0)
            vulns = system_metrics.get("vulnerabilities", 0)
            
            if vulns > 0:
                alert_system.add_alert(
                    title="Critical Issues Found",
                    message=f"{repo_name}: Detected {vulns} vulnerabilities during scan. Immediate review required.",
                    severity="critical"
                )
            elif bugs > 10:
                 alert_system.add_alert(
                    title="High Bug Count",
                    message=f"{repo_name}: Analysis found {bugs} potential bugs. Consider checking the health panel.",
                    severity="warning"
                )
            else:
                alert_system.add_alert(
                    title="Security Scan Complete",
                    message=f"SonarQube completed analysis for {repo_name} successfully.",
                    severity="success"
                )
            
            return {"status": "success", "message": f"Scan completed for {repo_name}"}
        else:
            alert_system.add_alert(
                title="Security Scan Failed",
                message=f"SonarQube failed to analyze {repo_name}.",
                severity="critical"
            )
            return {"status": "error", "message": f"Scan failed for {repo_name}"}
            
    def get_file_content(self, full_path: str) -> str:
        """Reads raw file content from disk."""
        if not os.path.exists(full_path):
            return "# Error: File not found on disk."
        try:
            with open(full_path, "r", encoding="utf-8") as f:
                return f.read()
        except Exception as e:
            return f"# Error reading file: {e}"
        
    def get_commit_history(self, input_source: str) -> List[CommitInfo]:
        """Fetches the last 10 commits from the local clone of the repo."""
        repo_name = input_source.rstrip("/").split("/")[-1].replace(".git", "")
        target_path = os.path.join(settings.REPO_STORAGE_PATH, repo_name)
        
        if not os.path.exists(target_path):
            return []

        try:
            repo = Repo(target_path)
            commits = list(repo.iter_commits(max_count=10))
            
            history = []
            for c in commits:
                history.append(CommitInfo(
                    hash=c.hexsha[:7], # Short hash
                    message=c.message.strip().split('\n')[0], # First line of message
                    author=c.author.name,
                    date=c.committed_datetime.strftime("%b %d, %H:%M")
                ))
            return history
        except Exception as e:
            print(f"Error fetching history: {e}")
            return []

    def generate_docs(self, project_name: str, project_root: str, nodes: List[Any], edges: List[Any]) -> Dict[str, str]:
        """Generates intelligent README.md and PRD.md using LLM context analysis."""
        
        # 1. Fetch Context from Core Files
        project_context = ""
        core_files = ["README.md", "package.json", "requirements.txt", "go.mod", "pom.xml", "main.py", "app.py", "index.ts", "index.js"]
        
        found_context = []
        for file in core_files:
            p = os.path.join(project_root, file)
            if os.path.exists(p):
                try:
                    with open(p, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read(2000) # Read first 2k chars for context
                        found_context.append(f"--- File: {file} ---\n{content}\n")
                except: pass
        
        project_context = "\n".join(found_context) if found_context else "No core config files found."

        # 2. Extract Tech Stack & Health (Heuristics for prompt)
        extensions = {}
        total_bugs = 0
        total_vulns = 0
        for node in nodes:
            label = node.get('label', '') if isinstance(node, dict) else getattr(node, 'label', '')
            if label:
                ext = os.path.splitext(label)[1]
                extensions[ext] = extensions.get(ext, 0) + 1
            
            health = node.get('sonar_health', {}) if isinstance(node, dict) else getattr(node, 'sonar_health', {})
            if health:
                total_bugs += health.get('bugs', 0)
                total_vulns += health.get('vulnerabilities', 0)

        stack = [ext for ext in extensions if extensions[ext] > 2]
        
        # 3. Call LLM for README
        system_prompt = "You are an expert Technical Writer and Software Architect. Your task is to generate professional project documentation based on provided file snippets and architectural metrics."
        
        readme_prompt = f"""
        Generate a comprehensive, high-quality README.md for the project '{project_name}'.
        
        PROJECT CONTEXT (Core Files):
        {project_context}
        
        METRICS:
        - Total Files: {len(nodes)}
        - Tech Stack (inferred): {", ".join(stack)}
        - Bugs: {total_bugs}
        - Vulnerabilities: {total_vulns}
        
        INSTRUCTIONS:
        - Use professional tone.
        - Include sections: Overview, Features, Tech Stack, Getting Started, and Current Health Status.
        - Do not include placeholders like '[Insert here]'.
        - Output ONLY the markdown content of the README.md.
        """

        prd_prompt = f"""
        Generate a professional Product Requirements Document (PRD) for the project '{project_name}'.
        
        PROJECT CONTEXT (Core Files):
        {project_context}
        
        ARCHITECTURE:
        - Nodes: {len(nodes)}
        - Dependencies: {len(edges)}
        
        INSTRUCTIONS:
        - Focus on functional requirements, system architecture, and quality objectives.
        - Inferred functionality based on the file contents provided.
        - Output ONLY the markdown content of the PRD.md.
        """

        try:
            # Generate README
            readme_res = groq_client.chat.completions.create(
                messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": readme_prompt}],
                model="llama-3.3-70b-versatile",
            )
            readme = readme_res.choices[0].message.content

            # Generate PRD
            prd_res = groq_client.chat.completions.create(
                messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": prd_prompt}],
                model="llama-3.3-70b-versatile",
            )
            prd = prd_res.choices[0].message.content

        except Exception as e:
            print(f"LLM Doc Gen Failed: {e}. Falling back to template.")
            # Fallback to simple template (the logic we had before)
            readme = f"# {project_name}\n\nArchitecture mapping complete. (LLM generation failed)"
            prd = f"# PRD: {project_name}\n\nTechnical specs mapped. (LLM generation failed)"

        # 4. Write to disk
        try:
            with open(os.path.join(project_root, "README.md"), "w", encoding="utf-8") as f:
                f.write(readme)
            with open(os.path.join(project_root, "PRD.md"), "w", encoding="utf-8") as f:
                f.write(prd)
        except Exception as e:
            print(f"Warning: Failed to write documentation: {e}")

        return {"readme": readme, "prd": prd, "message": "High-quality documentation generated using AI analysis."}

librarian = LibrarianService()
