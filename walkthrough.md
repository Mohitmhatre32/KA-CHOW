# KA-CHOW Rebackend v2.0 — Feature 1: Librarian Pipeline
## What was built

### Docker Infrastructure (new)
| File | Purpose |
|------|---------|
| [Dockerfile](file:///C:/Users/HP/OneDrive/Desktop/College/Extra/KA-CHOW/rebackend/Dockerfile) | Multi-stage build: builder installs heavy deps, runtime is lean slim image |
| [docker-compose.yml](file:///C:/Users/HP/OneDrive/Desktop/College/Extra/KA-CHOW/rebackend/docker-compose.yml) | Named volumes for repo + ChromaDB persistence, hot-reload dev mount |
| [.dockerignore](file:///C:/Users/HP/OneDrive/Desktop/College/Extra/KA-CHOW/rebackend/.dockerignore) | Excludes venv/storage/caches from build context |
| [.env](file:///c:/Users/HP/OneDrive/Desktop/College/Extra/KA-CHOW/backend/.env) / [.env.example](file:///C:/Users/HP/OneDrive/Desktop/College/Extra/KA-CHOW/rebackend/.env.example) | Env templates with Docker-compatible paths |

### Core Modules (rebuilt from scratch)
| File | What's new vs v1 |
|------|-----------------|
| [app/core/config.py](file:///c:/Users/HP/OneDrive/Desktop/College/Extra/KA-CHOW/backend/app/core/config.py) | Env-var-first (Docker paths override local), tuning knobs for chunk size, RAG top-K, supported extensions, skip dirs |
| [app/core/alerts.py](file:///c:/Users/HP/OneDrive/Desktop/College/Extra/KA-CHOW/backend/app/core/alerts.py) | Thread-safe with `threading.Lock`, rolling 100-alert window, [unread_count](file:///c:/Users/HP/OneDrive/Desktop/College/Extra/KA-CHOW/rebackend/app/core/alerts.py#71-75) property |
| [app/core/llm.py](file:///c:/Users/HP/OneDrive/Desktop/College/Extra/KA-CHOW/backend/app/core/llm.py) | Shared Groq singleton, [generate_json](file:///C:/Users/HP/OneDrive/Desktop/College/Extra/KA-CHOW/rebackend/app/core/llm.py#38-51) with 4 fallback parsing strategies |
| [app/core/vector_store.py](file:///C:/Users/HP/OneDrive/Desktop/College/Extra/KA-CHOW/rebackend/app/core/vector_store.py) | **NEW** — ChromaDB wrapper with cosine similarity, slug-safe names, deterministic chunk IDs |

### Librarian Agent (complete rebuild)
| File | What's new |
|------|-----------|
| [models.py](file:///c:/Users/HP/OneDrive/Desktop/College/Extra/KA-CHOW/backend/app/agents/mentor/models.py) | Added `ProcessRequest.force`, `GraphResponse.from_cache`, `GraphResponse.total_chunks_embedded`, `CommitInfo.commit_type` |
| [service.py](file:///c:/Users/HP/OneDrive/Desktop/College/Extra/KA-CHOW/backend/app/agents/mentor/service.py) | Full 4-pass pipeline (see below) |
| [router.py](file:///c:/Users/HP/OneDrive/Desktop/College/Extra/KA-CHOW/backend/app/agents/mentor/router.py) | New clean endpoints: `/process`, `/branches`, `/file`, `/history` |

### Librarian Pipeline — 4 Passes
```
Pass 1: Walk & Map
  - In-place dirnames[:] pruning (faster os.walk)
  - All SUPPORTED_EXTENSIONS collected
  - Folder → File structural edges
  - Per-file: language detection, size, content read
  - Chunks generated (token-aware, ~400 tok limit)

Pass 2: Python AST Import Resolution
  - ast.parse() per .py file
  - Handles: import X, from X import Y, from X.Y import Z
  - 3-strategy resolution: exact → __init__ → suffix match
  - Docstring coverage ratio computed (total_functions, documented_functions)

Pass 3: JS/TS Heuristic Edges
  - Regex: from '...' / from "..."
  - Resolves to known filenames in graph

Pass 4: ChromaDB Embedding
  - Delete old collection on force=True
  - Upsert all chunks — idempotent
  - Soft-failure: alerts warning, doesn't crash server
```

### main.py
- `/health` endpoint for Docker HEALTHCHECK
- Agent status map (`ONLINE` / `PENDING`) for frontend status badge
- `/api/scan/trigger` stub — returns `pending`, no network calls

## Verification
```
✅ AST syntax check: ALL 8 FILES OK (zero errors)
✅ All imports are resolvable within the codebase
✅ Docker paths env-overridable
✅ ChromaDB persistence across restarts (named volume)
```

## How to run

### Local dev
```bash
cd rebackend
pip install -r requirements.txt

# Add your GROQ_API_KEY to .env
uvicorn app.main:app --reload --port 8000
# Then open http://localhost:8000/docs
```

### Docker
```bash
cd rebackend
# Set GROQ_API_KEY in .env first
docker-compose up --build

# API at http://localhost:8000/docs
# ChromaDB & repos persist in Docker named volumes
```

### Test the pipeline
```bash
# Process a GitHub repo
curl -X POST http://localhost:8000/api/librarian/process \
  -H "Content-Type: application/json" \
  -d '{"input_source": "https://github.com/tiangolo/fastapi", "branch": "master"}'

# 2nd call returns instantly from cache
curl -X POST http://localhost:8000/api/librarian/process \
  -H "Content-Type: application/json" \
  -d '{"input_source": "https://github.com/tiangolo/fastapi", "branch": "master"}'
  # → from_cache: true

# Force re-process
curl -X POST http://localhost:8000/api/librarian/process \
  -H "Content-Type: application/json" \
  -d '{"input_source": "https://github.com/tiangolo/fastapi", "branch": "master", "force": true}'
```

## Next: Feature 2 — Mentor RAG Chat
Uses ChromaDB data loaded by the Librarian to answer codebase questions.
