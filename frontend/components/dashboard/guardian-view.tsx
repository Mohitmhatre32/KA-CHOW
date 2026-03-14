"use client"

import { useState, useCallback, useEffect } from "react"
import {
    ShieldAlert,
    CheckCircle,
    Sparkles,
    GitPullRequest,
    XCircle,
    AlertTriangle,
    Bug,
    Code2,
    FileCode,
    Zap,
    RefreshCw,
    ChevronRight,
    Circle,
    FolderOpen,
    Loader2,
    ChevronDown,
    Save,
    Trash2,
    BadgeCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    guardianReviewPR,
    guardianAutoHeal,
    guardianSaveCheck,
    getFileContent,
    analyzeRepository,
    type PRReviewResponse,
} from "@/lib/api"
import { getActiveRepo, upsertRepo } from "@/lib/repo-store"
import type { ApiGraphNode } from "@/lib/api"

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Returns a Set of 1-indexed line numbers that differ between original and healed code */
function computeHealedLines(original: string, healed: string): Set<number> {
    const origLines = original.split("\n")
    const healedLines = healed.split("\n")
    const changed = new Set<number>()
    const maxLen = Math.max(origLines.length, healedLines.length)
    for (let i = 0; i < maxLen; i++) {
        if (origLines[i] !== healedLines[i]) changed.add(i + 1)
    }
    return changed
}

type ViewState = "idle" | "reviewing" | "reviewed" | "healing" | "healed"

// ─── Sub-components ──────────────────────────────────────────────────────────

function GlowPulse({ color = "success" }: { color?: "destructive" | "warning" | "success" }) {
    const colorMap = {
        destructive: "bg-destructive",
        warning: "bg-warning",
        success: "bg-success",
    }
    return (
        <span className="relative flex h-2 w-2">
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${colorMap[color]} opacity-75`} />
            <span className={`relative inline-flex h-2 w-2 rounded-full ${colorMap[color]}`} />
        </span>
    )
}

function MetricCard({
    title,
    value,
    sub,
    status,
    icon: Icon,
}: {
    title: string
    value: string
    sub?: string
    status: "fail" | "warn" | "pass"
    icon: React.ElementType
}) {
    const statusStyles = {
        fail: "border-destructive/30 bg-destructive/5",
        warn: "border-warning/30 bg-warning/5",
        pass: "border-success/30 bg-success/5",
    }
    const valueStyles = { 
        fail: "text-destructive", 
        warn: "text-warning", 
        pass: "text-success" 
    }
    const iconBg = {
        fail: "border-destructive/20 bg-destructive/10",
        warn: "border-warning/20 bg-warning/10",
        pass: "border-success/20 bg-success/10",
    }
    const iconColor = { 
        fail: "text-destructive", 
        warn: "text-warning", 
        pass: "text-success" 
    }

    return (
        <div className={`relative overflow-hidden rounded-xl border p-4 bg-card/50 backdrop-blur-sm ${statusStyles[status]}`}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
                    <p className={`font-mono text-2xl font-bold ${valueStyles[status]}`}>{value}</p>
                    {sub && <p className="mt-1 font-mono text-[10px] text-muted-foreground opacity-70">{sub}</p>}
                </div>
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg border ${iconBg[status]}`}>
                    <Icon className={`h-4 w-4 ${iconColor[status]}`} />
                </div>
            </div>
        </div>
    )
}

