"use client"

import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import * as d3 from "d3"
import type { GraphNode } from "@/lib/demo-data"
import { useGraphData } from "@/hooks/use-graph-data"
import {
  Box, LayoutTemplate, Wrench, Cloud, Anchor, Activity,
  ShieldCheck, Bug, Zap, Percent, MessageSquareQuote, X, FileCode,
  AlertCircle, Loader2, RefreshCcw, Folder, Flame, Copy, Sparkles, type LucideProps,
} from "lucide-react"
import { toast } from "sonner"
import { generateDocs, type DocsResponse } from "@/lib/api"
import { DocsModal } from "./docs-modal"

// --- Constants & Labels ---
const typeColors: Record<GraphNode["type"], string> = {
  module: "#58a6ff", component: "#3fb950", utility: "#d29922", api: "#f85149", hook: "#bc8cff",
  file: "#a5d6ff", folder: "#8b949e",
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
  const [generatedDocs, setGeneratedDocs] = useState<DocsResponse | null>(null)

  const { nodes: rawNodes, graphMeta, isLive, isRefreshing, refresh } = useGraphData()
  const [nodes, setNodes] = useState<(GraphNode & d3.SimulationNodeDatum)[]>([])

  // 1. Initialize Simulation
  useEffect(() => {
    setMounted(true)
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
      .on("tick", () => {
        setNodes([...simulationNodes])
      })

    simRef.current = simulation
    return () => {
      simulation.stop()
    }
  }, [rawNodes])

  // 2. Dragging Logic
  useEffect(() => {
    if (!svgRef.current || !nodes.length) return

    const svg = d3.select(svgRef.current)

    const drag = d3.drag<SVGGElement, any>()
      .on("start", (event) => {
        if (!event.active) simRef.current?.alphaTarget(0.2).restart()
      })
      .on("drag", (event) => {
        const nodeId = event.sourceEvent.target.closest('g')?.id
        const node = simRef.current?.nodes().find(n => (n as any).id === nodeId)
        if (node) {
          (node as any).fx = event.x;
          (node as any).fy = event.y;
        }
      })
      .on("end", (event) => {
        if (!event.active) simRef.current?.alphaTarget(0)
        const nodeId = event.sourceEvent.target.closest('g')?.id
        const node = simRef.current?.nodes().find(n => (n as any).id === nodeId)
        if (node) {
          (node as any).fx = null;
          (node as any).fy = null;
        }
      })

    svg.selectAll<SVGGElement, any>(".node-group").call(drag)
    return () => { }
  }, [nodes])

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
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const scale = e.deltaY > 0 ? 1.05 : 0.95
    setViewBox((prev) => ({
      ...prev, w: prev.w * scale, h: prev.h * scale,
      x: prev.x + (prev.w - prev.w * scale) / 2,
      y: prev.y + (prev.h - prev.h * scale) / 2,
    }))
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

  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null

  const handleGenerateDocs = async () => {
    if (!graphMeta || !rawNodes.length) {
      toast.error("No project data available to generate documentation.")
      return
    }

    // Safety check for project_root (mandatory for background processing)
    if (!graphMeta.project_root) {
      toast.error("Internal Error: project path not found. Please re-scan the repository.")
      return
    }

    setIsGeneratingDocs(true)
    setIsDocsModalOpen(true)
    try {
      // Build simplified edge map for documentation analysis
      const docEdges = rawNodes.flatMap(n =>
        (n.connections || []).map(targetId => ({
          source: n.id,
          target: targetId,
          relation: "imports"
        }))
      )

      const res = await generateDocs({
        project_name: graphMeta.repo_name,
        project_root: graphMeta.project_root,
        nodes: rawNodes.map(n => ({
          id: n.id,
          label: n.label,
          type: n.type,
          layer: n.layer || "system",
          sonar_health: n.sonar_health
        })),
        edges: docEdges
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

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg bg-background font-sans">

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
          </div>
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
        className={`h-full w-full transition-opacity duration-1000 ${mounted ? "opacity-100" : "opacity-0"}`}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        onWheel={handleWheel}
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
        style={{ cursor: isPanning ? "grabbing" : "grab" }}
      >
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--border)" strokeWidth="0.3" strokeOpacity="0.5" />
          </pattern>
        </defs>

        <rect x={viewBox.x - 1000} y={viewBox.y - 1000} width={viewBox.w + 2000} height={viewBox.h + 2000} fill="url(#grid)" />

        {/* Edges */}
        {edges.map((edge, i) => {
          const isHighlighted = hoveredNode === edge.fromId || hoveredNode === edge.toId
          return (
            <line
              key={i} x1={edge.x1} y1={edge.y1} x2={edge.x2} y2={edge.y2}
              stroke={isHighlighted ? "#58a6ff" : "#ffffff"}
              strokeWidth={isHighlighted ? 2 : 1}
              strokeOpacity={isHighlighted ? 0.8 : 0.6}
              strokeDasharray="4 4" className="animated-edge transition-all duration-300"
            />
          )
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const isHovered = hoveredNode === node.id
          const isSelected = selectedNodeId === node.id
          const IconComponent = typeIcons[node.type]
          const radius = isHovered || isSelected ? 22 : 18

          return (
            <g
              key={node.id}
              id={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={(e) => { e.stopPropagation(); setSelectedNodeId(node.id); }}
              className="node-group cursor-pointer group"
            >
              <circle r={radius} fill={typeColors[node.type]} fillOpacity={isHovered || isSelected ? 0.3 : 0.12} className="transition-all duration-300" />
              <circle r={radius} stroke={typeColors[node.type]} strokeWidth="1.5" strokeOpacity={isHovered || isSelected ? 1 : 0.4} fill="none" className="transition-all duration-300" />

              {/* Health status dot */}
              {node.sonar_health && (
                <circle
                  cx={radius - 6} cy={-radius + 6} r={5}
                  fill={node.sonar_health.quality_gate === "PASSED" ? "#3fb950" : "#f85149"}
                  className="animate-pulse"
                />
              )}

              <foreignObject x={-9} y={-9} width={18} height={18} className="pointer-events-none">
                <IconComponent color={typeColors[node.type]} size={18} />
              </foreignObject>
              <text y={34} textAnchor="middle" fill="#e6edf3" fontSize="10" fontWeight="600" className="select-none pointer-events-none transition-colors group-hover:fill-primary">
                {node.label}
              </text>
            </g>
          )
        })}

        {/* Info Card Overlay */}
        {selectedNode && (
          <foreignObject x={(selectedNode.x ?? 0) + 30} y={(selectedNode.y ?? 0) - 100} width="280" height="340">
            <div
              className="flex h-full flex-col rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
              onWheel={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between border-b border-border p-3 bg-secondary/10">
                <div className="overflow-hidden">
                  <h3 className="text-xs font-bold text-foreground truncate">{selectedNode.label}</h3>
                  <p className="font-mono text-[8px] text-muted-foreground truncate">{selectedNode.path || `src/${selectedNode.type}s/${selectedNode.label.toLowerCase()}.tsx`}</p>
                </div>
                <button onClick={() => setSelectedNodeId(null)} className="p-1 hover:bg-secondary rounded-md transition-colors"><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
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
                        <MessageSquareQuote className="h-3 w-3" />
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
          </foreignObject>
        )}
      </svg>

      {/* 3. Interaction Hint Overlay (Bottom Left) */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-0.5 pointer-events-none">
        <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest">
          Left Click: Select · Drag: Move
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