"use client"

import React, { useState, useRef, useCallback, useEffect, useMemo } from "react"
import * as d3 from "d3"
import type { GraphNode } from "@/lib/demo-data"
import { useGraphData } from "@/hooks/use-graph-data"
import {
  Box, LayoutTemplate, Wrench, Cloud, Anchor, Activity,
  ShieldCheck, Bug, Zap, Percent, MessageSquareQuote, X, FileCode,
  AlertCircle, RefreshCcw, Folder, Flame, Copy, Sparkles, Search, type LucideProps,
} from "lucide-react"
import { toast } from "sonner"
import { 
  generateIndustryDocs, 
  incrementalUpdate, 
  triggerSonarScan,
  analyzeRepository,
  getRepoTasks,
  type DocumentationResponse, 
  type IncrementalUpdateResult,
  type RepoTask,
} from "@/lib/api"

import { getActiveRepo } from "@/lib/repo-store"
import { Button } from "@/components/ui/button"
import { DocsModal } from "./docs-modal"

// --- Constants & Labels ---
const typeColors: Record<GraphNode["type"], string> = {
  module: "var(--primary)",
  component: "var(--success)",
  utility: "var(--warning)",
  api: "var(--destructive)",
  hook: "var(--accent)",
  file: "#ec4899", // Changed to bright pink
  folder: "#8b5cf6", // Changed to bright purple
}

const typeLabels: Record<GraphNode["type"], string> = {
  module: "Module",
  component: "Component",
  utility: "Utility",
  api: "API",
  hook: "Hook",
  file: "File",
  folder: "Folder",
}

const typeIcons: Record<GraphNode["type"], React.FC<LucideProps>> = {
  module: Box, component: LayoutTemplate, utility: Wrench, api: Cloud, hook: Anchor,
  file: FileCode, folder: Folder,
}

// ── JiraTicketCell ────────────────────────────────────────────────────
// G3 FIX: Jira ticket is now clickable — copies key to clipboard and opens URL
function JiraTicketCell({ ticket }: { ticket?: string }) {
  const [copied, setCopied] = useState(false)
  const jiraBase = process.env.NEXT_PUBLIC_JIRA_BASE_URL

  const handleClick = () => {
    if (!ticket) return
    navigator.clipboard.writeText(ticket).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
    if (jiraBase) {
      window.open(`${jiraBase}/browse/${ticket}`, "_blank", "noopener,noreferrer")
    }
  }

  return (
    <div
      className={`flex flex-col rounded border border-border bg-secondary/20 p-1.5 min-w-0 transition-all duration-150 ${
        ticket ? "cursor-pointer hover:border-primary/40 hover:bg-primary/5" : "opacity-50"
      }`}
      onClick={handleClick}
      title={ticket ? (jiraBase ? `Open ${ticket} in Jira` : `Copy ${ticket}`) : undefined}
    >
      <div className="flex items-center gap-1 text-muted-foreground">
        <MessageSquareQuote className="h-2.5 w-2.5 shrink-0" />
        <span className="text-[7px] font-bold uppercase truncate">Jira</span>
        {ticket && (
          <span className="ml-auto text-[7px] text-primary opacity-60">
            {copied ? "✓ copied" : jiraBase ? "↗" : "copy"}
          </span>
        )}
      </div>
      <span className={`mt-0.5 font-mono text-[9px] font-bold truncate ${
        copied ? "text-success" : ticket ? "text-foreground" : "text-muted-foreground"
      }`}>
        {ticket ?? "None"}
      </span>
    </div>
  )
}



