/**
 * repo-store.ts
 *
 * Central localStorage CRUD utility for the multi-repo feature.
 *
 * Storage keys
 * ─────────────────────────────────────────────────────────────
 * localStorage "graph_repos"      → RepoEntry[]  (persists forever)
 * localStorage "active_repo_id"   → string       (id of selected repo)
 * sessionStorage "graph_nodes_layout_<id>" → cached layout per repo
 *
 * NOTE: All functions are safe to call during SSR — they check for
 * `typeof window !== "undefined"` before touching storage.
 */

import type { KnowledgeGraphResponse } from "@/lib/api"
import type { GraphNode } from "@/lib/demo-data"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RepoEntry {
    id: string                       // nanoid-style: timestamp + random
    repo_url: string
    repo_name: string
    added_at: string                 // ISO timestamp
    data: KnowledgeGraphResponse     // full backend response
}

export interface RepoLayoutCache {
    nodes: GraphNode[]
    meta: {
        repo_name: string
        system_health: number
        total_files: number
    }
}

// ─── Keys ─────────────────────────────────────────────────────────────────────

const LS_REPOS_KEY = "graph_repos"
const LS_ACTIVE_KEY = "active_repo_id"

const ssLayoutKey = (id: string) => `graph_nodes_layout_${id}`

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isClient() {
    return typeof window !== "undefined"
}

function genId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// ─── Repo CRUD ────────────────────────────────────────────────────────────────

/** Returns all stored repos, newest-first */
export function getAllRepos(): RepoEntry[] {
    if (!isClient()) return []
    try {
        const raw = localStorage.getItem(LS_REPOS_KEY)
        if (!raw) return []
        return (JSON.parse(raw) as RepoEntry[]).sort(
            (a, b) => new Date(b.added_at).getTime() - new Date(a.added_at).getTime()
        )
    } catch {
        return []
    }
}

/**
 * Adds (or updates) a repo entry.
 * If a repo with the same repo_url already exists, it is replaced in-place
 * and its layout cache is invalidated so the new graph builds fresh.
 * Returns the id of the upserted entry.
 */
export function upsertRepo(
    repo_url: string,
    data: KnowledgeGraphResponse
): string {
    if (!isClient()) return ""

    const repos = getAllRepos()
    const existing = repos.find((r) => r.repo_url === repo_url)

    if (existing) {
        // Update existing entry
        existing.data = data
        existing.added_at = new Date().toISOString()
        existing.repo_name = data.project_name
        // Bust the layout cache for this repo
        sessionStorage.removeItem(ssLayoutKey(existing.id))
        localStorage.setItem(LS_REPOS_KEY, JSON.stringify(repos))
        return existing.id
    }

    // New entry
    const entry: RepoEntry = {
        id: genId(),
        repo_url,
        repo_name: data.project_name,
        added_at: new Date().toISOString(),
        data,
    }
    repos.unshift(entry)
    localStorage.setItem(LS_REPOS_KEY, JSON.stringify(repos))
    return entry.id
}

/** Removes a repo and its layout cache */
export function removeRepo(id: string): void {
    if (!isClient()) return
    const repos = getAllRepos().filter((r) => r.id !== id)
    localStorage.setItem(LS_REPOS_KEY, JSON.stringify(repos))
    sessionStorage.removeItem(ssLayoutKey(id))
    // If this was the active repo, clear the active pointer
    if (getActiveRepoId() === id) {
        const next = repos[0]
        localStorage.setItem(LS_ACTIVE_KEY, next?.id ?? "")
    }
}

// ─── Active Repo ──────────────────────────────────────────────────────────────

export function getActiveRepoId(): string {
    if (!isClient()) return ""
    return localStorage.getItem(LS_ACTIVE_KEY) ?? ""
}

export function setActiveRepoId(id: string): void {
    if (!isClient()) return
    localStorage.setItem(LS_ACTIVE_KEY, id)
}

export function getActiveRepo(): RepoEntry | null {
    const id = getActiveRepoId()
    if (!id) return null
    return getAllRepos().find((r) => r.id === id) ?? null
}

// ─── Layout Cache ─────────────────────────────────────────────────────────────

export function getLayoutCache(id: string): RepoLayoutCache | null {
    if (!isClient()) return null
    try {
        const raw = sessionStorage.getItem(ssLayoutKey(id))
        if (!raw) return null
        return JSON.parse(raw) as RepoLayoutCache
    } catch {
        return null
    }
}

export function setLayoutCache(id: string, cache: RepoLayoutCache): void {
    if (!isClient()) return
    try {
        sessionStorage.setItem(ssLayoutKey(id), JSON.stringify(cache))
    } catch {
        // sessionStorage quota exceeded — silently ignore
    }
}
