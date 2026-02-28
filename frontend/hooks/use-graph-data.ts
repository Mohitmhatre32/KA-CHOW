/**
 * use-graph-data.ts
 *
 * Reads the active repo's knowledge graph from the multi-repo store and
 * converts it into the GraphNode[] shape consumed by graph-view.tsx.
 *
 * Caching strategy (per-repo):
 *   localStorage  "graph_repos"               → RepoEntry[] (all repos)
 *   localStorage  "active_repo_id"            → id of currently viewed repo
 *   sessionStorage "graph_nodes_layout_<id>"  → derived GraphNode[] layout per repo
 *
 * Switching repos: dispatch window.dispatchEvent(new Event("active-repo-changed"))
 * after calling setActiveRepoId() — the hook reacts instantly without a reload.
 */

"use client"

import { useState, useEffect } from "react"
import type { GraphNode } from "@/lib/demo-data"
import type { KnowledgeGraphResponse } from "@/lib/api"
import { buildGraphNodes } from "@/lib/graph-layout"
import { graphNodes as demoNodes } from "@/lib/demo-data"
import {
    getActiveRepo,
    getLayoutCache,
    setLayoutCache,
} from "@/lib/repo-store"

export interface GraphMeta {
    repo_name: string
    repo_url: string
    system_health: number
    total_files: number
    project_root: string
}

export interface UseGraphDataReturn {
    nodes: GraphNode[]
    graphMeta: GraphMeta | null
    isLive: boolean       // false = showing demo data
    isLoading: boolean
    isRefreshing: boolean
    refresh: () => Promise<void>
}

function buildFromResponse(
    data: KnowledgeGraphResponse,
    repoId: string,
    repoUrl: string,
    forceRefresh: boolean = false
): { nodes: GraphNode[]; meta: GraphMeta } {
    // Check per-repo layout cache first unless forceRefresh is true
    if (!forceRefresh) {
        const cached = getLayoutCache(repoId)
        if (cached) {
            return {
                nodes: cached.nodes,
                meta: { ...cached.meta, repo_url: repoUrl } as GraphMeta
            }
        }
    }

    // Build fresh layout
    const nodes = buildGraphNodes(data)
    const meta: GraphMeta = {
        repo_name: data.project_name,
        repo_url: repoUrl,
        system_health: data.health_score,
        total_files: data.nodes.length,
        project_root: data.project_root,
    }

    // Cache for this session
    setLayoutCache(repoId, { nodes, meta })

    return { nodes, meta }
}

export function useGraphData(): UseGraphDataReturn {
    const [nodes, setNodes] = useState<GraphNode[]>(demoNodes)
    const [graphMeta, setGraphMeta] = useState<GraphMeta | null>(null)
    const [isLive, setIsLive] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)

    const load = () => {
        try {
            const activeRepo = getActiveRepo()

            if (!activeRepo) {
                setNodes(demoNodes)
                setGraphMeta(null)
                setIsLive(false)
                setIsLoading(false)
                return
            }

            const { nodes: layoutNodes, meta } = buildFromResponse(
                activeRepo.data,
                activeRepo.id,
                activeRepo.repo_url
            )

            setNodes(layoutNodes)
            setGraphMeta(meta)
            setIsLive(true)
        } catch (err) {
            console.error("Failed to load graph data:", err)
            setNodes(demoNodes)
            setIsLive(false)
        } finally {
            setIsLoading(false)
        }
    }

    const refresh = async () => {
        const activeRepo = getActiveRepo()
        if (!activeRepo || isRefreshing) return

        setIsRefreshing(true)
        try {
            // 1. Re-fetch from backend (this triggers SonarQube re-scan)
            const { analyzeRepository } = await import("@/lib/api")
            const { upsertRepo } = await import("@/lib/repo-store")

            const newData = await analyzeRepository(activeRepo.repo_url, activeRepo.data.branch)

            // 2. Update the main store (this also busts the session layout cache)
            upsertRepo(activeRepo.repo_url, newData)

            // 3. Re-build the layout and update state
            const { nodes: layoutNodes, meta } = buildFromResponse(
                newData,
                activeRepo.id,
                activeRepo.repo_url,
                true // force re-layout
            )

            setNodes(layoutNodes)
            setGraphMeta(meta)

            // 4. Notify other components (like HealthPanel)
            window.dispatchEvent(new Event("active-repo-changed"))
        } catch (err) {
            console.error("Manual refresh failed:", err)
        } finally {
            setIsRefreshing(false)
        }
    }

    useEffect(() => {
        load()

        // Re-run whenever the active repo changes (triggered by the repo sidebar switcher)
        window.addEventListener("active-repo-changed", load)
        return () => window.removeEventListener("active-repo-changed", load)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return { nodes, graphMeta, isLive, isLoading, isRefreshing, refresh }
}
