"""
Vector Store — thin wrapper around ChromaDB's persistent client.
All agents use this module; never import chromadb directly.

Design goals:
  - Single persistent client (not ephemeral in-memory)
  - Works in both local dev and Docker (path from config)
  - Embedding via Groq's nomic-embed-text (falls back to chromadb's default)
"""
import hashlib
from typing import List, Dict, Any, Optional
import chromadb
from chromadb.config import Settings as ChromaSettings
from app.core.config import settings

# ── Persistent ChromaDB client (singleton) ────────────────────────────────────
_client: Optional[chromadb.PersistentClient] = None

def _get_client() -> chromadb.PersistentClient:
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(
            path=settings.VECTOR_DB_PATH,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
    return _client


# ── Public API ────────────────────────────────────────────────────────────────

def get_or_create_collection(name: str) -> chromadb.Collection:
    """
    Returns (or creates) a named collection.
    Collection names are slugified — safe for any project name.
    """
    safe_name = _slugify(name)
    return _get_client().get_or_create_collection(
        name=safe_name,
        metadata={"hnsw:space": "cosine"},   # cosine similarity = better for code
    )


def upsert_chunks(collection_name: str, chunks: List[Dict[str, Any]]) -> int:
    """
    Upsert a list of text chunks into a collection.

    Each chunk dict must have:
      - "id"       : unique string id
      - "document" : raw text content
      - "metadata" : dict of extra fields (file_path, language, chunk_index, …)

    Returns the number of chunks upserted.
    """
    collection = get_or_create_collection(collection_name)
    ids       = [c["id"] for c in chunks]
    documents = [c["document"] for c in chunks]
    metadatas = [c.get("metadata", {}) for c in chunks]

    collection.upsert(ids=ids, documents=documents, metadatas=metadatas)
    return len(chunks)


def query_collection(
    collection_name: str,
    query_text: str,
    n_results: int = 5,
    where: Optional[Dict] = None,
) -> List[Dict[str, Any]]:
    """
    Semantic search in a collection.
    Returns a list of {document, metadata, distance} dicts, sorted best-first.
    """
    collection = get_or_create_collection(collection_name)

    # Guard: if collection is empty, return empty list
    if collection.count() == 0:
        return []

    kwargs: Dict[str, Any] = {
        "query_texts": [query_text],
        "n_results": min(n_results, collection.count()),
        "include": ["documents", "metadatas", "distances"],
    }
    if where:
        kwargs["where"] = where

    results = collection.query(**kwargs)

    # Flatten chromadb's nested list format
    out = []
    docs      = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]
    for doc, meta, dist in zip(docs, metadatas, distances):
        out.append({"document": doc, "metadata": meta, "distance": dist})
    return out


def collection_exists(collection_name: str) -> bool:
    """Returns True if a collection with this project name already exists."""
    safe_name = _slugify(collection_name)
    existing = [c.name for c in _get_client().list_collections()]
    return safe_name in existing


def delete_collection(collection_name: str):
    """Hard-delete a collection (used when force=True re-processing)."""
    safe_name = _slugify(collection_name)
    try:
        _get_client().delete_collection(safe_name)
    except Exception:
        pass  # Already deleted or never existed


# ── Helpers ───────────────────────────────────────────────────────────────────

def _slugify(name: str) -> str:
    """Make name safe for chromadb: lowercase alphanumeric + underscores."""
    import re
    name = name.lower().strip()
    name = re.sub(r"[^a-z0-9_-]", "_", name)
    name = re.sub(r"_+", "_", name).strip("_")
    # ChromaDB collection names must be 3-63 chars
    if len(name) < 3:
        name = name.ljust(3, "x")
    return name[:63]


def make_chunk_id(file_path: str, chunk_index: int) -> str:
    """Deterministic, stable ID for a chunk — safe to re-upsert."""
    raw = f"{file_path}::{chunk_index}"
    return hashlib.md5(raw.encode()).hexdigest()