function CodePane({
    title,
    code,
    annotations,
    healedLines,
    side,
}: {
    title: string
    code: string
    annotations?: Record<number, string>
    healedLines?: Set<number>
    side: "left" | "right"
}) {
    const lines = code.split("\n")
    const [hoveredLine, setHoveredLine] = useState<number | null>(null)

    return (
        <div className="flex h-full flex-col overflow-hidden">
            <div
                className={`flex items-center gap-2 border-b px-4 py-2.5 ${side === "left" ? "border-destructive/20 bg-destructive/5" : "border-success/20 bg-success/5"}`}
            >
                <FileCode className={`h-3.5 w-3.5 ${side === "left" ? "text-destructive" : "text-success"}`} />
                <span className={`font-mono text-[10px] font-bold uppercase tracking-tight truncate max-w-[200px] ${side === "left" ? "text-destructive" : "text-success"}`}>
                    {title}
                </span>
                <Badge variant="outline" className={`ml-auto shrink-0 font-mono text-[9px] ${side === "left" ? "border-destructive/30 text-destructive bg-destructive/5" : "border-success/30 text-success bg-success/5"}`}>
                    {side === "left" ? "ORIGINAL" : "AI HEALED"}
                </Badge>
            </div>
            <div className="flex-1 overflow-auto">
                <table className="w-full border-collapse">
                    <tbody>
                        {lines.map((line, i) => {
                            const lineNum = i + 1
                            const hasAnnotation = annotations?.[lineNum]
                            const isHealed = healedLines?.has(lineNum)
                            const isHovered = hoveredLine === lineNum

                            return (
                                <tr
                                    key={i}
                                    className={`group relative transition-colors ${side === "left" && hasAnnotation ? "bg-destructive/10" : ""} ${side === "right" && isHealed ? "bg-success/10" : "hover:bg-muted/30"}`}
                                    onMouseEnter={() => setHoveredLine(lineNum)}
                                    onMouseLeave={() => setHoveredLine(null)}
                                >
                                    <td className="w-12 select-none border-r border-border pr-3 text-right font-mono text-[10px] text-muted-foreground opacity-50">
                                        {lineNum}
                                    </td>
                                    <td className="w-4 select-none text-center font-mono text-[10px]">
                                        {side === "left" && hasAnnotation && <span className="text-destructive">-</span>}
                                        {side === "right" && isHealed && <span className="text-success">+</span>}
                                    </td>
                                    <td className="w-full px-2 py-0.5">
                                        <pre className={`font-mono text-[11px] leading-relaxed ${side === "left" && hasAnnotation ? "text-destructive-foreground opacity-90" : side === "right" && isHealed ? "text-success opacity-90" : "text-foreground opacity-70"}`}>
                                            {line || " "}
                                        </pre>
                                    </td>
                                    {side === "left" && hasAnnotation && isHovered && (
                                        <td className="w-0 overflow-visible">
                                            <div className="absolute right-2 top-0 z-10 flex items-center gap-2 rounded-md border border-destructive/40 bg-card px-2.5 py-1 shadow-xl">
                                                <AlertTriangle className="h-3 w-3 text-destructive" />
                                                <span className="whitespace-nowrap font-mono text-[9px] text-destructive italic">
                                                    Line {lineNum}: {hasAnnotation}
                                                </span>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

// ─── File Selector Panel ──────────────────────────────────────────────────────

function FileSelectorPanel({
    nodes,
    selectedPath,
    onSelect,
    onLoad,
    isLoading,
}: {
    nodes: ApiGraphNode[]
    selectedPath: string
    onSelect: (path: string) => void
    onLoad: () => void
    isLoading: boolean
}) {
    const [open, setOpen] = useState(false)
    const fileNodes = nodes.filter((n) => n.type === "file")

    return (
        <div className="flex items-center gap-3">
            <div className="relative">
                <button
                    onClick={() => setOpen((v) => !v)}
                    className="flex items-center gap-2 rounded-lg border border-zinc-700/60 bg-zinc-900/80 px-3 py-2 font-mono text-xs text-zinc-300 transition-all hover:border-zinc-600 max-w-xs"
                >
                    <FolderOpen className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                    <span className="truncate max-w-[220px]">
                        {selectedPath ? selectedPath.split("/").pop() || selectedPath : "Select a file from repo…"}
                    </span>
                    <ChevronDown className="h-3 w-3 text-zinc-500 shrink-0 ml-1" />
                </button>

                {open && fileNodes.length > 0 && (
                    <div className="absolute left-0 top-full z-50 mt-1 max-h-64 w-80 overflow-y-auto rounded-xl border border-zinc-700/60 bg-zinc-950 shadow-2xl">
                        {fileNodes.map((node) => (
                            <button
                                key={node.id}
                                onClick={() => { onSelect(node.id); setOpen(false) }}
                                className={`flex w-full items-center gap-2 px-3 py-2 text-left font-mono text-[11px] transition-colors hover:bg-zinc-800 ${selectedPath === node.id ? "bg-indigo-950/40 text-indigo-300" : "text-zinc-400"}`}
                            >
                                <FileCode className="h-3 w-3 shrink-0 text-zinc-500" />
                                <span className="truncate">{node.id}</span>
                                {node.sonar_health?.bugs > 0 && (
                                    <span className="ml-auto rounded-full bg-rose-500/20 px-1.5 py-0.5 text-[9px] text-rose-400">
                                        {node.sonar_health.bugs} bug{node.sonar_health.bugs !== 1 ? "s" : ""}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <Button
                onClick={onLoad}
                disabled={!selectedPath || isLoading}
                variant="outline"
                size="sm"
                className="h-9 gap-2 font-mono text-xs border-primary/30 text-primary hover:bg-primary/10 transition-all disabled:opacity-40"
            >
                {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderOpen className="h-3.5 w-3.5" />}
                Load File
            </Button>
        </div>
    )
}

// ─── Main component ──────────────────────────────────────────────────────────

export function GuardianView() {
    const [viewState, setViewState] = useState<ViewState>("idle")
    const [reviewResult, setReviewResult] = useState<PRReviewResponse | null>(null)
    const [healedCode, setHealedCode] = useState<string | null>(null)
    const [healMessage, setHealMessage] = useState<string>("")
    const [error, setError] = useState<string | null>(null)
    const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle")
    const [showSaveToast, setShowSaveToast] = useState(false)

    // ── Dynamic file state ───────────────────────────────────────────────────
    const [repoNodes, setRepoNodes] = useState<ApiGraphNode[]>([])
    const [selectedFilePath, setSelectedFilePath] = useState<string>("")
    const [activeCode, setActiveCode] = useState<string>("")
    const [activeFileName, setActiveFileName] = useState<string>("")
    const [fileLoadingState, setFileLoadingState] = useState<"idle" | "loading" | "loaded" | "error">("idle")
    const [repoName, setRepoName] = useState<string>("")
    const [projectRoot, setProjectRoot] = useState<string>("")

    // ── Load repo nodes from store on mount ───────────────────────────────────
    useEffect(() => {
        const repo = getActiveRepo()
        if (repo?.data?.nodes?.length) {
            setRepoNodes(repo.data.nodes)
            setRepoName(repo.repo_name)
            // project_root is the absolute path on disk to the cloned/local repo
            setProjectRoot(repo.data.project_root ?? "")
        }
    }, [])

    // ── Load selected file content ────────────────────────────────────────────
    const handleLoadFile = useCallback(async () => {
        if (!selectedFilePath) return
        setFileLoadingState("loading")
        setError(null)
        // Reset review when loading a new file
        setViewState("idle")
        setReviewResult(null)
        setHealedCode(null)
        setHealMessage("")

        try {
            // Node IDs are relative paths; join with project_root for the absolute path
            const separator = projectRoot.includes("\\") ? "\\" : "/"
            const absolutePath = projectRoot
                ? `${projectRoot}${separator}${selectedFilePath.replace(/\//g, separator)}`
                : selectedFilePath

            const content = await getFileContent(absolutePath)

            // Backend returns an error sentinel string on path misses
            if (content.startsWith("# Error:") || content.includes("File not found")) {
                throw new Error(content.replace("# Error:", "").trim())
            }

            setActiveCode(content)
            setActiveFileName(selectedFilePath.split("/").pop() || selectedFilePath)
            setFileLoadingState("loaded")
        } catch (e) {
            setError(`Could not load file: ${(e as Error).message}`)
            setFileLoadingState("error")
        }
    }, [selectedFilePath, projectRoot])

    // ── Review handler ────────────────────────────────────────────────────────
    const handleReview = useCallback(async () => {
        setViewState("reviewing")
        setError(null)
        try {
            const result = await guardianReviewPR({
                file_name: activeFileName,
                code_content: activeCode,
            })
            setReviewResult(result)
            setViewState("reviewed")
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Backend unavailable — showing demo data."
            setError(msg)
            setReviewResult({
                status: "BLOCKED",
                issues_found: [
                    "Missing docstrings on all functions and class",
                    "Unused import: requests (line 4)",
                    "Non-descriptive variable names (x, y)",
                    "Hardcoded HTTP URL (non-HTTPS) in authenticate()",
                    "SQL injection vulnerability in get_user()",
                ],
                message: "❌ MERGE BLOCKED: Quality Gate Failed. Please fix the technical debt.",
            })
            setViewState("reviewed")
        }
    }, [activeCode, activeFileName])

    // ── Heal handler ──────────────────────────────────────────────────────────
    const handleHeal = useCallback(async () => {
        setViewState("healing")
        setError(null)
        const issues = reviewResult?.issues_found ?? ["Code quality issues detected."]
        try {
            const result = await guardianAutoHeal({
                file_name: activeFileName,
                code_content: activeCode,
                issues,
            })
            setHealedCode(result.fixed_code)
            setHealMessage(result.message)
            setViewState("healed")
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Backend unavailable."
            setError(msg)
            setHealedCode(activeCode + "\n# Auto-heal failed — backend unavailable.")
            setHealMessage("⚠️ Heal failed — demo fallback shown.")
            setViewState("healed")
        }
    }, [reviewResult, activeCode, activeFileName])

    const handleReset = () => {
        setViewState("idle")
        setReviewResult(null)
        setHealedCode(null)
        setHealMessage("")
        setError(null)
        setSaveState("idle")
    }

    // ── Save healed code back to disk ───────────────────────────────────────
    const handleSave = useCallback(async () => {
        if (!healedCode || !projectRoot || !selectedFilePath) return
        setSaveState("saving")
        const separator = projectRoot.includes("\\") ? "\\" : "/"
        const absolutePath = `${projectRoot}${separator}${selectedFilePath.replace(/\//g, separator)}`
        try {
            await guardianSaveCheck({
                file_path: absolutePath,
                content: healedCode,
                project_key: repoName,
            })
            // Update activeCode to the newly-saved content
            setActiveCode(healedCode)
            setHealedCode(null)
            setHealMessage("")
            setSaveState("saved")
            setViewState("idle")
            // Show success toast, auto-dismiss after 3 s
            setShowSaveToast(true)
            setTimeout(() => setShowSaveToast(false), 3000)

            // ── Re-scan the repo so the knowledge graph reflects the saved file ──
            const activeRepo = getActiveRepo()
            if (activeRepo?.repo_url) {
                try {
                    const freshGraph = await analyzeRepository(
                        activeRepo.repo_url,
                        activeRepo.data?.branch ?? "main"
                    )
                    upsertRepo(activeRepo.repo_url, freshGraph)
                    // Update guardian's own file list
                    setRepoNodes(freshGraph.nodes)
                    // Notify GraphView and other listeners to re-render
                    window.dispatchEvent(new Event("active-repo-changed"))
                } catch {
                    // Re-scan failure is non-fatal — graph may be slightly stale
                    console.warn("Guardian: graph re-scan failed after save")
                }
            }
        } catch (e) {
            setError(`Save failed: ${(e as Error).message}`)
            setSaveState("idle")
        }
    }, [healedCode, projectRoot, selectedFilePath, repoName])

    const handleDiscard = () => {
        // Keep the original file — just throw away healed code
        setHealedCode(null)
        setHealMessage("")
        setViewState("reviewed")
        setSaveState("idle")
    }

    const isBlocked = reviewResult?.status === "BLOCKED"
    const issues = reviewResult?.issues_found ?? []
    const hasRepo = repoNodes.length > 0
    const hasFile = fileLoadingState === "loaded" && activeCode.length > 0
    const prLabel = activeFileName ? activeFileName : "No file loaded"

    return (
        <div className="relative h-full overflow-y-auto bg-background/50">
            {/* ── SAVE SUCCESS TOAST ── */}
            <div
                className={`pointer-events-none fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border border-emerald-500/40 px-5 py-3 shadow-2xl transition-all duration-500 ${showSaveToast
                    ? "translate-y-0 opacity-100"
                    : "translate-y-6 opacity-0"
                    }`}
                style={{
                    background: "rgba(10,24,18,0.97)",
                    backdropFilter: "blur(16px)",
                    boxShadow: "0 0 30px rgba(16,185,129,0.2), 0 4px 24px rgba(0,0,0,0.6)",
                }}
            >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/15">
                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                    <p className="font-mono text-xs font-semibold text-emerald-300">File saved to disk</p>
                    <p className="font-mono text-[10px] text-zinc-500">{activeFileName} has been updated</p>
                </div>
            </div>
            <div className="mx-auto max-w-7xl space-y-6 p-6">

                {/* ── PAGE HEADER ── */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-4">
                        <div
                            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/5"
                        >
                            <ShieldAlert className="h-7 w-7 text-rose-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-bold tracking-tight text-zinc-100" style={{ fontFamily: "Inter, sans-serif" }}>
                                    The Guardian
                                </h1>
                                <span
                                    className="rounded-full border border-destructive/40 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-destructive"
                                    style={{ background: "var(--destructive-muted)" }}
                                >
                                    CI/CD Enforcer
                                </span>
                                <GlowPulse color="destructive" />
                            </div>
                            <p className="mt-0.5 font-mono text-xs text-zinc-500">
                                Intercepting Webhooks &amp; Enforcing Quality Gates
                            </p>
                        </div>
                    </div>

                    {/* Right side: PR badge + buttons */}
                    <div className="flex shrink-0 flex-col items-end gap-2">
                        <div
                            className="flex items-center gap-2 rounded-xl border border-zinc-700/50 px-3 py-2"
                            style={{ background: "rgba(24,27,40,0.8)" }}
                        >
                            <GitPullRequest className="h-3.5 w-3.5 text-zinc-400" />
                            <span className="font-mono text-xs text-zinc-300">
                                <span className="text-zinc-500">PR · </span>
                                <span className="max-w-[160px] truncate inline-block align-bottom">{prLabel}</span>
                            </span>
                            <span
                                className={`flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${isBlocked ? "border border-rose-500/30 bg-rose-500/10 text-rose-400" : viewState === "reviewed" ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border border-zinc-700 bg-zinc-800 text-zinc-500"}`}
                            >
                                {viewState === "idle" ? "Pending" : isBlocked ? "Blocked" : "Passed"}
                            </span>
                        </div>

                        <div className="flex gap-2">
                            {viewState === "idle" && (
                                <Button
                                    onClick={handleReview}
                                    disabled={!hasFile}
                                    variant="outline"
                                    className="gap-2 font-mono text-xs border-border bg-card/50 hover:bg-muted transition-all"
                                >
                                    <ShieldAlert className="h-3.5 w-3.5" />
                                    Run CI/CD Review
                                </Button>
                            )}
                            {viewState !== "idle" && (
                                <Button
                                    onClick={handleReset}
                                    variant="ghost"
                                    size="sm"
                                    className="gap-2 font-mono text-[10px] text-muted-foreground hover:text-foreground"
                                >
                                    <RefreshCw className="h-3 w-3" />
                                    Reset
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── FILE LOADER PANEL ── */}
                <div
                    className="rounded-xl border border-zinc-800/60 px-5 py-4"
                    style={{ background: "rgba(14,17,29,0.7)" }}
                >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                            <FolderOpen className="h-4 w-4 text-indigo-400 shrink-0" />
                            <div>
                                <p className="font-mono text-xs font-semibold text-zinc-300">
                                    {hasRepo ? (
                                        <>Repo: <span className="text-indigo-300">{repoName}</span> · {repoNodes.filter(n => n.type === "file").length} files</>
                                    ) : (
                                        <span className="text-zinc-500">No repo scanned — scan one in the Librarian tab first</span>
                                    )}
                                </p>
                                <p className="font-mono text-[10px] text-zinc-600 mt-0.5">
                                    {fileLoadingState === "loaded"
                                        ? `✓ Loaded: ${activeFileName} (${activeCode.split("\n").length} lines)`
                                        : fileLoadingState === "loading"
                                            ? "Loading file content…"
                                            : fileLoadingState === "error"
                                                ? "⚠ Failed to load — check file path"
                                                : hasRepo
                                                    ? "Select a file to run CI/CD review on real code"
                                                    : "Scan a repo in the Librarian tab first"}
                                </p>
                            </div>
                        </div>

                        {hasRepo && (
                            <FileSelectorPanel
                                nodes={repoNodes}
                                selectedPath={selectedFilePath}
                                onSelect={setSelectedFilePath}
                                onLoad={handleLoadFile}
                                isLoading={fileLoadingState === "loading"}
                            />
                        )}
                    </div>
                </div>

                {/* ── REVIEWING STATE ── */}
                {viewState === "reviewing" && (
                    <div
                        className="flex items-center justify-center rounded-2xl border border-zinc-800/80 py-16"
                        style={{ background: "rgba(14,17,29,0.7)" }}
                    >
                        <div className="flex flex-col items-center gap-4">
                            <div className="relative">
                                <ShieldAlert className="h-12 w-12 animate-pulse text-rose-400" />
                                <div className="absolute inset-0 animate-ping rounded-full border border-rose-500/30" />
                            </div>
                            <p className="font-mono text-sm text-zinc-400">
                                Scanning <span className="text-zinc-200">{activeFileName}</span> for quality violations…
                            </p>
                            <div className="flex gap-1">
                                {[0, 1, 2].map((i) => (
                                    <div
                                        key={i}
                                        className="h-1.5 w-8 animate-pulse rounded-full bg-rose-500/40"
                                        style={{ animationDelay: `${i * 0.2}s` }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── REVIEWED / HEALED STATE ── */}
                {(viewState === "reviewed" || viewState === "healing" || viewState === "healed") && (
                    <>
                        {error && (
                            <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 font-mono text-xs text-amber-400">
                                <AlertTriangle className="h-4 w-4 shrink-0" />
                                {error} Demo data shown.
                            </div>
                        )}

                        {/* ── SONARQUBE + ENFORCEMENT ROW ── */}
                        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

                            {/* Quality Gate Cards — 2 cols */}
                            <div className="space-y-4 lg:col-span-2">
                                <div className="flex items-center gap-2">
                                    <Code2 className="h-4 w-4 text-zinc-500" />
                                    <span className="font-mono text-xs font-semibold uppercase tracking-widest text-zinc-500">
                                        SonarQube Quality Gate
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                    {/* Overall status — dynamic */}
                                    <div
                                        className={`col-span-full flex items-center justify-between rounded-xl border px-5 py-4 ${isBlocked ? "border-destructive/30 bg-destructive/5" : "border-success/30 bg-success/5"}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            {isBlocked ? (
                                                <XCircle className="h-8 w-8 text-rose-500" />
                                            ) : (
                                                <CheckCircle className="h-8 w-8 text-emerald-500" />
                                            )}
                                            <div>
                                                <p className={`font-mono text-xs uppercase tracking-widest ${isBlocked ? "text-rose-500/70" : "text-emerald-500/70"}`}>
                                                    Overall Status
                                                </p>
                                                <p
                                                    className={`font-mono text-2xl font-black tracking-tight ${isBlocked ? "text-rose-400" : "text-emerald-400"}`}
                                                    style={{ textShadow: isBlocked ? "0 0 20px rgba(239,68,68,0.5)" : "0 0 20px rgba(16,185,129,0.5)" }}
                                                >
                                                    QUALITY GATE: {reviewResult?.status ?? "UNKNOWN"}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="hidden sm:flex sm:items-center sm:gap-2">
                                            <GlowPulse color={isBlocked ? "destructive" : "success"} />
                                            <span className={`font-mono text-[10px] uppercase tracking-widest ${isBlocked ? "text-destructive/60" : "text-success/60"}`}>Live</span>
                                        </div>
                                    </div>

                                    {/* Issues count — dynamic */}
                                    <MetricCard
                                        title="Issues Found"
                                        value={String(issues.length)}
                                        sub={issues.length > 0 ? "Fix before merge" : "Clean ✓"}
                                        status={issues.length > 3 ? "fail" : issues.length > 0 ? "warn" : "pass"}
                                        icon={Bug}
                                    />

                                    {/* Critical issues — security keyword scan */}
                                    <MetricCard
                                        title="Critical Issues"
                                        value={String(
                                            issues.filter((i) =>
                                                i.toLowerCase().includes("inject") ||
                                                i.toLowerCase().includes("security") ||
                                                i.toLowerCase().includes("vulnerab") ||
                                                i.toLowerCase().includes("hardcoded")
                                            ).length
                                        )}
                                        sub="Security + Injection risks"
                                        status={
                                            issues.some((i) =>
                                                i.toLowerCase().includes("inject") ||
                                                i.toLowerCase().includes("security") ||
                                                i.toLowerCase().includes("vulnerab")
                                            )
                                                ? "fail"
                                                : "pass"
                                        }
                                        icon={ShieldAlert}
                                    />

                                    {/* Quality score — derived from issue count */}
                                    <MetricCard
                                        title="Code Quality Score"
                                        value={
                                            issues.length === 0
                                                ? "100%"
                                                : issues.length <= 2
                                                    ? "70%"
                                                    : issues.length <= 4
                                                        ? "45%"
                                                        : "20%"
                                        }
                                        sub={isBlocked ? "Below threshold" : "Above threshold"}
                                        status={issues.length === 0 ? "pass" : issues.length <= 3 ? "warn" : "fail"}
                                        icon={Zap}
                                    />
                                </div>
                            </div>

                            {/* Enforcement Panel — 1 col */}
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center gap-2">
                                    <ShieldAlert className="h-4 w-4 text-zinc-500" />
                                    <span className="font-mono text-xs font-semibold uppercase tracking-widest text-zinc-500">
                                        Enforcement Action
                                    </span>
                                </div>

                                <div
                                    className={`flex flex-1 flex-col gap-4 rounded-xl border p-5 bg-card/30 backdrop-blur-sm ${isBlocked ? "border-destructive/25 shadow-[inset_0_0_40px_rgba(var(--destructive),0.05)]" : "border-success/25 shadow-[inset_0_0_40px_rgba(var(--success),0.05)]"}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${isBlocked ? "border-rose-500/30 bg-rose-500/10" : "border-emerald-500/30 bg-emerald-500/10"}`}>
                                            {isBlocked ? <XCircle className="h-5 w-5 text-rose-500" /> : <CheckCircle className="h-5 w-5 text-emerald-500" />}
                                        </div>
                                        <div>
                                            <p className={`font-mono text-base font-bold ${isBlocked ? "text-rose-300" : "text-emerald-300"}`}>
                                                {isBlocked ? "Merge Blocked" : "Ready to Merge"}
                                            </p>
                                            <p className={`font-mono text-[10px] uppercase tracking-wider ${isBlocked ? "text-rose-500/60" : "text-emerald-500/60"}`}>
                                                Guardian Enforcing Policy
                                            </p>
                                        </div>
                                    </div>

                                    <p className="font-mono text-xs leading-relaxed text-zinc-400">
                                        {isBlocked
                                            ? <>This code violates the{" "}<span className="font-semibold text-rose-400">'No Docs, No Merge'</span> policy and contains SonarQube code smells.</>
                                            : <><span className="font-semibold text-emerald-400">All checks passed.</span> Code meets quality standards and is approved to merge.</>
                                        }
                                    </p>

                                    {/* Issues list */}
                                    <div className="space-y-1.5">
                                        <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-600">
                                            {isBlocked ? "Violations Detected" : "Quality Checks"}
                                        </p>
                                        {issues.map((issue, i) => (
                                            <div key={i} className="flex items-start gap-2">
                                                <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-rose-500" />
                                                <span className="font-mono text-[11px] text-zinc-400">{issue}</span>
                                            </div>
                                        ))}
                                        {issues.length === 0 && !isBlocked && (
                                            <div className="flex items-center gap-2 text-emerald-600">
                                                <CheckCircle className="h-3 w-3" />
                                                <span className="font-mono text-xs">No violations — code is clean!</span>
                                            </div>
                                        )}
                                        {issues.length === 0 && isBlocked && (
                                            <div className="flex items-center gap-2 text-zinc-600">
                                                <Circle className="h-3 w-3" />
                                                <span className="font-mono text-xs">No issues loaded</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className={`mt-auto rounded-lg border p-3 ${isBlocked ? "border-rose-500/20 bg-rose-500/5" : "border-emerald-500/20 bg-emerald-500/5"}`}>
                                        <p className={`font-mono text-[10px] leading-relaxed ${isBlocked ? "text-rose-400/80" : "text-emerald-400/80"}`}>
                                            {reviewResult?.message ?? "Run the review to see enforcement details."}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── SELF-HEALING SECTION ── */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="h-4 w-4 text-zinc-500" />
                                    <span className="font-mono text-xs font-semibold uppercase tracking-widest text-zinc-500">
                                        Autonomous Self-Healing
                                    </span>
                                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/8 px-2 py-0.5 font-mono text-[10px] text-emerald-500">
                                        AI Powered
                                    </span>
                                </div>

                                {viewState !== "healed" && (
                                    <Button
                                        onClick={handleHeal}
                                        disabled={viewState === "healing"}
                                        variant="outline"
                                        size="lg"
                                        className={`relative w-full gap-2.5 font-mono text-sm font-bold border-success/40 text-success hover:bg-success/10 transition-all duration-300 ${viewState === "healing" ? "opacity-50" : ""}`}
                                    >
                                        {viewState === "healing" ? (
                                            <RefreshCw className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Sparkles className="h-4 w-4" />
                                        )}
                                        {viewState === "healing" ? "Running Self-Healing…" : "Run Autonomous Self-Healing"}
                                    </Button>
                                )}

                                {viewState === "healed" && (
                                    <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/8 px-4 py-2.5">
                                        <CheckCircle className="h-4 w-4 text-emerald-400" />
                                        <span className="font-mono text-xs text-emerald-300">{healMessage}</span>
                                    </div>
                                )}
                            </div>

                            {/* Split-pane diff viewer */}
                            <div
                                className="grid overflow-hidden rounded-2xl border border-border bg-card/50 backdrop-blur-sm"
                                style={{
                                    gridTemplateColumns: "1fr 1fr",
                                    minHeight: "420px",
                                    maxHeight: "520px",
                                }}
                            >
                                {/* Left pane: original / loaded code */}
                                <div className="overflow-hidden border-r border-zinc-800/60" style={{ maxHeight: "520px" }}>
                                    {activeCode ? (
                                        <CodePane
                                            title={activeFileName || "(no file)"}
                                            code={activeCode}
                                            side="left"
                                        />
                                    ) : (
                                        <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                                            <FolderOpen className="h-10 w-10 text-zinc-700" />
                                            <p className="font-mono text-xs text-zinc-600">Load a file from the repo above to begin review</p>
                                        </div>
                                    )}
                                </div>

                                {/* Right pane: healed code */}
                                <div className="overflow-hidden" style={{ maxHeight: "520px" }}>
                                    {viewState === "healed" ? (
                                        <CodePane
                                            title={activeFileName}
                                            code={healedCode ?? activeCode}
                                            healedLines={computeHealedLines(activeCode, healedCode ?? activeCode)}
                                            side="right"
                                        />
                                    ) : viewState === "healing" ? (
                                        <div className="flex h-full items-center justify-center bg-success/5">
                                            <div className="flex flex-col items-center gap-4">
                                                <Sparkles className="h-10 w-10 animate-pulse text-success" />
                                                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                                                    Guardian AI is rewriting <span className="text-foreground">{activeFileName}</span>…
                                                </p>
                                                <div className="flex gap-1">
                                                    {[0, 1, 2, 3].map((i) => (
                                                        <div
                                                            key={i}
                                                            className="h-1 w-6 animate-pulse rounded-full bg-success/30"
                                                            style={{ animationDelay: `${i * 0.15}s` }}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-success/20 bg-success/5">
                                                <Sparkles className="h-6 w-6 text-success/40" />
                                            </div>
                                            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest leading-relaxed">
                                                Click <span className="text-success">"Run Autonomous Self-Healing"</span> to generate the refactored code.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Diff legend */}
                            <div className="flex items-center gap-6 px-1">
                                <div className="flex items-center gap-1.5">
                                    <span className="font-mono text-sm font-bold text-destructive">-</span>
                                    <span className="font-mono text-[9px] uppercase tracking-tight text-muted-foreground opacity-60">Problematic lines</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="font-mono text-sm font-bold text-success">+</span>
                                    <span className="font-mono text-[9px] uppercase tracking-tight text-muted-foreground opacity-60">AI-healed additions</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <AlertTriangle className="h-3 w-3 text-warning opacity-70" />
                                    <span className="font-mono text-[9px] uppercase tracking-tight text-muted-foreground opacity-60">Hover left pane lines for issue details</span>
                                </div>
                            </div>

                            {/* ── SAVE / DISCARD ACTION BAR (shown when healed) ── */}
                            {viewState === "healed" && (
                                <div className="flex items-center justify-between rounded-xl border border-success/20 bg-success/5 px-5 py-3 backdrop-blur-sm">
                                    <div className="flex items-center gap-3">
                                        <BadgeCheck className="h-4 w-4 text-success" />
                                        <div>
                                            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-success">
                                                AI Healing Complete
                                            </p>
                                            <p className="font-mono text-[9px] text-muted-foreground opacity-70 uppercase tracking-tighter">
                                                Save to write healed code back to disk — or discard to keep the original.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            onClick={handleDiscard}
                                            disabled={saveState === "saving"}
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 gap-2 font-mono text-[10px] text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                            Discard
                                        </Button>
                                        <Button
                                            onClick={handleSave}
                                            disabled={saveState === "saving" || saveState === "saved"}
                                            size="sm"
                                            className="h-8 gap-2 font-mono text-[10px] font-bold bg-success text-success-foreground hover:bg-success/90"
                                        >
                                            {saveState === "saving" ? (
                                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                            ) : saveState === "saved" ? (
                                                <CheckCircle className="h-3.5 w-3.5" />
                                            ) : (
                                                <Save className="h-3.5 w-3.5" />
                                            )}
                                            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved!" : "Save to Disk"}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* ── IDLE STATE ── */}
                {viewState === "idle" && (
                    <div className="flex flex-col items-center justify-center gap-6 rounded-2xl border border-border bg-card/30 py-20 backdrop-blur-sm">
                        <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-destructive/20 bg-destructive/5 shadow-[0_0_40px_rgba(var(--destructive),0.1)]">
                            <ShieldAlert className="h-10 w-10 text-destructive" />
                        </div>
                        <div className="text-center">
                            <h2 className="mb-2 font-mono text-lg font-bold uppercase tracking-tight text-foreground">Guardian is Watching</h2>
                            <div className="max-w-md font-mono text-[11px] text-muted-foreground uppercase opacity-70 leading-relaxed px-6">
                                {hasFile
                                    ? <>File loaded: <span className="text-foreground">{activeFileName}</span>. Click <span className="text-foreground">"Run CI/CD Review"</span> to enforce quality gates.</>
                                    : hasRepo
                                        ? <>Select a file from the repo above, then click <span className="text-foreground">"Run CI/CD Review"</span> to audit real code.</>
                                        : <>Scan a repository in the <span className="text-foreground">Librarian</span> tab first, then load a file here to run the quality gate.</>
                                }
                            </div>
                        </div>
                        <div className="flex gap-8 font-mono text-[10px] text-muted-foreground opacity-50 uppercase tracking-widest">
                            <div className="flex items-center gap-2"><ShieldAlert className="h-3.5 w-3.5 text-destructive/40" /> Sonar Analysis</div>
                            <div className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-success/40" /> Merge Enforcement</div>
                            <div className="flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-primary/40" /> Auto-Healing</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
