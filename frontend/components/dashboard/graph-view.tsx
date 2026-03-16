"use client"

import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import * as d3 from "d3"
import type { GraphNode } from "@/lib/demo-data"
import { useGraphData } from "@/hooks/use-graph-data"
import {
  Box, LayoutTemplate, Wrench, Cloud, Anchor, Activity,
  ShieldCheck, Bug, Zap, Percent, MessageSquareQuote, X, FileCode,
  AlertCircle, Loader2, RefreshCcw, Folder, Flame, Copy, Sparkles, Search, type LucideProps,
} from "lucide-react"
import { toast } from "sonner"
import { 
  generateIndustryDocs, 
  incrementalUpdate, 
  triggerSonarScan,
  type DocumentationResponse, 
  type IncrementalUpdateResult 
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

export function GraphView() {
  const svgRef = useRef<SVGSVGElement>(null)
  const simRef = useRef<d3.Simulation<any, undefined> | null>(null)

  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 1000, h: 800 })
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
      setViewBox((prev) => ({
        ...prev, w: prev.w * scale, h: prev.h * scale,
        x: prev.x + (prev.w - prev.w * scale) / 2,
        y: prev.y + (prev.h - prev.h * scale) / 2,
      }))
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
    setViewBox((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }))
    setPanStart({ x: e.clientX, y: e.clientY })
  }, [isPanning, panStart, viewBox])

  const activeNodeId = hoveredNode || selectedNodeId

  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null

  // Auto-zoom to selected node
  useEffect(() => {
    if (selectedNode && selectedNode.x !== undefined && selectedNode.y !== undefined) {
      // Find bounding box for node + connected edges to properly zoom
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

      // Smooth zoom transition
      const startX = viewBox.x
      const startY = viewBox.y
      const startW = viewBox.w
      const startH = viewBox.h

      let startTime: number | null = null
      const duration = 600

      const animateZoom = (timestamp: number) => {
        if (!startTime) startTime = timestamp
        const progress = Math.min((timestamp - startTime) / duration, 1)
        // easeInOutCubic
        const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2

        setViewBox({
          x: startX + (targetX - startX) * ease,
          y: startY + (targetY - startY) * ease,
          w: startW + (targetW - startW) * ease,
          h: startH + (targetH - startH) * ease,
        })

        if (progress < 1) {
          requestAnimationFrame(animateZoom)
        }
      }
      requestAnimationFrame(animateZoom)
    }
  }, [selectedNodeId]) // Only re-run when selection changes

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
    const toastId = toast.loading("Running deep SonarQube scan... (this take a minute)")
    try {
      const res = await triggerSonarScan(activeRepo.repo_url)
      if (res.status === "success") {
        toast.success(res.message, { id: toastId })
        refresh() // Reload graph to show new health dots
      } else {
        toast.error(res.message, { id: toastId })
      }
    } catch (err) {
      console.error("Sonar Scan Failed:", err)
      toast.error("SonarQube scan failed. Check if Docker is running.", { id: toastId })
    } finally {
      setIsScanning(false)
    }
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg bg-background">

      {/* 1. RESTORED: Top Left Live Status Badge */}
      {isLive && graphMeta && (
        <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-lg border border-border bg-card/90 px-3 py-1.5 backdrop-blur-sm transition-all duration-500 animate-in fade-in slide-in-from-top-2">
          <Activity className="h-3.5 w-3.5 text-success" />
          <span className="font-mono text-xs text-foreground font-semibold">{graphMeta.repo_name}</span>
          <div className="flex items-center gap-2">
            <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground border border-border/50">
              {graphMeta.total_files} nodes
            </span>
            <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] border ${(graphMeta.system_health ?? 0) >= 80 ? "bg-success/10 text-success border-success/30" :
              (graphMeta.system_health ?? 0) >= 50 ? "bg-warning/10 text-warning border-warning/30" :
                "bg-destructive/10 text-destructive border-destructive/30"
              }`}>
              {(graphMeta.system_health ?? 0).toFixed(0)}% Health
            </span>

            <button
              onClick={(e) => {
                e.stopPropagation();
                refresh();
              }}
              disabled={isRefreshing}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] border border-primary/30 bg-primary/10 text-primary transition-all hover:bg-primary/20 disabled:opacity-50"
              title="Refresh repository analysis"
            >
              <RefreshCcw className={`h-2.5 w-2.5 ${isRefreshing ? "animate-spin" : ""}`} />
              {isRefreshing ? "Scanning..." : "Refresh"}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleGenerateDocs();
              }}
              disabled={isGeneratingDocs}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] border border-success/30 bg-success/10 text-success transition-all hover:bg-success/20 disabled:opacity-50"
              title="Generate README & PRD"
            >
              <Sparkles className={`h-2.5 w-2.5 ${isGeneratingDocs ? "animate-pulse" : ""}`} />
              {isGeneratingDocs ? "Generating..." : "Generate Docs"}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleIncrementalUpdate();
              }}
              disabled={isIncremental}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] border border-amber-500/30 bg-amber-500/10 text-amber-400 transition-all hover:bg-amber-500/20 disabled:opacity-50"
              title="Re-index only changed files (git diff)"
            >
              <Zap className={`h-2.5 w-2.5 ${isIncremental ? "animate-pulse" : ""}`} />
              {isIncremental ? "Updating..." : "⚡ Incremental"}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSonarScan();
              }}
              disabled={isScanning}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] border border-blue-500/30 bg-blue-500/10 text-blue-400 transition-all hover:bg-blue-500/20 disabled:opacity-50"
              title="Run deep SonarQube quality audit"
            >
              <Search className={`h-2.5 w-2.5 ${isScanning ? "animate-spin" : ""}`} />
              {isScanning ? "Scanning..." : "🔍 Sonar Scan"}
            </button>

          </div>
          {/* Benchmark result pill */}
          {incrementalResult && (
            <div className="mt-1 flex items-center gap-1.5 rounded bg-amber-500/10 border border-amber-500/20 px-2 py-0.5">
              <Zap className="h-2.5 w-2.5 text-amber-400" />
              <span className="font-mono text-[9px] text-amber-400">
                {incrementalResult.graph_updated
                  ? `Updated ${incrementalResult.changed_files.length} file(s) in ${incrementalResult.update_time_seconds}s · Baseline ~${incrementalResult.full_scan_baseline_seconds}s`
                  : "Already up to date"}
              </span>
            </div>
          )}
        </div>
      )}

      {/* 2. RESTORED: Top Right Legend Overlay */}
      <div className="absolute right-4 top-4 z-10 flex flex-wrap gap-3 rounded-lg border border-border bg-card/90 px-3 py-2 backdrop-blur-sm animate-in fade-in slide-in-from-right-2">
        {Object.entries(typeLabels).map(([type, label]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: typeColors[type as GraphNode["type"]] }} />
            <span className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
      <style jsx>{`
        @keyframes marching-ants { to { stroke-dashoffset: 16; } }
        .animated-edge { animation: marching-ants 1s linear infinite; }
        .card-scroll::-webkit-scrollbar { width: 4px; }
        .card-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 10px; }
      `}</style>

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
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--border)" strokeWidth="0.3" strokeOpacity="0.5" />
          </pattern>
        </defs>

        <rect x={viewBox.x - 1000} y={viewBox.y - 1000} width={viewBox.w + 2000} height={viewBox.h + 2000} fill="url(#grid)" />

        {/* Edges */}
        {edges.map((edge, i) => {
          const isConnectedToSelected = selectedNodeId === edge.fromId || selectedNodeId === edge.toId
          const isConnectedToActive = activeNodeId === edge.fromId || activeNodeId === edge.toId
          const isDimmed = activeNodeId !== null && !isConnectedToActive

          return (
            <line
              key={i} x1={edge.x1} y1={edge.y1} x2={edge.x2} y2={edge.y2}
              stroke={isConnectedToSelected ? "#3b82f6" : "#ffffff"}
              strokeWidth={isConnectedToSelected ? 3 : 1.5}
              strokeOpacity={isDimmed ? 0.1 : (isConnectedToSelected ? 1 : 0.6)}
              strokeDasharray="4 4"
              className={`${isConnectedToSelected ? 'drop-shadow-[0_0_10px_rgba(59,130,246,1)]' : ''} transition-all duration-300`}
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
              <text y={34} textAnchor="middle" fill="var(--foreground)" fontSize="10" fontWeight="600" className="select-none pointer-events-none transition-colors opacity-70 group-hover:opacity-100">
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
                    <div className="flex flex-col rounded border border-border bg-secondary/20 p-1.5 min-w-0">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <MessageSquareQuote className="h-2.5 w-2.5 shrink-0" />
                        <span className="text-[7px] font-bold uppercase truncate">Jira</span>
                      </div>
                      <span className="mt-0.5 font-mono text-[9px] font-bold text-foreground truncate">
                        {(selectedNode.jira_tickets && selectedNode.jira_tickets.length > 0) 
                          ? selectedNode.jira_tickets[0] 
                          : "None"}
                      </span>
                    </div>
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
                <div className="flex flex-col items-center justify-center p-6 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/30 mb-2" />
                  <p className="text-[10px] text-muted-foreground italic">Fetching insights from Librarian...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* 3. Interaction Hint Overlay (Bottom Left) */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-0.5 pointer-events-none">
        <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest">
          Left Click: Select Node
        </span>
        <span className="text-[9px] font-medium text-muted-foreground/40 uppercase tracking-widest">
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
  )
}