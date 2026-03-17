"use client"

import { useState, useEffect, useRef } from "react"
import mermaid from "mermaid"
import { MonitorPlay, RefreshCw, Download, Image as ImageIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { getActiveRepo } from "@/lib/repo-store"
import { generateArchitectureDiagram, type DiagramResponse } from "@/lib/api"

export function DiagramView() {
    const [loading, setLoading] = useState(false)
    const [diagramData, setDiagramData] = useState<DiagramResponse | null>(null)
    const [error, setError] = useState<string | null>(null)
    
    // We will render mermaid into this div
    const mermaidRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        mermaid.initialize({
            startOnLoad: false,
            theme: "dark",
            securityLevel: "loose",
            fontFamily: "var(--font-mono, monospace)"
        })
    }, [])

    useEffect(() => {
        if (diagramData?.mermaid_markdown && mermaidRef.current) {
            const renderDiagram = async () => {
                try {
                    // mermaid requires a unique id for each render call
                    const id = `mermaid-${Date.now()}`
                    const { svg } = await mermaid.render(id, diagramData.mermaid_markdown)
                    if (mermaidRef.current) {
                        mermaidRef.current.innerHTML = svg
                    }
                } catch (err: any) {
                    console.error("Mermaid parsing error:", err)
                    if (mermaidRef.current) {
                        mermaidRef.current.innerHTML = `<div class="text-rose-400 font-mono text-xs p-4">Error parsing Mermaid diagram:<br/>${err?.message || "Unknown syntax error"}</div>`
                    }
                }
            }
            renderDiagram()
        }
    }, [diagramData])

    const handleGenerate = async () => {
        const activeRepo = getActiveRepo()
        if (!activeRepo) {
            setError("No active repository selected. Please ingest a repository via Librarian first.")
            return
        }

        setLoading(true)
        setError(null)
        try {
            const result = await generateArchitectureDiagram({
                repo_url: activeRepo.repo_url,
                diagram_type: "architecture"
            })
            setDiagramData(result)
        } catch (err: any) {
            setError(err.message || "Failed to generate diagram")
            setDiagramData(null)
            if (mermaidRef.current) mermaidRef.current.innerHTML = ""
        } finally {
            setLoading(false)
        }
    }

    const handleDownloadSvg = () => {
        if (!mermaidRef.current) return
        const svgElement = mermaidRef.current.querySelector("svg")
        if (!svgElement) return

        const svgData = new XMLSerializer().serializeToString(svgElement)
        const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = `architecture-${Date.now()}.svg`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }

    const handleDownloadMd = () => {
        if (!diagramData?.mermaid_markdown) return
        const blob = new Blob([diagramData.mermaid_markdown], { type: "text/markdown;charset=utf-8" })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = `architecture-${Date.now()}.md`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }

    return (
        <div className="h-full overflow-y-auto bg-background/50 flex flex-col">
            <div className="mx-auto w-full max-w-7xl space-y-6 p-6 flex-1 flex flex-col">
                {/* PAGE HEADER */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between shrink-0">
                    <div className="flex items-start gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/5">
                            <MonitorPlay className="h-7 w-7 text-primary" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                                    The Visualizer
                                </h1>
                                <span className="rounded-full border border-primary/40 bg-primary/5 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-primary">
                                    Diagrams
                                </span>
                            </div>
                            <p className="mt-0.5 font-mono text-xs text-muted-foreground opacity-70">
                                Generating high-level system architecture graphs
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={handleGenerate}
                            disabled={loading}
                            className={`h-10 gap-2 font-mono text-xs font-bold border-primary/40 text-primary hover:bg-primary/10 transition-all ${loading ? "opacity-50" : ""}`}
                            variant="outline"
                        >
                            {loading ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                                <MonitorPlay className="h-4 w-4" />
                            )}
                            {loading ? "Generating..." : "Generate Diagram"}
                        </Button>
                    </div>
                </div>

                {/* ERROR MESSAGE */}
                {error && (
                    <div className="shrink-0 p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 font-mono text-sm shadow-sm backdrop-blur-sm">
                        {error}
                    </div>
                )}

                {/* VISUALIZER CANVAS */}
                <div className="flex-1 flex flex-col rounded-xl border border-zinc-800/80 bg-[rgba(8,10,18,0.95)] overflow-hidden relative shadow-lg">
                    {/* Header bar */}
                    <div className="flex items-center justify-between border-b border-primary/20 bg-primary/5 px-4 py-2.5 shrink-0">
                        <div className="flex items-center gap-2">
                            <ImageIcon className="h-4 w-4 text-primary" />
                            <span className="font-mono text-xs font-bold text-primary uppercase tracking-wider">Canvas</span>
                        </div>
                        {diagramData && (
                            <div className="flex gap-2">
                                <Button
                                    onClick={handleDownloadSvg}
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 gap-1.5 font-mono text-[10px] uppercase text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10"
                                >
                                    <Download className="h-3.5 w-3.5" />
                                    SVG
                                </Button>
                                <Button
                                    onClick={handleDownloadMd}
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 gap-1.5 font-mono text-[10px] uppercase text-cyan-400 hover:text-cyan-300 hover:bg-cyan-400/10"
                                >
                                    <Download className="h-3.5 w-3.5" />
                                    Markdown
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Canvas Area */}
                    <div className="flex-1 overflow-auto relative flex items-center justify-center p-6">
                        {!diagramData && !loading && (
                            <div className="flex flex-col items-center gap-4 text-center max-w-sm">
                                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-2 shadow-[0_0_30px_rgba(56,189,248,0.15)]">
                                    <MonitorPlay className="h-8 w-8 text-primary/60" />
                                </div>
                                <h3 className="font-mono text-sm font-bold text-zinc-300 uppercase tracking-wider">Empty Canvas</h3>
                                <p className="font-sans text-sm text-zinc-500 leading-relaxed">
                                    Click "Generate Diagram" to prompt the Visualizer AI to construct a high-level system mapping based on the active repository graph.
                                </p>
                            </div>
                        )}
                        
                        {loading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10 transition-all">
                                <div className="flex flex-col items-center gap-4">
                                    <RefreshCw className="h-12 w-12 animate-spin text-primary" />
                                    <span className="font-mono text-xs uppercase tracking-widest text-primary animate-pulse">Rendering Blueprint...</span>
                                </div>
                            </div>
                        )}

                        <div 
                            ref={mermaidRef} 
                            style={{ opacity: loading ? 0.3 : 1 }}
                            className="transition-opacity duration-500 w-full h-full flex items-center justify-center min-h-[400px]" 
                        >
                            {/* Mermaid SVG injects here */}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