export function GraphView() {
  const svgRef = useRef<SVGSVGElement>(null)
  const simRef = useRef<d3.Simulation<any, undefined> | null>(null)

  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 1000, h: 800 })
  // G7 FIX: mirror viewBox in a ref so the auto-zoom closure always reads
  // the current value, not the stale one captured at the time of the click.
  const viewBoxRef = useRef({ x: 0, y: 0, w: 1000, h: 800 })
  const setViewBoxSynced = useCallback((next: { x: number; y: number; w: number; h: number }) => {
    viewBoxRef.current = next
    setViewBox(next)
  }, [])

  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  // Documentation state
  const [isDocsModalOpen, setIsDocsModalOpen] = useState(false)
  const [isGeneratingDocs, setIsGeneratingDocs] = useState(false)
  const [generatedDocs, setGeneratedDocs] = useState<DocumentationResponse | null>(null)

  // Sonar scan state
  const [isScanning, setIsScanning] = useState(false)

  // Incremental update state
  const [isIncremental, setIsIncremental] = useState(false)
  const [incrementalResult, setIncrementalResult] = useState<IncrementalUpdateResult | null>(null)

  // Mobile Task Integration
  const [activeTasks, setActiveTasks] = useState<RepoTask[]>([])
  const [maintenanceNodes, setMaintenanceNodes] = useState<Set<string>>(new Set())

  const { nodes: rawNodes, graphMeta, isLive, isRefreshing, refresh } = useGraphData()
  const [nodes, setNodes] = useState<(GraphNode & d3.SimulationNodeDatum)[]>([])

  // 1. Initialize Simulation (Pre-calculated layout to avoid blooming animation)
  useEffect(() => {
    setMounted(false)
    if (!rawNodes.length) return

    const simulationNodes = rawNodes.map((n) => ({ ...n })) as (GraphNode & d3.SimulationNodeDatum)[]
    const links = [] as { source: string; target: string }[]

    rawNodes.forEach((node) => {
      node.connections.forEach((targetId) => {
        links.push({ source: node.id, target: targetId })
      })
    })

    const simulation = d3
      .forceSimulation(simulationNodes)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(35))
      .force("charge", d3.forceManyBody().strength(-150))
      .force("x", d3.forceX(500).strength(0.2))
      .force("y", d3.forceY(400).strength(0.2))
      .force("collide", d3.forceCollide().radius(55))
      .stop()

    // Pre-calculate positions so it starts settled
    simulation.tick(300)
    setNodes(simulationNodes)

    // Trigger mount animation after layout is ready
    setTimeout(() => setMounted(true), 50)

    simRef.current = simulation
    return () => {
      simulation.stop()
    }
  }, [rawNodes])

  // --- Mobile Tasks Polling ---
  useEffect(() => {
    if (!graphMeta?.repo_name) return

    // G5 + G6 FIX: clear stale state from the previous repo immediately,
    // before the first fetch resolves, so old halos and benchmark pills vanish.
    setActiveTasks([])
    setMaintenanceNodes(new Set())
    setIncrementalResult(null)
    setSelectedNodeId(null)

    let isMounted = true

    const fetchTasks = async () => {
      try {
        const tasks = await getRepoTasks(graphMeta.repo_name)
        if (!isMounted) return
        setActiveTasks(tasks)

        const mNodes = new Set<string>()
        tasks.forEach((t) => {
          if (t.status === "open" && t.linked_nodes) {
            t.linked_nodes.forEach((n) => mNodes.add(n))
          }
        })
        setMaintenanceNodes(mNodes)
      } catch (e) {
        // Tasks endpoint is optional — fail silently
        console.warn("Tasks polling failed:", (e as Error).message)
      }
    }

    fetchTasks()
    const intervalId = setInterval(fetchTasks, 3000)
    return () => {
      isMounted = false
      clearInterval(intervalId)
    }
  }, [graphMeta?.repo_name])


  const edges = useMemo(() => {
    const lines: any[] = []
    nodes.forEach((node) => {
      node.connections.forEach((targetId) => {
        const target = nodes.find((n) => n.id === targetId)
        if (target && node.x !== undefined && target.x !== undefined) {
          lines.push({ x1: node.x, y1: node.y, x2: target.x, y2: target.y, fromId: node.id, toId: targetId })
        }
      })
    })
    return lines
  }, [nodes])

  // --- Viewport Handlers ---
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const scale = e.deltaY > 0 ? 1.05 : 0.95
      setViewBox((prev) => {
        const next = {
          ...prev, w: prev.w * scale, h: prev.h * scale,
          x: prev.x + (prev.w - prev.w * scale) / 2,
          y: prev.y + (prev.h - prev.h * scale) / 2,
        }
        viewBoxRef.current = next
        return next
      })
    }

    svg.addEventListener("wheel", handleWheel, { passive: false })
    return () => svg.removeEventListener("wheel", handleWheel)
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const dx = (panStart.x - e.clientX) * (viewBox.w / rect.width)
    const dy = (panStart.y - e.clientY) * (viewBox.h / rect.height)
    setViewBox((prev) => {
      const next = { ...prev, x: prev.x + dx, y: prev.y + dy }
      viewBoxRef.current = next
      return next
    })
    setPanStart({ x: e.clientX, y: e.clientY })
  }, [isPanning, panStart, viewBox])

  const activeNodeId = hoveredNode || selectedNodeId

  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null

  // Auto-zoom to selected node
  // G7 FIX: reads start position from viewBoxRef (always current) instead of
  // the stale viewBox closure value captured when selectedNodeId changed.
  useEffect(() => {
    if (selectedNode && selectedNode.x !== undefined && selectedNode.y !== undefined) {
      let minX = selectedNode.x
      let maxX = selectedNode.x
      let minY = selectedNode.y
      let maxY = selectedNode.y

      edges.forEach((edge) => {
        if (edge.fromId === selectedNode.id || edge.toId === selectedNode.id) {
          minX = Math.min(minX, edge.x1, edge.x2)
          maxX = Math.max(maxX, edge.x1, edge.x2)
          minY = Math.min(minY, edge.y1, edge.y2)
          maxY = Math.max(maxY, edge.y1, edge.y2)
        }
      })

      const padding = 150
      const targetW = Math.max((maxX - minX) + padding * 2, 800)
      const targetH = Math.max((maxY - minY) + padding * 2, 600)
      const targetX = minX - padding
      const targetY = minY - padding

      // Capture start from ref — always the real current viewBox, not stale closure
      const { x: startX, y: startY, w: startW, h: startH } = viewBoxRef.current

      let startTime: number | null = null
      const duration = 600

      const animateZoom = (timestamp: number) => {
        if (!startTime) startTime = timestamp
        const progress = Math.min((timestamp - startTime) / duration, 1)
        const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2

        const next = {
          x: startX + (targetX - startX) * ease,
          y: startY + (targetY - startY) * ease,
          w: startW + (targetW - startW) * ease,
          h: startH + (targetH - startH) * ease,
        }
        setViewBoxSynced(next)

        if (progress < 1) requestAnimationFrame(animateZoom)
      }
      requestAnimationFrame(animateZoom)
    }
  }, [selectedNodeId, edges, setViewBoxSynced])


  const handleIncrementalUpdate = async () => {
    const activeRepo = getActiveRepo()
    if (!activeRepo?.repo_url) {
      toast.error("No repository loaded. Please scan a repo in the Librarian tab first.")
      return
    }
    setIsIncremental(true)
    setIncrementalResult(null)
    try {
      const result = await incrementalUpdate(activeRepo.repo_url)
      setIncrementalResult(result)
      if (result.graph_updated) {
        toast.success(`⚡ Updated ${result.changed_files.length} file(s) in ${result.update_time_seconds}s`)
        refresh()
      } else {
        toast.info("Graph is already up to date — no changes detected.")
      }
    } catch (e) {
      toast.error(`Incremental update failed: ${(e as Error).message}`)
    } finally {
      setIsIncremental(false)
    }
  }

  const handleGenerateDocs = async () => {
    if (!graphMeta || !rawNodes.length) {
      toast.error("No project data available to generate documentation.")
      return
    }

    setIsGeneratingDocs(true)
    setIsDocsModalOpen(true)
    try {
      const activeRepo = getActiveRepo()
      const res = await generateIndustryDocs({
        project_name: graphMeta.repo_name,
        repo_url: activeRepo?.repo_url || undefined
      })
      setGeneratedDocs(res)
    } catch (err) {
      console.error("Docs Generation Failed:", err)
      toast.error("Documentation generation failed. Check server logs.")
      setIsDocsModalOpen(false)
    } finally {
      setIsGeneratingDocs(false)
    }
  }

  const handleSonarScan = async () => {
    const activeRepo = getActiveRepo()
    if (!activeRepo?.repo_url) {
      toast.error("No repository loaded. Please scan a repo in the Librarian tab first.")
      return
    }

    setIsScanning(true)
    const toastId = toast.loading("Running deep SonarQube scan…")

    const runScan = async () => {
      const res = await triggerSonarScan(activeRepo.repo_url)
      if (res.status === "success") {
        toast.success(res.message, { id: toastId })
        await refresh(true) // Reload graph silently to show new health dots without triggering 'isRefreshing' overlay
      } else {
        toast.error(res.message, { id: toastId })
      }
    }

    try {
      await runScan()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)

      // "Repository not found locally" — backend doesn’t have a clone yet.
      // Auto-process the repo first, then retry the scan.
      const needsProcess =
        msg.includes("Repository not found locally") ||
        msg.includes("Project path not found") ||
        msg.includes("not found locally")

      if (needsProcess) {
        toast.loading(
          "Repository not yet indexed — cloning & scanning first…",
          { id: toastId }
        )
        try {
          await analyzeRepository(activeRepo.repo_url)
          toast.loading("Clone complete — running SonarQube…", { id: toastId })
          await runScan()
        } catch (processErr: unknown) {
          const detail = processErr instanceof Error ? processErr.message : String(processErr)
          console.error("Auto-process before Sonar Scan failed:", detail)
          toast.error(
            `Could not index repository: ${detail}`,
            { id: toastId }
          )
        }
      } else {
        console.error("Sonar Scan Failed:", msg)
        toast.error(
          msg.includes("Docker") || msg.includes("SonarScanner")
            ? "SonarQube scan failed. Is Docker running and SonarQube configured?"
            : `Sonar scan failed: ${msg}`,
          { id: toastId }
        )
      }
    } finally {
      setIsScanning(false)
    }
  }

  // Mutual exclusion — any operation running locks all buttons
  const isBusy = isRefreshing || isGeneratingDocs || isIncremental || isScanning

  return (
    <div className="flex flex-col h-full w-full rounded-none bg-[#09090b] overflow-hidden border-2 border-zinc-600 shadow-[4px_4px_0_#000]">

      {/* ── Graph Toolbar ── */}
      <div className="flex shrink-0 items-center h-12 border-b-2 border-zinc-600 bg-[#18181b] px-4 gap-3">

        {/* Left: stats — read-only context */}
        {isLive && graphMeta ? (
          <div className="flex items-center gap-2 min-w-0">
            <Activity className="h-3 w-3 text-success shrink-0" />
            <span className="font-mono text-xs font-semibold text-foreground truncate">{graphMeta.repo_name}</span>
            <div className="h-3 w-px bg-border" />
            <span className="font-mono text-[10px] text-muted-foreground whitespace-nowrap">{graphMeta.total_files} nodes</span>
            <span className={`font-mono text-[10px] font-bold whitespace-nowrap ${
              (graphMeta.system_health ?? 0) >= 80 ? "text-success" :
              (graphMeta.system_health ?? 0) >= 50 ? "text-warning" : "text-destructive"
            }`}>
              {(graphMeta.system_health ?? 0).toFixed(0)}% health
            </span>
            {incrementalResult && (
              <span className="font-mono text-[9px] text-amber-400 whitespace-nowrap">
                ⚡ {incrementalResult.graph_updated
                  ? `${incrementalResult.changed_files.length} file(s) updated in ${incrementalResult.update_time_seconds}s`
                  : "up to date"}
              </span>
            )}
          </div>
        ) : (
          <span className="font-mono text-[10px] text-muted-foreground">No repository loaded</span>
        )}

        <div className="flex-1" />

        {/* Right: action buttons — only shown when live */}
        {isLive && graphMeta && (
          <div className="flex items-center gap-1.5">
            {/* Refresh */}
            <button
              onClick={(e) => { e.stopPropagation(); refresh() }}
              disabled={isBusy}
              title="Re-fetch repository analysis"
              className={`inline-flex items-center gap-1.5 h-8 rounded-none border-2 px-3 font-mono text-[11px] font-bold uppercase transition-all
                ${ isRefreshing
                  ? "border-primary bg-primary/10 text-primary cursor-wait shadow-[2px_2px_0_#000]"
                  : isBusy
                  ? "border-zinc-700 bg-zinc-800 text-muted-foreground opacity-40 cursor-not-allowed shadow-[2px_2px_0_#000]"
                  : "border-zinc-600 bg-zinc-800 text-foreground hover:border-primary hover:bg-primary/10 hover:text-primary active:translate-y-[2px] active:translate-x-[2px] active:shadow-none shadow-[2px_2px_0_#000]"
                }`}
            >
              <RefreshCcw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />
              {isRefreshing ? "Refreshing" : "Refresh"}
            </button>

            {/* Generate Docs */}
            <button
              onClick={(e) => { e.stopPropagation(); handleGenerateDocs() }}
              disabled={isBusy}
              title="Generate PROJECT_GUIDE.md with AI"
              className={`inline-flex items-center gap-1.5 h-8 rounded-none border-2 px-3 font-mono text-[11px] font-bold uppercase transition-all
                ${ isGeneratingDocs
                  ? "border-success bg-success/10 text-success cursor-wait shadow-[2px_2px_0_#000]"
                  : isBusy
                  ? "border-zinc-700 bg-zinc-800 text-muted-foreground opacity-40 cursor-not-allowed shadow-[2px_2px_0_#000]"
                  : "border-zinc-600 bg-zinc-800 text-foreground hover:border-success hover:bg-success/10 hover:text-success active:translate-y-[2px] active:translate-x-[2px] active:shadow-none shadow-[2px_2px_0_#000]"
                }`}
            >
              <Sparkles className="h-3 w-3" />
              {isGeneratingDocs ? "Generating" : "Docs"}
            </button>

            {/* Incremental */}
            <button
              onClick={(e) => { e.stopPropagation(); handleIncrementalUpdate() }}
              disabled={isBusy}
              title="Re-index only changed files (git diff HEAD~1)"
              className={`inline-flex items-center gap-1.5 h-8 rounded-none border-2 px-3 font-mono text-[11px] font-bold uppercase transition-all
                ${ isIncremental
                  ? "border-amber-500 bg-amber-500/10 text-amber-400 cursor-wait shadow-[2px_2px_0_#000]"
                  : isBusy
                  ? "border-zinc-700 bg-zinc-800 text-muted-foreground opacity-40 cursor-not-allowed shadow-[2px_2px_0_#000]"
                  : "border-zinc-600 bg-zinc-800 text-foreground hover:border-amber-500 hover:bg-amber-500/10 hover:text-amber-400 active:translate-y-[2px] active:translate-x-[2px] active:shadow-none shadow-[2px_2px_0_#000]"
                }`}
            >
              <Zap className={`h-3 w-3 ${isIncremental ? "animate-pulse" : ""}`} />
              {isIncremental ? "Updating" : "Incremental"}
            </button>

            {/* Sonar Scan */}
            <button
              onClick={(e) => { e.stopPropagation(); handleSonarScan() }}
              disabled={isBusy}
              title="Run SonarQube quality audit (requires Docker)"
              className={`inline-flex items-center gap-1.5 h-8 rounded-none border-2 px-3 font-mono text-[11px] font-bold uppercase transition-all
                ${ isScanning
                  ? "border-blue-500 bg-blue-500/10 text-blue-400 cursor-wait shadow-[2px_2px_0_#000]"
                  : isBusy
                  ? "border-zinc-700 bg-zinc-800 text-muted-foreground opacity-40 cursor-not-allowed shadow-[2px_2px_0_#000]"
                  : "border-zinc-600 bg-zinc-800 text-foreground hover:border-blue-500 hover:bg-blue-500/10 hover:text-blue-400 active:translate-y-[2px] active:translate-x-[2px] active:shadow-none shadow-[2px_2px_0_#000]"
                }`}
            >
              <Search className={`h-3 w-3 ${isScanning ? "animate-spin" : ""}`} />
              {isScanning ? "Scanning" : "Sonar"}
            </button>
          </div>

        )}
      </div>

      {/* ── Graph Canvas (relative container for overlays) ── */}
      <div className="relative flex-1 overflow-hidden bg-[#09090b]">

        {/* Busy Overlay (Neo-brutalist loading state) */}
        {isBusy && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#09090b]/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="flex flex-col items-center gap-6">
              <div className="bone-stamp flex items-center justify-center bg-zinc-800 border-[3px] border-zinc-600 shadow-[5px_5px_0_#000]"
                style={{ width: 72, height: 72 }}>
                <span className="text-3xl font-mono text-white">
                  {isRefreshing ? "↻" : isGeneratingDocs ? "✦" : isIncremental ? "⚡" : "🔍"}
                </span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="h-3 w-48 bg-zinc-800 border-2 border-zinc-600 shadow-[3px_3px_0_#000] bone-stamp" />
                <div className="h-2 w-32 bg-zinc-800 border-2 border-zinc-600 shadow-[3px_3px_0_#000] bone-stamp" style={{ animationDelay: '80ms' }} />
              </div>
              <div className="flex gap-2 mt-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="bone-tick h-2.5 w-2.5 bg-zinc-600 border-2 border-zinc-600" style={{ animationDelay: `${i * 140}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Legend — top right */}
        <div className="absolute right-4 top-4 z-10 flex flex-wrap gap-3 rounded-none border-2 border-zinc-600 bg-zinc-900/95 px-3 py-2 shadow-[4px_4px_0_#000] animate-in fade-in slide-in-from-right-2">
          {Object.entries(typeLabels).map(([type, label]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: typeColors[type as GraphNode["type"]] }} />
              <span className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>

      <svg
        ref={svgRef}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        onMouseDown={(e) => {
          if (e.target === svgRef.current || (e.target as SVGElement).tagName === "rect") {
            setIsPanning(true)
            setPanStart({ x: e.clientX, y: e.clientY })
          }
        }}
        onMouseMove={handleMouseMove}
        onMouseUp={() => setIsPanning(false)}
        onMouseLeave={() => setIsPanning(false)}
        onClick={() => setSelectedNodeId(null)}
        className={`h-full w-full transition-all duration-1000 ease-out transform ${mounted ? "opacity-100 scale-100" : "opacity-0 scale-95"} ${isPanning ? "cursor-grabbing" : "cursor-grab"}`}
      >
        <defs>
          <pattern id="dotGrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.5" fill="var(--border)" opacity="0.4" />
          </pattern>
        </defs>

        <rect x={viewBox.x - 1000} y={viewBox.y - 1000} width={viewBox.w + 2000} height={viewBox.h + 2000} fill="url(#dotGrid)" />

        {/* Edges */}
        {edges.map((edge, i) => {
          const isConnectedToSelected = selectedNodeId === edge.fromId || selectedNodeId === edge.toId
          const isConnectedToActive = activeNodeId === edge.fromId || activeNodeId === edge.toId
          const isDimmed = activeNodeId !== null && !isConnectedToActive

          // Curved path logic for a more organic/cyber topology look
          const dx = edge.x2 - edge.x1
          const dy = edge.y2 - edge.y1
          const dr = Math.sqrt(dx * dx + dy * dy) * 1.5 // Curve radius

          return (
            <path
              key={i}
              d={`M${edge.x1},${edge.y1}A${dr},${dr} 0 0,1 ${edge.x2},${edge.y2}`}
              fill="none"
              stroke={isConnectedToSelected ? "var(--primary)" : "var(--muted-foreground)"}
              strokeWidth={isConnectedToSelected ? 2.5 : 1}
              strokeOpacity={isDimmed ? 0.05 : (isConnectedToSelected ? 0.9 : 0.25)}
              strokeDasharray={isConnectedToSelected ? "4 6" : "none"}
              className={`${isConnectedToSelected ? 'drop-shadow-[0_0_8px_var(--primary)] animated-edge' : ''} transition-all duration-500`}
            />
          )
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const isHovered = hoveredNode === node.id
          const isSelected = selectedNodeId === node.id
          const isActive = activeNodeId === node.id

          // Determine if this node is a neighbor of the active node
          let isNeighbor = false
          if (activeNodeId) {
            isNeighbor = edges.some(e =>
              (e.fromId === activeNodeId && e.toId === node.id) ||
              (e.toId === activeNodeId && e.fromId === node.id)
            )
          }

          const isDimmed = activeNodeId !== null && !isActive && !isNeighbor
          const isUnderMaintenance = maintenanceNodes.has(node.id)
          const IconComponent = typeIcons[node.type]
          const radius = isActive ? 22 : 18

          return (
            <g
              key={node.id}
              id={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={(e) => { e.stopPropagation(); setSelectedNodeId(node.id); }}
              className={`node-group cursor-pointer group transition-opacity duration-300 ${isDimmed ? 'opacity-20' : 'opacity-100'}`}
            >
              {isUnderMaintenance && (
                <circle
                  r={radius + 6}
                  stroke="#a855f7" // Purple-500
                  strokeWidth="2"
                  fill="none"
                  className="animate-pulse drop-shadow-[0_0_15px_rgba(168,85,247,0.6)]"
                />
              )}
              <circle
                r={radius}
                fill={typeColors[node.type]}
                fillOpacity={isActive ? 0.4 : 0.12}
                className={`transition-all duration-300 ${isActive ? 'drop-shadow-[0_0_15px_rgba(88,166,255,1)]' : ''}`}
              />
              <circle r={radius} stroke={typeColors[node.type]} strokeWidth="1.5" strokeOpacity={isActive ? 1 : 0.4} fill="none" className="transition-all duration-300" />

              {/* Health status dot */}
              {node.sonar_health && (
                <circle
                  cx={radius - 6} cy={-radius + 6} r={5}
                  className={`animate-pulse ${node.sonar_health.quality_gate === "PASSED" ? "fill-success" : "fill-destructive"}`}
                />
              )}

              <foreignObject x={-9} y={-9} width={18} height={18} className="pointer-events-none">
                <IconComponent style={{ color: typeColors[node.type] }} size={18} />
              </foreignObject>
              <text y={36} textAnchor="middle" fill="var(--foreground)" fontSize="10" className="font-mono select-none pointer-events-none transition-colors opacity-70 group-hover:opacity-100 tracking-wider">
                {node.label}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Info Card Overlay - Top Right */}
      {selectedNode && (
        <div className="absolute right-4 top-[4.5rem] z-30 w-72 animate-in slide-in-from-right-4 fade-in duration-300">
          <div className="flex h-[380px] flex-col rounded-xl border border-border bg-card/95 shadow-2xl overflow-hidden backdrop-blur-md">
            <div className="flex items-start justify-between border-b border-border p-3 bg-muted/30 backdrop-blur-md">
              <div className="overflow-hidden">
                <h3 className="text-xs font-bold text-foreground truncate">{selectedNode.label}</h3>
                <p className="font-mono text-[8px] text-muted-foreground truncate opacity-70">{selectedNode.path || `src/${selectedNode.type}s/${selectedNode.label.toLowerCase()}.tsx`}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedNodeId(null)}
                className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 card-scroll space-y-3">
              {selectedNode.sonar_health && Object.keys(selectedNode.sonar_health).length > 0 ? (
                <>
                  <div className={`flex items-center gap-2 rounded bg-secondary/30 px-2 py-1.5 border ${selectedNode.sonar_health.quality_gate === "PASSED" || selectedNode.sonar_health.quality_gate === "OK" ? "border-success/20 text-success" : "border-destructive/20 text-destructive"
                    }`}>
                    {(selectedNode.sonar_health.quality_gate === "PASSED" || selectedNode.sonar_health.quality_gate === "OK") ? (
                      <ShieldCheck className="h-3.5 w-3.5" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5" />
                    )}
                    <span className="text-[9px] font-bold uppercase tracking-widest">
                      Quality Gate {selectedNode.sonar_health.quality_gate || "UNKNOWN"}
                    </span>
                  </div>

                  {/* Owner & Jira Section (Task 2: GPS) */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col rounded border border-border bg-secondary/20 p-1.5 min-w-0">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Anchor className="h-2.5 w-2.5 shrink-0" />
                        <span className="text-[7px] font-bold uppercase truncate">Owner</span>
                      </div>
                      <span className="mt-0.5 font-mono text-[9px] font-bold text-foreground truncate">{selectedNode.owner || "Unknown"}</span>
                    </div>
                    <JiraTicketCell ticket={selectedNode.jira_tickets?.[0]} />
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Bugs", val: selectedNode.sonar_health.bugs ?? 0, icon: Bug },
                      { label: "Smells", val: selectedNode.sonar_health.code_smells ?? 0, icon: Zap },
                      { label: "Vulner.", val: selectedNode.sonar_health.vulnerabilities ?? 0, icon: ShieldCheck },
                      { label: "Hotspots", val: selectedNode.sonar_health.security_hotspots ?? 0, icon: Flame },
                      { label: "Coverage", val: `${(selectedNode.sonar_health.coverage ?? 0).toFixed(1)}%`, icon: Percent },
                      { label: "Duplicat.", val: `${(selectedNode.sonar_health.duplications ?? 0).toFixed(1)}%`, icon: Copy }
                    ].map((m, i) => (
                      <div key={i} className="flex flex-col rounded border border-border bg-secondary/20 p-1.5 min-w-0">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <m.icon className="h-2.5 w-2.5 shrink-0" />
                          <span className="text-[7px] font-bold uppercase truncate">{m.label}</span>
                        </div>
                        <span className="mt-0.5 font-mono text-[10px] font-bold text-foreground truncate">{m.val}</span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1.5 rounded-lg bg-primary/5 p-2.5 border border-primary/10">
                    <div className="flex items-center gap-1.5 text-primary">
                      <Sparkles className="h-3 w-3" />
                      <span className="text-[9px] font-bold uppercase">Librarian Insight</span>
                    </div>
                    <p className="text-[10px] leading-relaxed text-muted-foreground italic">
                      {selectedNode.type === "api" ? "Detected as an API endpoint. Ensure proper error handling." :
                        selectedNode.type === "hook" ? "Custom hook detected. Check for redundant side effects." :
                          "Architectural node analyzed. Dependency coupling is within safe limits."}
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-center gap-2">
                  <ShieldCheck className="h-7 w-7 text-muted-foreground/20" />
                  <p className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-widest">
                    No SonarQube data
                  </p>
                  <p className="text-[9px] text-muted-foreground/40 italic leading-relaxed">
                    Run a Sonar Scan from the toolbar above to populate health metrics for this node.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* 3. Interaction Hint Overlay (Bottom Left) */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-1 pointer-events-none p-2 border-2 border-zinc-600 bg-zinc-900/80 shadow-[4px_4px_0_#000] rounded-none animate-in fade-in slide-in-from-bottom-2">
        <span className="text-[9px] font-bold text-muted-foreground/80 uppercase tracking-widest">
          Left Click: Select Node
        </span>
        <span className="text-[9px] font-medium text-muted-foreground/60 uppercase tracking-widest">
          Scroll: Zoom · Canvas Drag: Pan
        </span>
      </div>

      <DocsModal
        isOpen={isDocsModalOpen}
        onClose={() => setIsDocsModalOpen(false)}
        isLoading={isGeneratingDocs}
        docs={generatedDocs}
        projectName={graphMeta?.repo_name || "Project"}
      />
      </div>
    </div>
  )
}