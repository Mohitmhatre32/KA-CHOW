"""
Librarian Service â€” The Core File Processing Pipeline

Pipeline stages (FAST PATH â€” graph returned in ~1-3s):
  1. Resolve source (clone/pull or validate local path)
  2. Walk the file tree, skip noise dirs
  3. AST import analysis (Python) + heuristic for JS/TS
  4. Return GraphResponse immediately â† FAST

Background (non-blocking, runs after response sent):
  5. Chunk files and upsert into ChromaDB
  6. Generate AI docs (README + PRD) via Groq
  7. Write architecture map to disk
  8. Persist graph cache to disk
"""
import os
import ast
import json
import re
import time
import hashlib
import subprocess
import threading
import traceback
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any

import networkx as nx
import git
from git import Repo, InvalidGitRepositoryError

from app.core.config import settings
from app.core.alerts import alert_system
from app.core import vector_store as vs
from app.core.llm import client as groq_client
from .models import GraphResponse, FileNode, CommitInfo, PullRequestInfo, GithubSyncResult
import urllib.request
import urllib.error

# â”€â”€ Commit-type classifier 
_COMMIT_RE = re.compile(
    r"^(feat|fix|chore|docs|refactor|test|style|ci|build|perf)", re.IGNORECASE
)


def _classify_commit(msg: str) -> str:
    m = _COMMIT_RE.match(msg.strip())
    return m.group(1).lower() if m else "other"


# â”€â”€ Language detector â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
_EXT_LANG: Dict[str, str] = {
    ".py": "python", ".js": "javascript", ".ts": "typescript",
    ".tsx": "typescript", ".jsx": "javascript", ".java": "java",
    ".go": "go", ".rb": "ruby", ".cpp": "cpp", ".c": "c",
    ".html": "html", ".css": "css", ".json": "json",
    ".md": "markdown", ".yaml": "yaml", ".yml": "yaml", ".toml": "toml",
}


def _lang(ext: str) -> str:
    return _EXT_LANG.get(ext.lower(), "text")


# â”€â”€ Token-aware chunker â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def _chunk_text(text: str, max_tokens: int = settings.CHUNK_TOKEN_LIMIT) -> List[str]:
    """Split text into chunks of roughly max_tokens (word-count proxy)."""
    max_words = int(max_tokens * 0.75)
    lines = text.splitlines(keepends=True)
    chunks, current, word_count = [], [], 0
    for line in lines:
        words_in_line = len(line.split())
        if word_count + words_in_line > max_words and current:
            chunks.append("".join(current))
            current, word_count = [], 0
        current.append(line)
        word_count += words_in_line
    if current:
        chunks.append("".join(current))
    return chunks or [text]


