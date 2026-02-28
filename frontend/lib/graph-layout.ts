/**
 * graph-layout.ts
 *
 * Converts raw backend KnowledgeGraphResponse nodes/edges into the
 * GraphNode shape expected by graph-view.tsx, assigning x/y coordinates
 * using a simple radial / force-inspired layout so the SVG renders cleanly
 * regardless of the number of nodes returned by the backend.
 */

import type { ApiGraphNode, ApiGraphEdge, KnowledgeGraphResponse } from "@/lib/api"
import type { GraphNode } from "@/lib/demo-data"

// ── Type mapping ──────────────────────────────────────────────────────────────
// Backend types ("file", "folder") → GraphView visual types
type VisualNodeType = GraphNode["type"]

function mapNodeType(backendType: string, label: string): VisualNodeType {
    if (backendType === "folder") return "folder"

    // Heuristic classification by filename / path keywords
    const l = label.toLowerCase()
    if (l.includes("router") || l.includes("route") || l.includes("api") || l.includes("endpoint") || l.includes("controller")) return "api"
    if (l.includes("hook") || l.startsWith("use_") || l.startsWith("use-")) return "hook"
    if (l.includes("util") || l.includes("helper") || l.includes("tool") || l.includes("lib") || l.includes("service")) return "utility"
    if (l.includes("component") || l.includes("widget") || l.includes("view") || l.includes("panel") || l.includes("schema")) return "component"

    return "file"
}

// ── Layout algorithm ──────────────────────────────────────────────────────────
// Simple concentric-circle layout: ring 0 = most-connected (hubs), ring 1+ = leaves
// Limits to MAX_NODES so the SVG stays readable.
const MAX_NODES = 150
const CANVAS_W = 800
const CANVAS_H = 560
const CX = CANVAS_W / 2   // 400
const CY = CANVAS_H / 2   // 280

function computeLayout(nodes: ApiGraphNode[], edges: ApiGraphEdge[]): Map<string, { x: number; y: number }> {
    // Build degree map
    const degree = new Map<string, number>()
    nodes.forEach((n) => degree.set(n.id, 0))
    edges.forEach((e) => {
        degree.set(e.source, (degree.get(e.source) ?? 0) + 1)
        degree.set(e.target, (degree.get(e.target) ?? 0) + 1)
    })

    // Sort by degree desc, take top MAX_NODES
    const sorted = [...nodes].sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))
    const visible = sorted.slice(0, MAX_NODES)

    // Assign rings: top 5% → ring 0 (centre), next 20% → ring 1, rest → outer rings
    const total = visible.length
    const ring0Count = Math.max(1, Math.round(total * 0.05))
    const ring1Count = Math.max(1, Math.round(total * 0.20))

    const positions = new Map<string, { x: number; y: number }>()

    const placeRing = (items: ApiGraphNode[], radius: number, offsetAngle = 0) => {
        items.forEach((node, i) => {
            const angle = offsetAngle + (2 * Math.PI * i) / items.length
            positions.set(node.id, {
                x: Math.round(CX + radius * Math.cos(angle)),
                y: Math.round(CY + radius * Math.sin(angle)),
            })
        })
    }

    const ring0 = visible.slice(0, ring0Count)
    const ring1 = visible.slice(ring0Count, ring0Count + ring1Count)
    const ring2 = visible.slice(ring0Count + ring1Count)

    // If only 1 node in ring0, put it at centre
    if (ring0.length === 1) {
        positions.set(ring0[0].id, { x: CX, y: CY })
    } else {
        placeRing(ring0, 80)
    }
    placeRing(ring1, 200, Math.PI / ring1Count)
    placeRing(ring2, 340, 0)

    return positions
}

// ── Public API ────────────────────────────────────────────────────────────────

export function buildGraphNodes(response: KnowledgeGraphResponse): GraphNode[] {
    const { nodes, edges } = response

    // Pre-compute which node ids will be shown
    const degree = new Map<string, number>()
    nodes.forEach((n) => degree.set(n.id, 0))
    edges.forEach((e) => {
        degree.set(e.source, (degree.get(e.source) ?? 0) + 1)
        degree.set(e.target, (degree.get(e.target) ?? 0) + 1)
    })
    const sorted = [...nodes].sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))
    const visible = sorted.slice(0, MAX_NODES)
    const visibleIds = new Set(visible.map((n) => n.id))

    // Compute positions for visible nodes
    const positions = computeLayout(nodes, edges)

    // Build connections map (only between visible nodes, capped to avoid clutter)
    const connectionsMap = new Map<string, string[]>()
    visible.forEach((n) => connectionsMap.set(n.id, []))
    edges.forEach((e) => {
        if (visibleIds.has(e.source) && visibleIds.has(e.target)) {
            connectionsMap.get(e.source)?.push(e.target)
        }
    })

    // Map to GraphNode shape
    return visible.map((n) => {
        const pos = positions.get(n.id) ?? { x: CX, y: CY }
        return {
            id: n.id,
            label: n.label.replace(/^📂\s*/, "").replace(/\.(py|tsx?|jsx?|java|cpp|go|rb)$/, ""),
            x: pos.x,
            y: pos.y,
            type: mapNodeType(n.type, n.label),
            connections: connectionsMap.get(n.id) ?? [],
            sonar_health: n.sonar_health,
            path: n.id,
            layer: n.layer,
        }
    })
}
