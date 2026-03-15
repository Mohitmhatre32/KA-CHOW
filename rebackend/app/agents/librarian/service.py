"""
Librarian Service — The Core File Processing Pipeline

Pipeline stages:
  1. Resolve source (clone/pull or validate local path)
  2. Walk the file tree, skip noise dirs
  3. AST import analysis (Python) + heuristic for JS/TS
  4. Token-aware content chunking
  5. Upsert chunks into ChromaDB
  6. Persist graph.json + file_index.json to disk
  7. Return GraphResponse (or hit cache if force=False)
"""
import os
import ast
import json
import re
import time
import hashlib
import subprocess
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple, Any

import networkx as nx
import git
from git import Repo, InvalidGitRepositoryError

from app.core.config import settings
from app.core.alerts import alert_system
from app.core import vector_store as vs
from app.core.llm import client as groq_client
from .models import GraphResponse, FileNode, CommitInfo

# ── Commit-type classifier ───────────────────────────────────────────────────
_COMMIT_RE = re.compile(
    r"^(feat|fix|chore|docs|refactor|test|style|ci|build|perf)", re.IGNORECASE
)


def _classify_commit(msg: str) -> str:
    m = _COMMIT_RE.match(msg.strip())
    return m.group(1).lower() if m else "other"


# ── Language detector ────────────────────────────────────────────────────────
_EXT_LANG: Dict[str, str] = {
    ".py": "python", ".js": "javascript", ".ts": "typescript",
    ".tsx": "typescript", ".jsx": "javascript", ".java": "java",
    ".go": "go", ".rb": "ruby", ".cpp": "cpp", ".c": "c",
    ".html": "html", ".css": "css", ".json": "json",
    ".md": "markdown", ".yaml": "yaml", ".yml": "yaml", ".toml": "toml",
}


def _lang(ext: str) -> str:
    return _EXT_LANG.get(ext.lower(), "text")


# ── Token-aware chunker (no external tokeniser needed at runtime) ─────────────