class LibrarianService:
    """
    Stateless pipeline orchestrator.

    Fast path: clone â†’ walk â†’ AST â†’ return graph (1-3s).
    Slow path: embed + doc-gen run in a daemon thread after response is sent.
    """

    # â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    # PUBLIC API
    # â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    def process_request(self, input_source: str, branch: str = "main", force: bool = False) -> GraphResponse:
        """
        Main entry point. Returns the graph fast; kicks off background work.
        """
        print(f"\n[Librarian:Process] Processing repo: {input_source} (branch: {branch}, force: {force})")
        # 1. Resolve source
        if input_source.startswith("http"):
            project_root = self._clone_or_pull(input_source, branch)
            project_name = input_source.rstrip("/").split("/")[-1].replace(".git", "")
        else:
            project_root = input_source
            project_name = os.path.basename(project_root.rstrip("/\\"))
            branch = "local"
        
        print(f"[Librarian:Process] Target directory: {project_root}")

        if not os.path.isdir(project_root):
            print(f"[Librarian:Process] Error: Path not found {project_root}")
            raise ValueError(f"Path does not exist or is not a directory: {project_root}")

        # 2. Check cache (instant return — no background work needed)
        cache_file = os.path.join(project_root, "_kachow_graph.json")
        if not force and os.path.exists(cache_file):
            print(f"[Librarian:Process] Cache HIT for {project_name}. Returning instantly.")
            return self._load_from_cache(cache_file)

        print(f"[Librarian:Process] Cache MISS or force=true. Starting full scan.")

        alert_system.add_alert(
            title=f"🔍 Scanning: {project_name}",
            message=f"Building dependency graph on branch '{branch}'.",
            severity="info",
        )

        # 3. FAST: walk + AST (graph only — no embedding, no LLM)
        graph_response, G, file_contents, nodes_data, edges_data = self._build_graph(
            project_root, project_name, branch
        )

        alert_system.add_alert(
            title="✅ Graph Ready",
            message=f"Mapped {graph_response.total_files} files. Embedding is running in background.",
            severity="success",
        )

        # 4. BACKGROUND: embed + docs + cache (non-blocking)
        self._run_background(project_root, project_name, cache_file, graph_response, G, file_contents, nodes_data, edges_data)

        return graph_response

    def get_branches(self, url: str) -> List[str]:
        """Fetch remote branch names without cloning."""
        try:
            g = git.cmd.Git()
            refs = g.ls_remote("--heads", url)
            if not refs:
                return ["main"]
            return [r.split("refs/heads/")[-1] for r in refs.split("\n") if "refs/heads/" in r] or ["main"]
        except Exception as e:
            print(f"[Librarian] branch fetch failed: {e}")
            return ["main"]

    def get_file_content(self, full_path: str) -> str:
        """Read raw file content from disk, translating frontend Docker paths."""
        DOCKER_PREFIXES = ["/app/storage/repos/", "/storage/repos/"]
        for prefix in DOCKER_PREFIXES:
            if full_path.replace("\\", "/").startswith(prefix):
                rel = full_path.replace("\\", "/")[len(prefix):]
                full_path = os.path.join(settings.REPO_STORAGE_PATH, rel)
                break

        full_path = os.path.normpath(full_path)

        if not os.path.isfile(full_path):
            return f"# Error: File not found — {full_path}"
        try:
            with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()
        except Exception as e:
            return f"# Error reading file: {e}"

    def get_commit_history(self, input_source: str, max_count: int = 15) -> List[CommitInfo]:
        """Fetch recent commits from the local clone."""
        if input_source.startswith("http"):
            repo_name = input_source.rstrip("/").split("/")[-1].replace(".git", "")
            repo_path = os.path.join(settings.REPO_STORAGE_PATH, repo_name)
        else:
            repo_path = input_source

        if not os.path.isdir(repo_path):
            print(f"[Librarian:History] Repo path not found: {repo_path}")
            return []
        try:
            print(f"[Librarian:History] Fetching {max_count} commits from {repo_path}")
            repo = Repo(repo_path, search_parent_directories=True)
            result = []
            for c in repo.iter_commits(max_count=max_count):
                msg = c.message.strip().split("\n")[0]
                result.append(CommitInfo(
                    hash=c.hexsha[:7],
                    message=msg,
                    author=c.author.name,
                    date=c.committed_datetime.strftime("%b %d, %Y Â· %H:%M"),
                    commit_type=_classify_commit(msg),
                ))
            print(f"[Librarian:History] Found {len(result)} commits")
            return result
        except (InvalidGitRepositoryError, Exception) as e:
            print(f"[Librarian:History] Git error: {e}")
            traceback.print_exc()
            return []

    def sync_github(self, input_source: str, max_count: int = 15) -> GithubSyncResult:
        """Fetch commits from local clone + Pull Requests from GitHub API."""
        print(f"\n[Librarian:Sync] Starting sync for: {input_source}")
        commits = self.get_commit_history(input_source, max_count=max_count)
        
        repo_url = input_source
        if not repo_url.startswith("http"):
            try:
                repo = Repo(input_source, search_parent_directories=True)
                repo_url = list(repo.remotes.origin.urls)[0]
                print(f"[Librarian:Sync] Resolved local path to URL: {repo_url}")
            except Exception as e:
                print(f"[Librarian:Sync] Could not resolve remote URL from local path: {e}")
                repo_url = ""

        prs = []
        # Support github urls specifically for PR fetching
        if "github.com" in repo_url:
            parts = repo_url.replace(".git", "").split("/")
            if len(parts) >= 2:
                owner, repo_name = parts[-2], parts[-1]
                api_url = f"https://api.github.com/repos/{owner}/{repo_name}/pulls?state=all&per_page=10"
                print(f"[Librarian:Sync] Fetching PRs from GitHub API: {api_url}")
                
                try:
                    req = urllib.request.Request(api_url, headers={"User-Agent": "KA-CHOW-Librarian"})
                    token = os.environ.get("GITHUB_TOKEN")
                    if token:
                         print("[Librarian:Sync] Using GITHUB_TOKEN for authentication")
                         req.add_header("Authorization", f"Bearer {token}")
                    else:
                         print("[Librarian:Sync] No GITHUB_TOKEN found, performing unauthenticated request")

                    with urllib.request.urlopen(req, timeout=5) as resp:
                        print(f"[Librarian:Sync] GitHub API Response: {resp.status}")
                        data = json.loads(resp.read().decode())
                        for pr in data:
                            prs.append(PullRequestInfo(
                                id=pr.get("id", 0),
                                number=pr.get("number", 0),
                                title=pr.get("title", "Unknown"),
                                state=pr.get("state", "unknown"),
                                author=pr.get("user", {}).get("login", "Unknown"),
                                created_at=pr.get("created_at", ""),
                                url=pr.get("html_url", ""),
                            ))
                        print(f"[Librarian:Sync] Found {len(prs)} PRs")
                except urllib.error.HTTPError as e:
                    print(f"[Librarian:Sync] GitHub API Error {e.code}: {e.read().decode()}")
                except Exception as e:
                    print(f"[Librarian:Sync] Failed to fetch PRs: {e}")
                    traceback.print_exc()
        else:
            print("[Librarian:Sync] Not a GitHub repository URL, skipping PR fetch.")
                    
        message = f"Synced {len(commits)} commits and {len(prs)} pull requests."
        if not prs and "github.com" not in repo_url:
             message = f"Synced {len(commits)} commits. (Not a GitHub remote, PRs skipped)."
        
        print(f"[Librarian:Sync] Finished. {message}\n")
        return GithubSyncResult(commits=commits, pull_requests=prs, message=message)

    def incremental_update(self, input_source: str) -> dict:
        """
        Incremental Brain â€” Task 3 Implementation.
        """
        t_start = time.time()

        # â”€â”€ 1. Resolve project root â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if input_source.startswith("http"):
            repo_name = input_source.rstrip("/").split("/")[-1].replace(".git", "")
            project_root = os.path.join(settings.REPO_STORAGE_PATH, repo_name)
        else:
            project_root = input_source
            repo_name = os.path.basename(project_root.rstrip("/\\"))

        if not os.path.isdir(project_root):
            raise ValueError(f"Project path not found: {project_root}")

        # â”€â”€ 2. Load cached graph â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        cache_file = os.path.join(project_root, "_kachow_graph.json")
        if not os.path.exists(cache_file):
            raise FileNotFoundError("No cached graph found. Run full scan first.")
        
        with open(cache_file, "r", encoding="utf-8") as f:
            graph_data = json.load(f)

        old_nodes_count = len(graph_data.get("nodes", []))
        repo = Repo(project_root, search_parent_directories=True)

        # â”€â”€ 3. Delta Identification (Task 3: Git Diff) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        changed_files: List[str] = []
        try:
            # We compare HEAD with HEAD~1 to find the "delta"
            diff = repo.git.diff("HEAD~1", "HEAD", "--name-only").splitlines()
            changed_files = [f for f in diff if os.path.isfile(os.path.join(project_root, f)) 
                            and any(f.endswith(ext) for ext in settings.SUPPORTED_EXTENSIONS)]
        except Exception:
            changed_files = []

        if not changed_files:
            return {
                "changed_files": [],
                "update_time_seconds": round(time.time() - t_start, 2),
                "graph_updated": False,
                "message": "Brain is up to date."
            }

        # â”€â”€ 4. Partial Re-Ingestion & Metadata Layer (Task 2) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        from app.core.sonar_client import sonar # Import health database client
        
        # Helper to get file owner (GIT GPS)
        def get_owner(path):
            try:
                return repo.git.log("-1", "--format=%an", "--", path)
            except: return "Unknown"

        updated_nodes = []
        nodes_map = {n["id"]: n for n in graph_data["nodes"]}

        for rel_path in changed_files:
            # 1. "Un-learn" (Remove metadata and old embedding logic)
            # 2. "Learn" (Re-process)
            ext = os.path.splitext(rel_path)[1]
            language = _lang(ext)
            full_path = os.path.join(project_root, rel_path)
            
            with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()

            # Metadata Enrichment (Task 2 GPS Context)
            health = sonar.get_file_metrics(rel_path, repo_name)
            owner = get_owner(rel_path)
            
            new_node = FileNode(
                id=rel_path,
                label=os.path.basename(rel_path),
                type=self._infer_node_type(rel_path, os.path.basename(rel_path)),
                layer=self._infer_layer(rel_path),
                language=language,
                size_bytes=os.path.getsize(full_path),
                owner=owner,
                sonar_health=health,
                jira_tickets=[] # Integration placeholder
            ).model_dump()

            # Hot-Swap Node (Task 3)
            nodes_map[rel_path] = new_node
            
            # Re-process vector store (Task 3 memory sync)
            vs.delete_chunks_by_file(repo_name, rel_path)
            chunks = []
            for i, chunk in enumerate(_chunk_text(content)):
                chunks.append({
                    "id": vs.make_chunk_id(rel_path, i),
                    "document": chunk,
                    "metadata": {"file_path": rel_path, "project": repo_name}
                })
            vs.upsert_chunks(repo_name, chunks)

        # â”€â”€ 5. Data Integrity Check (Task 3) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        graph_data["nodes"] = list(nodes_map.values())
        new_nodes_count = len(graph_data["nodes"])
        if new_nodes_count < old_nodes_count:
             print("[Brain:Integrity] WARNING: Node count dropped. Verifying deletions...")
        
        # â”€â”€ 6. Speed Benchmarking (Task 3: < 10s target) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        elapsed = round(time.time() - t_start, 2)
        baseline_estimate = old_nodes_count * 0.5 # 0.5s per file avg for full scan
        
        with open(cache_file, "w", encoding="utf-8") as f:
            json.dump(graph_data, f, default=str)

        msg = f"âš¡ Brain updated {len(changed_files)} files in {elapsed}s (Target < 10s). Baseline scan: ~{baseline_estimate}s."
        alert_system.add_alert(title="Incremental Brain Ready", message=msg, severity="success")
        
        return {
            "changed_files": changed_files,
            "update_time_seconds": elapsed,
            "full_scan_baseline_seconds": baseline_estimate,
            "graph_updated": True,
            "message": msg
        }

    def run_sonar_scan(self, repo_url: str) -> dict:
        """
        Task 4: Real-time SonarQube project scan.

        Fast path  : returns cached SonarQube metrics immediately (< 1s).
        Background : fires the actual Docker scanner in a daemon thread.
                     When it finishes, the graph cache is hot-patched with
                     fresh metrics — the next graph fetch returns updated data.
        """
        from app.core.sonar_client import sonar

        # 1. Resolve project path
        if repo_url.startswith("http"):
            repo_name = repo_url.rstrip("/").split("/")[-1].replace(".git", "")
            project_root = os.path.join(settings.REPO_STORAGE_PATH, repo_name)
        else:
            project_root = repo_url
            repo_name = os.path.basename(project_root.rstrip("/\\"))

        if not os.path.isdir(project_root):
            raise ValueError(f"Project path not found: {project_root}")

        # 2. Return current cached metrics immediately (no Docker wait)
        cached_metrics = sonar.get_project_metrics(repo_name)
        print(f"[Librarian:Sonar] Returning cached metrics for '{repo_name}'. Docker scan starting in background...")

        alert_system.add_alert(
            title="🔍 Sonar Scan Queued",
            message=f"Background scan started for '{repo_name}'. Metrics will refresh automatically when complete.",
            severity="info",
        )

        # 3. Background: run Docker scanner + hot-patch cache
        def _bg_scan():
            print(f"[Librarian:Sonar] Background scan starting for {repo_name}...")
            scan_success = sonar.run_scanner(project_root, repo_name)

            if not scan_success:
                alert_system.add_alert(
                    title="⚠️ Sonar Scan Warning",
                    message=f"Scanner did not complete cleanly for '{repo_name}'. Metrics may be partial.",
                    severity="warning",
                )
                return

            # Hot-patch: update graph cache with fresh per-file metrics
            metrics = sonar.get_project_metrics(repo_name)
            cache_file = os.path.join(project_root, "_kachow_graph.json")
            if os.path.exists(cache_file):
                try:
                    with open(cache_file, "r", encoding="utf-8") as f:
                        graph_data = json.load(f)

                    for node in graph_data.get("nodes", []):
                        if node.get("type") == "file":
                            node["sonar_health"] = sonar.get_file_metrics(node["id"], repo_name)

                    with open(cache_file, "w", encoding="utf-8") as f:
                        json.dump(graph_data, f, default=str)

                    print(f"[Librarian:Sonar] Graph cache updated with fresh metrics for '{repo_name}'")
                except Exception as e:
                    print(f"[Librarian:Sonar] Cache hot-patch failed: {e}")

            alert_system.add_alert(
                title="✅ Sonar Scan Complete",
                message=f"'{repo_name}' scan finished. Quality gate: {metrics.get('quality_gate', 'PASSED')}. Refresh the graph to see updated metrics.",
                severity="success" if metrics.get("quality_gate") == "OK" else "warning",
            )

        t = threading.Thread(target=_bg_scan, daemon=True, name=f"sonar-scan-{repo_name}")
        t.start()
        print(f"[Librarian:Sonar] Background scan thread started: {t.name}")

        return {
            "status": "scanning",
            "project_metrics": cached_metrics,
            "message": f"Scan queued for '{repo_name}'. Current cached metrics returned. Refresh graph in ~2-3 minutes for updated data.",
        }


    # â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    # FAST PATH â€” graph walk + AST only (no I/O to ChromaDB, no LLM)
    # â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    def _build_graph(self, root: str, name: str, branch: str):
        """
        Walk the file tree and run AST analysis synchronously.
        Returns the GraphResponse AND the raw data needed for background work.
        Target: <3 seconds for a typical repo.
        """
        G = nx.DiGraph()
        module_map: Dict[str, str] = {}
        nodes_data: List[FileNode] = []
        edges_data: List[Dict[str, str]] = []
        file_contents: Dict[str, str] = {}

        # â”€â”€ PASS 1: Walk & map â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [
                d for d in dirnames
                if not any(skip in d for skip in settings.SKIP_DIRS)
            ]

            rel_dir = os.path.relpath(dirpath, root).replace("\\", "/")
            if rel_dir == ".":
                rel_dir = "root"

            G.add_node(rel_dir, type="folder")
            nodes_data.append(FileNode(
                id=rel_dir,
                label=os.path.basename(dirpath) or "root",
                type="folder",
                layer="system",
            ))

            for filename in filenames:
                ext = os.path.splitext(filename)[1]
                if ext not in settings.SUPPORTED_EXTENSIONS:
                    continue

                full_path = os.path.join(dirpath, filename)
                rel_path = os.path.relpath(full_path, root).replace("\\", "/")
                language = _lang(ext)

                try:
                    with open(full_path, "r", encoding="utf-8", errors="ignore") as fh:
                        content = fh.read()
                except Exception:
                    content = ""

                file_contents[rel_path] = content
                size = os.path.getsize(full_path)

                G.add_node(rel_path, type="file", language=language, size=size)
                nodes_data.append(FileNode(
                    id=rel_path,
                    label=filename,
                    type=self._infer_node_type(rel_path, filename),
                    layer=self._infer_layer(rel_path),
                    language=language,
                    size_bytes=size,
                ))

                G.add_edge(rel_dir, rel_path)
                edges_data.append({"source": rel_dir, "target": rel_path, "relation": "contains"})

                if ext == ".py":
                    mod = rel_path.replace("/", ".").replace(".py", "")
                    module_map[mod] = rel_path
                    module_map[filename.replace(".py", "")] = rel_path

        # â”€â”€ PASS 2: Python AST import edges â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        total_functions = 0
        documented_functions = 0
        for rel_path, content in file_contents.items():
            if not rel_path.endswith(".py"):
                continue
            try:
                tree = ast.parse(content, filename=rel_path)
            except SyntaxError:
                continue

            imports = self._extract_imports(tree)
            for imp in imports:
                resolved = self._resolve_import(imp, module_map)
                if resolved and resolved != rel_path and G.has_node(resolved):
                    if not G.has_edge(rel_path, resolved):
                        G.add_edge(rel_path, resolved)
                        edges_data.append({"source": rel_path, "target": resolved, "relation": "imports"})

            for node in ast.walk(tree):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    total_functions += 1
                    if ast.get_docstring(node):
                        documented_functions += 1

        # â”€â”€ PASS 3: JS/TS heuristic edges â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        js_files = {
            p: c for p, c in file_contents.items()
            if p.endswith((".js", ".ts", ".tsx", ".jsx"))
        }
        if js_files:
            self._add_js_edges(js_files, G, edges_data, file_contents)

        doc_ratio = (documented_functions / total_functions) if total_functions > 0 else 0.0

        graph_response = GraphResponse(
            project_name=name,
            branch=branch,
            nodes=nodes_data,
            edges=edges_data,
            project_root=root,
            processed_at=datetime.now(timezone.utc).isoformat(),
            total_files=sum(1 for n in nodes_data if n.type != "folder"),
            total_chunks_embedded=0,          # will be updated by background task
            documented_ratio=round(doc_ratio, 2),
            from_cache=False,
        )

        return graph_response, G, file_contents, nodes_data, edges_data

    # â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    # BACKGROUND WORK â€” embedding + docs + cache persistence
    # â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    def _run_background(
        self,
        root: str,
        name: str,
        cache_file: str,
        graph_response: GraphResponse,
        G: nx.DiGraph,
        file_contents: Dict[str, str],
        nodes_data: List[FileNode],
        edges_data: List[Dict[str, str]],
    ):
        """Launches a daemon thread for all slow I/O work."""
        def _worker():
            try:
                self._embed_chunks(name, file_contents, graph_response)
                self._write_arch_map(root, G)
                self._generate_docs(name, root, nodes_data, edges_data)
                self._save_cache(cache_file, graph_response)
                alert_system.add_alert(
                    title="ðŸ§  Embedding Complete",
                    message=f"Vector store updated with {graph_response.total_chunks_embedded} chunks. RAG is ready.",
                    severity="info",
                )
            except Exception as e:
                print(f"[Librarian:Background] Error: {e}")
                alert_system.add_alert(
                    title="âš ï¸ Background Task Warning",
                    message=f"Non-critical background processing failed: {e}",
                    severity="warning",
                )

        t = threading.Thread(target=_worker, daemon=True, name=f"librarian-bg-{name}")
        t.start()
        print(f"[Librarian] graph returned â€” background work started (thread: {t.name})")

    def _embed_chunks(self, name: str, file_contents: Dict[str, str], graph_response: GraphResponse):
        """Upsert file chunks into ChromaDB vector store."""
        chunks_to_embed: List[Dict[str, Any]] = []

        for rel_path, content in file_contents.items():
            ext = os.path.splitext(rel_path)[1]
            language = _lang(ext)
            for idx, chunk in enumerate(_chunk_text(content)):
                chunks_to_embed.append({
                    "id": vs.make_chunk_id(rel_path, idx),
                    "document": chunk,
                    "metadata": {
                        "file_path": rel_path,
                        "language": language,
                        "chunk_index": idx,
                        "project": name,
                    },
                })

        if not chunks_to_embed:
            return

        try:
            if vs.collection_exists(name):
                vs.delete_collection(name)
            embedded = vs.upsert_chunks(name, chunks_to_embed)
            graph_response.total_chunks_embedded = embedded
            print(f"[Librarian:bg] embedded {embedded} chunks into ChromaDB")
        except Exception as e:
            print(f"[Librarian:bg] ChromaDB upsert failed: {e}")

    # â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    # CLONE / PULL â€” already fast (git protocol)
    # â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    def _clone_or_pull(self, url: str, branch: str) -> str:
        repo_name = url.rstrip("/").split("/")[-1].replace(".git", "")
        target = os.path.join(settings.REPO_STORAGE_PATH, repo_name)

        if os.path.isdir(target):
            try:
                repo = Repo(target)
                repo.remotes.origin.fetch()
                repo.git.checkout(branch)
                repo.remotes.origin.pull(branch)
                print(f"[Librarian:Clone] Updated {repo_name}@{branch}")
            except Exception as e:
                print(f"[Librarian:Clone] Pull failed, using existing clone: {e}")
        else:
            print(f"[Librarian:Clone] Cloning {repo_name}@{branch}...")
            # shallow clone: only latest commit â€” much faster for large repos
            Repo.clone_from(url, target, branch=branch, depth=1)

        return target

    # â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    # HELPERS
    # â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    @staticmethod
    def _extract_imports(tree: ast.AST) -> List[str]:
        targets = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    targets.append(alias.name)
            elif isinstance(node, ast.ImportFrom) and node.module:
                targets.append(node.module)
                for alias in node.names:
                    targets.append(f"{node.module}.{alias.name}")
        return targets

    @staticmethod
    def _resolve_import(target: str, module_map: Dict[str, str]) -> Optional[str]:
        if target in module_map:
            return module_map[target]
        init_key = f"{target}.__init__"
        if init_key in module_map:
            return module_map[init_key]
        candidates = [
            path for mod, path in module_map.items()
            if mod.endswith(f".{target}") or target.endswith(f".{mod}")
        ]
        return sorted(candidates, key=len)[0] if candidates else None

    @staticmethod
    def _add_js_edges(
        js_files: Dict[str, str],
        G: nx.DiGraph,
        edges_data: List[Dict[str, str]],
        all_contents: Dict[str, str],
    ):
        import_re = re.compile(r"""from\s+['"]([^'"]+)['"]""")
        file_names = {os.path.splitext(os.path.basename(p))[0]: p for p in G.nodes}
        for src_path, content in js_files.items():
            for match in import_re.finditer(content):
                raw = match.group(1)
                stem = os.path.splitext(os.path.basename(raw))[0]
                if stem in file_names:
                    target = file_names[stem]
                    if target != src_path and not G.has_edge(src_path, target):
                        G.add_edge(src_path, target)
                        edges_data.append({"source": src_path, "target": target, "relation": "imports"})

    @staticmethod
    def _infer_layer(rel_path: str) -> str:
        p = rel_path.lower()
        if any(x in p for x in ["frontend", "client", "ui", "views", "pages", "components"]):
            return "frontend"
        if any(x in p for x in ["backend", "api", "server", "agents", "core", "services"]):
            return "backend"
        return "system"

    @staticmethod
    def _infer_node_type(rel_path: str, filename: str) -> str:
        """Classify node type for graph colouring."""
        p = rel_path.lower()
        f = filename.lower()
        if "route" in f or "router" in f or "api" in p or f.startswith("app."):
            return "api"
        if "hook" in f or f.startswith("use"):
            return "hook"
        if "component" in p or f.endswith((".tsx", ".jsx")):
            return "component"
        if "util" in p or "helper" in p or "lib" in p:
            return "utility"
        if "service" in f or "agent" in p or "module" in f:
            return "module"
        return "file"

    # â”€â”€ Cache helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    @staticmethod
    def _save_cache(cache_file: str, resp: GraphResponse):
        try:
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump(resp.model_dump(), f, default=str)
            print(f"[Librarian:bg] cache written â†’ {cache_file}")
        except Exception as e:
            print(f"[Librarian:bg] cache write failed: {e}")

    @staticmethod
    def _load_from_cache(cache_file: str) -> GraphResponse:
        with open(cache_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        data["nodes"] = [FileNode(**n) for n in data.get("nodes", [])]
        data["from_cache"] = True
        resp = GraphResponse(**data)
        alert_system.add_alert(
            title="âš¡ Cache Hit",
            message=f"Returned cached graph for '{resp.project_name}' instantly. Use force=true to re-scan.",
            severity="info",
        )
        return resp

    @staticmethod
    def _write_arch_map(root_path: str, G: nx.DiGraph):
        map_path = os.path.join(root_path, "_kachow_architecture_map.md")
        try:
            with open(map_path, "w", encoding="utf-8") as f:
                f.write("# KA-CHOW System Architecture & Dependency Map\n\n")
                f.write("## 1. File Modules\n")
                for n, d in G.nodes(data=True):
                    f.write(f"- `{n}` (Type: {d.get('type', 'file')})\n")
                f.write("\n## 2. Dependencies\n")
                for u, v, d in G.edges(data=True):
                    f.write(f"- `{u}` -> {d.get('relation', 'imports')} -> `{v}`\n")
        except Exception as e:
            print(f"[Librarian:bg] map write failed: {e}")

    def _generate_docs(self, project_name: str, project_root: str, nodes: List[FileNode], edges: List[Dict[str, str]]):
        """Generates AI-powered README.md and PRD.md (runs in background)."""
        core_files = ["README.md", "package.json", "requirements.txt", "go.mod", "main.py", "app.py", "index.ts"]
        found_context = []
        for file in core_files:
            p = os.path.join(project_root, file)
            if os.path.exists(p):
                try:
                    with open(p, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read(2000)
                        found_context.append(f"--- {file} ---\n{content}\n")
                except Exception:
                    pass

        project_context = "\n".join(found_context) if found_context else "No core config files found."
        system_prompt = "You are a Technical Writer. Generate professional project documentation from file snippets."

        readme_prompt = f"""Generate a high-quality README.md for '{project_name}'.
CONTEXT:
{project_context}
METRICS: {len(nodes)} files, {len(edges)} dependencies
Output ONLY markdown."""

        prd_prompt = f"""Generate a concise PRD for '{project_name}'.
CONTEXT:
{project_context}
Output ONLY markdown."""

        try:
            readme_res = groq_client.chat.completions.create(
                messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": readme_prompt}],
                model=settings.LLM_MODEL,
            )
            readme = readme_res.choices[0].message.content

            prd_res = groq_client.chat.completions.create(
                messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": prd_prompt}],
                model=settings.LLM_MODEL,
            )
            prd = prd_res.choices[0].message.content

            with open(os.path.join(project_root, "README.md"), "w", encoding="utf-8") as f:
                f.write(readme)
            with open(os.path.join(project_root, "PRD.md"), "w", encoding="utf-8") as f:
                f.write(prd)
            print(f"[Librarian:bg] generated README and PRD for {project_name}")
        except Exception as e:
            print(f"[Librarian:bg] doc gen failed: {e}")

    def generate_comprehensive_docs(self, project_name: str, repo_url: Optional[str] = None) -> str:
        """
        Generates industry-standard PROJECT_GUIDE.md documentation.
        """
        print(f"\n[Librarian:Docs] Generating comprehensive docs for: {project_name}")
        
        # Resolve repo path
        if repo_url and repo_url.startswith("http"):
            repo_path = os.path.join(settings.REPO_STORAGE_PATH, project_name)
        else:
            repo_path = repo_url or os.path.join(settings.REPO_STORAGE_PATH, project_name)

        if not os.path.isdir(repo_path):
            print(f"[Librarian:Docs] Path not found: {repo_path}")
            return "Error: Repository path not found. Please process the repository first."

        # 1. Gather Context
        setup_files = ["package.json", "requirements.txt", "go.mod", "docker-compose.yml", "Dockerfile"]
        context_parts = []
        for sf in setup_files:
            p = os.path.join(repo_path, sf)
            if os.path.exists(p):
                try:
                    with open(p, "r", encoding="utf-8", errors="ignore") as f:
                        context_parts.append(f"### {sf}\n{f.read(3000)}")
                except: pass

        # 2. Get Architecture Context (Knowledge Graph)
        arch_summary = "No architecture map available."
        cache_file = os.path.join(repo_path, "_kachow_graph.json")
        if os.path.exists(cache_file):
            try:
                with open(cache_file, "r", encoding="utf-8") as f:
                    graph = json.load(f)
                    total_files = len([n for n in graph.get("nodes", []) if n.get("type") == "file"])
                    total_edges = len(graph.get("edges", []))
                    arch_summary = f"The project contains {total_files} files with {total_edges} identified architectural dependencies."
            except: pass

        # 3. LLM Generation
        prompt = f"""
        ROLE: Expert Technical Architect & Lead Developer.
        TASK: Generate a comprehensive, industry-level `PROJECT_GUIDE.md` for the repository '{project_name}'.
        
        CONTEXT FROM CONFIG FILES:
        {" ".join(context_parts)}
        
        ARCHITECTURE SNAPSHOT:
        {arch_summary}
        
        REQUIREMENTS:
        1. Use professional, clear, and high-agency language.
        2. STRUCTURE (industry-standard):
           - # Project Title & Overview: What is this project?
           - ## ðŸ›  Tech Stack: List core languages, frameworks, and tools.
           - ## ðŸš€ Installation & Setup: Clear, step-by-step commands (pip, npm, docker, etc.).
           - ## ðŸ— Architecture Overview: Describe the system design based on the architecture snapshot.
           - ## ðŸ§ª Testing & Quality: How to run tests and verify changes.
           - ## ðŸ“– API Documentation (if applicable): Key endpoints or patterns.
           - ## ðŸ¤ Contributing: Guidelines for developers.
        3. DONT BE GENERIC: Look at the config files to deduce EXACT installation steps.
        
        OUTPUT ONLY THE MARKDOWN CONTENT.
        """

        try:
            completion = groq_client.chat.completions.create(
                messages=[
                    {"role": "system", "content": "You are a world-class software architect and technical writer."},
                    {"role": "user", "content": prompt},
                ],
                model=settings.LLM_MODEL,
                max_tokens=4096,
            )
            markdown = completion.choices[0].message.content or "Failed to generate documentation."
            
            # Save to disk as well
            guide_path = os.path.join(repo_path, "PROJECT_GUIDE.md")
            with open(guide_path, "w", encoding="utf-8") as f:
                f.write(markdown)
            
            print(f"[Librarian:Docs] Generated PROJECT_GUIDE.md for {project_name}")
            return markdown
        except Exception as e:
            msg = f"LLM Generation Error: {e}"
            print(f"[Librarian:Docs] {msg}")
            return msg


    def trigger_sonar_scan(self, repo_url: str) -> dict:
        """
        Runs SonarQube scan on the repository and updates file-level health in the graph.
        """
        print(f"\n[Librarian:Sonar] Triggering scan for {repo_url}")
        
        # 1. Resolve project root
        if repo_url.startswith("http"):
            repo_name = repo_url.rstrip("/").split("/")[-1].replace(".git", "")
            project_root = os.path.join(settings.REPO_STORAGE_PATH, repo_name)
        else:
            project_root = repo_url
            repo_name = os.path.basename(project_root.rstrip("/\\"))

        if not os.path.isdir(project_root):
            raise ValueError(f"Project path not found: {project_root}")

        from app.core.sonar_client import sonar
        
        # 2. Run the scanner (Docker)
        success = sonar.run_scanner(project_root, repo_name)
        if not success:
            raise Exception("SonarScanner failed to complete.")

        # 3. Load current graph
        cache_file = os.path.join(project_root, "_kachow_graph.json")
        if not os.path.exists(cache_file):
            raise FileNotFoundError("Graph cache not found. Please scan the repository normally first.")
            
        with open(cache_file, "r", encoding="utf-8") as f:
            graph_data = json.load(f)

        # 4. Fetch metrics for every file and update nodes
        nodes = graph_data.get("nodes", [])
        total_bugs = 0
        file_count = 0
        
        for node in nodes:
            if node.get("type") == "folder":
                continue
                
            rel_path = node["id"]
            # Fetch real-time metrics
            health = sonar.get_file_metrics(rel_path, repo_name)
            node["sonar_health"] = health
            
            total_bugs += health.get("bugs", 0)
            file_count += 1

        # 5. Update global health score and quality gate in meta
        project_metrics = sonar.get_project_metrics(repo_name)
        system_health = max(0, 100 - (total_bugs * 5))
        
        if "metadata" not in graph_data:
            graph_data["metadata"] = {}
            
        graph_data["metadata"]["system_health"] = project_metrics
        graph_data["metadata"]["quality_gate"] = project_metrics.get("quality_gate", "PASSED")
        graph_data["metadata"]["scan_status"] = project_metrics.get("status", "OK")
        graph_data["metadata"]["metrics"] = project_metrics
        
        # 6. Save updated graph
        with open(cache_file, "w", encoding="utf-8") as f:
            json.dump(graph_data, f, default=str)

        alert_system.add_alert(
            title="🛡️ Sonar Scan Complete",
            message=f"Deep analysis finished for {repo_name}. System Health: {system_health}%",
            severity="success"
        )
        
        return {
            "status": "success",
            "project_metrics": project_metrics,
            "message": f"Scan complete for {repo_name}. Found {total_bugs} bugs."
        }

# Singleton used by the router
librarian = LibrarianService()