def _chunk_text(text: str, max_tokens: int = settings.CHUNK_TOKEN_LIMIT) -> List[str]:
    """
    Split text into chunks of roughly max_tokens.
    We use a simple word-count proxy (1 token ≈ 0.75 words) to avoid
    loading tiktoken in the hot path. Preserves line boundaries.
    """
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
    Graph lives in NetworkX in-memory during processing; then serialised to disk.
    """

    # ─────────────────────────────────────────────────────────────────────────
    # PUBLIC API
    # ─────────────────────────────────────────────────────────────────────────

    def process_request(self, input_source: str, branch: str = "main", force: bool = False) -> GraphResponse:
        """
        Main entry point. Runs the full pipeline or returns cached result.
        """
        # 1. Resolve source
        if input_source.startswith("http"):
            project_root = self._clone_or_pull(input_source, branch)
            project_name = input_source.rstrip("/").split("/")[-1].replace(".git", "")
        else:
            project_root = input_source
            project_name = os.path.basename(project_root.rstrip("/\\"))
            branch = "local"

        if not os.path.isdir(project_root):
            raise ValueError(f"Path does not exist or is not a directory: {project_root}")

        # 2. Check cache
        cache_file = os.path.join(project_root, "_kachow_graph.json")
        if not force and os.path.exists(cache_file):
            return self._load_from_cache(cache_file)

        # 3. Run pipeline
        alert_system.add_alert(
            title=f"🔍 Scanning: {project_name}",
            message=f"Starting file processing pipeline on branch '{branch}'.",
            severity="info",
        )

        graph_response = self._run_pipeline(project_root, project_name, branch)

        # 4. Persist graph to disk
        self._save_cache(cache_file, graph_response)

        alert_system.add_alert(
            title="✅ Project Loaded",
            message=f"Mapped {graph_response.total_files} files, embedded {graph_response.total_chunks_embedded} chunks.",
            severity="success",
        )
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
        """Read raw file content from disk."""
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
            return []
        try:
            repo = Repo(repo_path, search_parent_dirs=True)
            result = []
            for c in repo.iter_commits(max_count=max_count):
                msg = c.message.strip().split("\n")[0]
                result.append(CommitInfo(
                    hash=c.hexsha[:7],
                    message=msg,
                    author=c.author.name,
                    date=c.committed_datetime.strftime("%b %d, %Y · %H:%M"),
                    commit_type=_classify_commit(msg),
                ))
            return result
        except (InvalidGitRepositoryError, Exception) as e:
            print(f"[Librarian] git history error: {e}")
            return []

    def incremental_update(self, input_source: str) -> dict:
        """
        Incremental Brain — Task 3 Implementation.

        Instead of a full re-scan (which may take 60+ seconds on large repos),
        this method:
          1. Runs `git diff --name-only HEAD~1` to find ONLY changed files.
          2. Re-processes just those files (re-chunks + upserts to ChromaDB).
          3. Hot-swaps the affected graph nodes/edges in the cached graph.json.
          4. Returns a benchmark comparing update time vs a full-scan estimate.

        This proves the system is "living" — updates in seconds, not minutes.
        """
        t_start = time.time()

        # ── 1. Resolve project root ───────────────────────────────────────────
        if input_source.startswith("http"):
            repo_name = input_source.rstrip("/").split("/")[-1].replace(".git", "")
            project_root = os.path.join(settings.REPO_STORAGE_PATH, repo_name)
        else:
            project_root = input_source
            repo_name = os.path.basename(project_root.rstrip("/\\"))

        if not os.path.isdir(project_root):
            raise ValueError(f"Project path not found: {project_root}")

        # ── 2. Load cached graph (so we can hot-swap nodes) ──────────────────
        cache_file = os.path.join(project_root, "_kachow_graph.json")
        if not os.path.exists(cache_file):
            raise FileNotFoundError(
                "No cached graph found. Please run a full scan first via /librarian/process."
            )
        with open(cache_file, "r", encoding="utf-8") as f:
            graph_data = json.load(f)

        total_files = sum(1 for n in graph_data.get("nodes", []) if n.get("type") == "file")

        # ── 3. Get changed files via git diff ─────────────────────────────────
        changed_files: List[str] = []
        try:
            result = subprocess.run(
                ["git", "diff", "--name-only", "--diff-filter=ACM", "HEAD~1", "HEAD"],
                cwd=project_root,
                capture_output=True,
                text=True,
                timeout=15,
            )
            raw_changed = [
                f.strip() for f in result.stdout.splitlines()
                if f.strip() and os.path.isfile(os.path.join(project_root, f.strip()))
                and any(f.strip().endswith(ext) for ext in settings.SUPPORTED_EXTENSIONS)
            ]
            changed_files = raw_changed
        except (subprocess.TimeoutExpired, FileNotFoundError):
            # git not available or no history — do nothing
            changed_files = []

        if not changed_files:
            elapsed = round(time.time() - t_start, 2)
            # Estimate full scan time: ~0.5s per file as baseline
            baseline = round(total_files * 0.5, 1)
            return {
                "changed_files": [],
                "skipped_files": total_files,
                "total_files": total_files,
                "update_time_seconds": elapsed,
                "full_scan_baseline_seconds": baseline,
                "graph_updated": False,
                "message": f"No changed files detected. Graph is already up to date. (Checked in {elapsed}s)",
            }

        # ── 4. Re-process only changed files ──────────────────────────────────
        chunks_to_embed: List[dict] = []
        module_map: Dict[str, str] = {}

        for rel_path in changed_files:
            full_path = os.path.join(project_root, rel_path)
            ext = os.path.splitext(rel_path)[1]
            language = _lang(ext)

            try:
                with open(full_path, "r", encoding="utf-8", errors="ignore") as fh:
                    content = fh.read()
            except OSError:
                continue

            # Re-chunk the updated file
            for idx, chunk in enumerate(_chunk_text(content)):
                chunks_to_embed.append({
                    "id": vs.make_chunk_id(rel_path, idx),
                    "document": chunk,
                    "metadata": {
                        "file_path": rel_path,
                        "language": language,
                        "chunk_index": idx,
                        "project": repo_name,
                    },
                })

            # Build module map for Python hot-swap
            if ext == ".py":
                mod = rel_path.replace("/", ".").replace(".py", "")
                module_map[mod] = rel_path
                module_map[os.path.basename(rel_path).replace(".py", "")] = rel_path

        # Upsert changed chunks (ChromaDB upsert is idempotent)
        if chunks_to_embed:
            try:
                vs.upsert_chunks(repo_name, chunks_to_embed)
            except Exception as e:
                print(f"[Librarian][Incremental] ChromaDB upsert failed: {e}")

        # ── 5. Hot-swap graph edges for changed Python files ──────────────────
        existing_edges = graph_data.get("edges", [])
        # Remove stale imports FROM changed files (we will re-add below)
        pruned_edges = [
            e for e in existing_edges
            if not (e.get("source") in changed_files and e.get("relation") == "imports")
        ]

        for rel_path in changed_files:
            if not rel_path.endswith(".py"):
                continue
            full_path = os.path.join(project_root, rel_path)
            try:
                with open(full_path, "r", encoding="utf-8", errors="ignore") as fh:
                    content = fh.read()
                tree = ast.parse(content, filename=rel_path)
                imports = self._extract_imports(tree)
                known_files = {n["id"] for n in graph_data.get("nodes", [])}
                for imp in imports:
                    resolved = self._resolve_import(imp, module_map)
                    if resolved and resolved != rel_path and resolved in known_files:
                        new_edge = {"source": rel_path, "target": resolved, "relation": "imports"}
                        if new_edge not in pruned_edges:
                            pruned_edges.append(new_edge)
            except (SyntaxError, OSError):
                continue

        graph_data["edges"] = pruned_edges

        # ── 6. Persist updated graph cache ────────────────────────────────────
        try:
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump(graph_data, f, default=str)
        except OSError as e:
            print(f"[Librarian][Incremental] Cache write failed: {e}")

        # ── 7. Benchmark result ───────────────────────────────────────────────
        elapsed = round(time.time() - t_start, 2)
        # Estimate what a full scan would have taken (0.5s per file heuristic)
        baseline = round(total_files * 0.5, 1)
        skipped = total_files - len(changed_files)

        alert_system.add_alert(
            title="⚡ Incremental Update Complete",
            message=f"Re-indexed {len(changed_files)} file(s) in {elapsed}s (vs ~{baseline}s full scan).",
            severity="success",
        )

        return {
            "changed_files": changed_files,
            "skipped_files": skipped,
            "total_files": total_files,
            "update_time_seconds": elapsed,
            "full_scan_baseline_seconds": baseline,
            "graph_updated": True,
            "message": (
                f"⚡ Incremental update complete: re-indexed {len(changed_files)} file(s) "
                f"in {elapsed}s. Skipped {skipped} unchanged files. "
                f"Full scan baseline: ~{baseline}s."
            ),
        }

    # ─────────────────────────────────────────────────────────────────────────
    # PIPELINE INTERNALS
    # ─────────────────────────────────────────────────────────────────────────

    def _clone_or_pull(self, url: str, branch: str) -> str:
        repo_name = url.rstrip("/").split("/")[-1].replace(".git", "")
        target = os.path.join(settings.REPO_STORAGE_PATH, repo_name)

        if os.path.isdir(target):
            try:
                repo = Repo(target)
                repo.remotes.origin.fetch()
                repo.git.checkout(branch)
                repo.remotes.origin.pull(branch)
                print(f"[Librarian] updated {repo_name}@{branch}")
            except Exception as e:
                print(f"[Librarian] pull failed, using existing: {e}")
        else:
            print(f"[Librarian] cloning {repo_name}@{branch}…")
            Repo.clone_from(url, target, branch=branch)

        return target

    def _run_pipeline(self, root: str, name: str, branch: str) -> GraphResponse:
        G = nx.DiGraph()
        module_map: Dict[str, str] = {}   # module_name → rel_path
        nodes_data: List[FileNode] = []
        edges_data: List[Dict[str, str]] = []
        file_contents: Dict[str, str] = {}  # rel_path → content

        total_functions = 0
        documented_functions = 0
        chunks_to_embed: List[Dict[str, Any]] = []

        # ── PASS 1: Walk & map ────────────────────────────────────────────────
        for dirpath, dirnames, filenames in os.walk(root):
            # Prune unwanted dirs in-place (faster than filtering after)
            dirnames[:] = [
                d for d in dirnames
                if not any(skip in d for skip in settings.SKIP_DIRS)
            ]

            rel_dir = os.path.relpath(dirpath, root).replace("\\", "/")
            if rel_dir == ".":
                rel_dir = "root"

            # Folder node
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

                # Read content
                try:
                    with open(full_path, "r", encoding="utf-8", errors="ignore") as fh:
                        content = fh.read()
                except Exception:
                    content = ""

                file_contents[rel_path] = content
                size = os.path.getsize(full_path)

                # Register node
                G.add_node(rel_path, type="file", language=language, size=size)
                nodes_data.append(FileNode(
                    id=rel_path,
                    label=filename,
                    type="file",
                    layer=self._infer_layer(rel_path),
                    language=language,
                    size_bytes=size,
                ))

                # Structural edge: folder → file
                G.add_edge(rel_dir, rel_path)
                edges_data.append({"source": rel_dir, "target": rel_path, "relation": "contains"})

                # Build module map (for Python import resolution)
                if ext == ".py":
                    mod = rel_path.replace("/", ".").replace(".py", "")
                    module_map[mod] = rel_path
                    # Also map short name
                    module_map[filename.replace(".py", "")] = rel_path

                # Chunk content for vector embedding
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

        # ── PASS 2: AST import analysis (Python) ──────────────────────────────
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

            # Docstring coverage stats
            for node in ast.walk(tree):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    total_functions += 1
                    if (ast.get_docstring(node)):
                        documented_functions += 1

        # ── PASS 3: JS/TS heuristic import edges ─────────────────────────────
        js_files = {
            rel_path: content
            for rel_path, content in file_contents.items()
            if rel_path.endswith((".js", ".ts", ".tsx", ".jsx"))
        }
        if js_files:
            self._add_js_edges(js_files, G, edges_data, file_contents)

        # ── PASS 4: Embed chunks into ChromaDB ───────────────────────────────
        embedded = 0
        if chunks_to_embed:
            try:
                # Delete old collection on force re-process
                if vs.collection_exists(name):
                    vs.delete_collection(name)
                embedded = vs.upsert_chunks(name, chunks_to_embed)
            except Exception as e:
                print(f"[Librarian] ChromaDB upsert failed: {e}")
                alert_system.add_alert(
                    title="⚠️ Embedding Warning",
                    message=f"Vector embedding failed: {e}. RAG will be unavailable.",
                    severity="warning",
                )

        doc_ratio = (documented_functions / total_functions) if total_functions > 0 else 0.0

        # ── PASS 5: Generate Architecture Map & Docs (for Mentor RAG) ───────
        self._write_arch_map(root, G)
        self._generate_docs(name, root, nodes_data, edges_data)

        return GraphResponse(
            project_name=name,
            branch=branch,
            nodes=nodes_data,
            edges=edges_data,
            project_root=root,
            processed_at=datetime.now(timezone.utc).isoformat(),
            total_files=sum(1 for n in nodes_data if n.type == "file"),
            total_chunks_embedded=embedded,
            documented_ratio=round(doc_ratio, 2),
            from_cache=False,
        )

    # ─────────────────────────────────────────────────────────────────────────
    # HELPERS
    # ─────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _extract_imports(tree: ast.AST) -> List[str]:
        """Pull all import targets from a Python AST."""
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
        """
        Resolve a Python import string to a relative file path.
        Tries: exact match → package __init__ → suffix match.
        """
        if target in module_map:
            return module_map[target]
        init_key = f"{target}.__init__"
        if init_key in module_map:
            return module_map[init_key]
        # Suffix match — catches `from app.core import config`
        candidates = [
            path for mod, path in module_map.items()
            if mod.endswith(f".{target}") or target.endswith(f".{mod}")
        ]
        if candidates:
            return sorted(candidates, key=len)[0]
        return None

    @staticmethod
    def _add_js_edges(
        js_files: Dict[str, str],
        G: nx.DiGraph,
        edges_data: List[Dict[str, str]],
        all_contents: Dict[str, str],
    ):
        """
        Heuristic JS/TS import edges: look for 'import ... from "..."' patterns
        and resolve to known filenames in the graph.
        """
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
        """Guess which architecture layer a file belongs to based on its path."""
        p = rel_path.lower()
        if any(x in p for x in ["frontend", "client", "ui", "views", "pages", "components"]):
            return "frontend"
        if any(x in p for x in ["backend", "api", "server", "agents", "core", "services"]):
            return "backend"
        return "system"

    # ── Cache helpers ─────────────────────────────────────────────────────────

    @staticmethod
    def _save_cache(cache_file: str, resp: GraphResponse):
        try:
            data = resp.model_dump()
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump(data, f, default=str)
        except Exception as e:
            print(f"[Librarian] cache write failed: {e}")

    @staticmethod
    def _load_from_cache(cache_file: str) -> GraphResponse:
        with open(cache_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        # Rebuild FileNode objects from dicts
        data["nodes"] = [FileNode(**n) for n in data.get("nodes", [])]
        data["from_cache"] = True
        resp = GraphResponse(**data)
        alert_system.add_alert(
            title="⚡ Cache Hit",
            message=f"Returned cached graph for '{resp.project_name}' instantly. Use force=true to re-scan.",
            severity="info",
        )
        return resp


    @staticmethod
    def _write_arch_map(root_path: str, G: nx.DiGraph):
        """Writes a summarized architecture map for RAG consumption."""
        map_path = os.path.join(root_path, "_kachow_architecture_map.md")
        try:
            with open(map_path, "w", encoding="utf-8") as f:
                f.write("# KA-CHOW System Architecture & Dependency Map\n\n")
                f.write("## 1. File Modules\n")
                for n, d in G.nodes(data=True):
                    f.write(f"- `{n}` (Type: {d.get('type', 'file')})\n")
                
                f.write("\n## 2. Dependencies\n")
                for u, v, d in G.edges(data=True):
                    rel = d.get('relation', 'imports')
                    f.write(f"- `{u}` -> {rel} -> `{v}`\n")
            print(f"[Librarian] wrote architecture map to {map_path}")
        except Exception as e:
            print(f"[Librarian] map write failed: {e}")

    def _generate_docs(self, project_name: str, project_root: str, nodes: List[FileNode], edges: List[Dict[str, str]]):
        """Generates AI-powered README.md and PRD.md for the project."""
        
        # Gather core context
        project_context = ""
        core_files = ["README.md", "package.json", "requirements.txt", "go.mod", "pom.xml", "main.py", "app.py", "index.ts", "index.js"]
        found_context = []
        for file in core_files:
            p = os.path.join(project_root, file)
            if os.path.exists(p):
                try:
                    with open(p, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read(2000)
                        found_context.append(f"--- File: {file} ---\n{content}\n")
                except: pass
        
        project_context = "\n".join(found_context) if found_context else "No core config files found."

        system_prompt = "You are an expert Technical Writer and Software Architect. Generate professional project documentation based on file snippets and metrics."
        
        readme_prompt = f"""Generate a high-quality README.md for '{project_name}'.
CONTEXT:
{project_context}
METRICS:
- Total Files: {len(nodes)}
- Total Dependencies: {len(edges)}
Output ONLY markdown."""

        prd_prompt = f"""Generate a professional Product Requirements Document (PRD) for '{project_name}'.
CONTEXT:
{project_context}
METRICS:
- Nodes: {len(nodes)}
- Dependencies: {len(edges)}
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

            # Write to disk
            with open(os.path.join(project_root, "README.md"), "w", encoding="utf-8") as f:
                f.write(readme)
            with open(os.path.join(project_root, "PRD.md"), "w", encoding="utf-8") as f:
                f.write(prd)
            print(f"[Librarian] generated README and PRD for {project_name}")
        except Exception as e:
            print(f"[Librarian] doc gen failed: {e}")

# Singleton used by the router
librarian = LibrarianService()