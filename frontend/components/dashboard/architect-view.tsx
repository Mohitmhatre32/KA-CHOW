"use client"

import { useState, useCallback } from "react"
import {
    Compass,
    FileJson,
    FolderTree,
    Sparkles,
    Activity,
    AlertTriangle,
    ShieldAlert,
    ChevronRight,
    ChevronDown,
    File,
    Folder,
    RefreshCw,
    Zap,
    Box,
    GitMerge,
    XCircle,
    CheckCircle,
    Loader2,
} from "lucide-react"
import {
    scaffoldProject,
    architectAnalyzeImpact,
    getFileContent,
    type ScaffoldResponse,
    type ImpactResult,
} from "@/lib/api"
import { getActiveRepo } from "@/lib/repo-store"

// ─── Demo data ───────────────────────────────────────────────────────────────

const DEFAULT_JIRA_JSON = JSON.stringify(
    {
        ticket: "DEV-202",
        summary: "Build User Auth Microservice",
        tech: "FastAPI, PostgreSQL",
        requirements: [
            "JWT-based authentication",
            "User registration with email verification",
            "Role-based access control (RBAC)",
            "Password reset flow",
            "Rate limiting on login endpoint",
        ],
    },
    null,
    2
)

// Impact Analyzer demo
const DEMO_ENDPOINTS = [
    "/api/v1/getUser",
    "/api/v1/createOrder",
    "/api/v1/billing/charge",
    "/api/v1/notifications/send",
    "/api/v1/auth/login",
]

// Architecture drift demo data
const PLANNED_SERVICES = [
    { name: "auth-service", status: "planned" as const },
    { name: "user-service", status: "planned" as const },
    { name: "billing-service", status: "planned" as const },
    { name: "notification-service", status: "planned" as const },
    { name: "gateway-api", status: "planned" as const },
]

const ACTUAL_SERVICES = [
    { name: "auth-service", status: "match" as const },
    { name: "user-service", status: "match" as const },
    { name: "billing-service", status: "match" as const },
    { name: "notification-service", status: "match" as const },
    { name: "gateway-api", status: "match" as const },
    { name: "analytics-worker", status: "drift" as const },
]

// ─── Sub-components ──────────────────────────────────────────────────────────

function GlowPulse({ color = "cyan" }: { color?: "cyan" | "rose" | "amber" | "emerald" }) {
    const colorMap = {
        cyan: "bg-cyan-500",
        rose: "bg-rose-500",
        amber: "bg-amber-500",
        emerald: "bg-emerald-500",
    }
    return (
        <span className="relative flex h-2 w-2">
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${colorMap[color]} opacity-75`} />
            <span className={`relative inline-flex h-2 w-2 rounded-full ${colorMap[color]}`} />
        </span>
    )
}

/** Recursive file tree node */
interface TreeNode {
    name: string
    type: "file" | "folder"
    children?: TreeNode[]
    path?: string
}

function buildTree(files: string[], projectPath: string): TreeNode[] {
    const root: TreeNode[] = []
    for (const filePath of files) {
        const parts = filePath.split("/")
        let current = root
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i]
            const isFile = i === parts.length - 1
            let existing = current.find((n) => n.name === part)
            if (!existing) {
                // Store the relative and absolute path for files
                const relPath = parts.slice(0, i + 1).join("/")
                const absPath = `${projectPath}/${relPath}`.replace(/\/+/g, "/")

                existing = {
                    name: part,
                    type: isFile ? "file" : "folder",
                    children: isFile ? undefined : [],
                    path: absPath
                }
                current.push(existing)
            }
            if (!isFile && existing && existing.children) {
                current = existing.children
            }
        }
    }
    return root
}

function FileTreeNode({ node, depth = 0, onSelect }: { node: TreeNode; depth?: number; onSelect?: (node: TreeNode) => void }) {
    const [expanded, setExpanded] = useState(true)
    const isFolder = node.type === "folder"
    const ext = node.name.split(".").pop() ?? ""

    const extColors: Record<string, string> = {
        py: "text-emerald-400",
        ts: "text-blue-400",
        tsx: "text-blue-400",
        json: "text-amber-400",
        yml: "text-rose-400",
        yaml: "text-rose-400",
        md: "text-zinc-400",
        txt: "text-zinc-400",
        toml: "text-orange-400",
        cfg: "text-orange-400",
        dockerfile: "text-cyan-400",
    }
    const nameColor = isFolder ? "text-cyan-300" : extColors[ext.toLowerCase()] ?? "text-zinc-300"

    return (
        <div>
            <button
                className="flex w-full items-center gap-1.5 rounded px-1.5 py-[3px] transition-colors hover:bg-white/[0.04]"
                style={{ paddingLeft: `${depth * 16 + 6}px` }}
                onClick={() => {
                    if (isFolder) setExpanded(!expanded)
                    else onSelect?.(node)
                }}
            >
                {isFolder ? (
                    expanded ? (
                        <ChevronDown className="h-3 w-3 text-zinc-500" />
                    ) : (
                        <ChevronRight className="h-3 w-3 text-zinc-500" />
                    )
                ) : (
                    <span className="w-3" />
                )}
                {isFolder ? (
                    <Folder className="h-3.5 w-3.5 text-cyan-500/70" />
                ) : (
                    <File className={`h-3.5 w-3.5 ${nameColor}`} />
                )}
                <span className={`font-mono text-[11.5px] ${nameColor}`}>{node.name}</span>
            </button>
            {isFolder && expanded && node.children?.map((child, i) => (
                <FileTreeNode key={i} node={child} depth={depth + 1} onSelect={onSelect} />
            ))}
        </div>
    )
}

function JsonHighlight({ json }: { json: string }) {
    // Simple syntax highlighting for JSON
    const highlighted = json
        .replace(/"([^"]+)":/g, '<span class="text-cyan-400">"$1"</span>:')
        .replace(/: "([^"]+)"/g, ': <span class="text-emerald-400">"$1"</span>')
        .replace(/: (\d+)/g, ': <span class="text-amber-400">$1</span>')
        .replace(/(\[|\]|\{|\})/g, '<span class="text-zinc-500">$1</span>')

    return (
        <pre
            className="font-mono text-[11.5px] leading-5 text-zinc-300"
            dangerouslySetInnerHTML={{ __html: highlighted }}
        />
    )
}

function DriftServiceCard({ name, status }: { name: string; status: "planned" | "match" | "drift" }) {
    const styles = {
        planned: "border-zinc-800 bg-zinc-900/50 text-zinc-500",
        match: "border-emerald-500/20 bg-emerald-500/5 text-emerald-400",
        drift: "border-amber-500/30 bg-amber-500/8 text-amber-400",
    }
    const icons = {
        planned: <Box className="h-3.5 w-3.5 text-zinc-600" />,
        match: <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />,
        drift: <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />,
    }
    const labels = {
        planned: "Blueprint",
        match: "In Sync",
        drift: "Unplanned",
    }

    return (
        <div className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 ${styles[status]}`}>
            {icons[status]}
            <span className="flex-1 font-mono text-xs">{name}</span>
            <span className={`rounded-full px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${status === "drift" ? "bg-amber-500/15 text-amber-400" : status === "match" ? "bg-emerald-500/10 text-emerald-500/70" : "bg-zinc-800 text-zinc-600"}`}>
                {labels[status]}
            </span>
        </div>
    )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function ArchitectView() {
    // ── Scaffold state ──
    const [jiraInput, setJiraInput] = useState(DEFAULT_JIRA_JSON)
    const [scaffoldLoading, setScaffoldLoading] = useState(false)
    const [scaffoldResult, setScaffoldResult] = useState<ScaffoldResponse | null>(null)
    const [scaffoldError, setScaffoldError] = useState<string | null>(null)

    // ── File viewing state ──
    const [selectedFile, setSelectedFile] = useState<TreeNode | null>(null)
    const [fileContent, setFileContent] = useState<string>("")
    const [isContentLoading, setIsContentLoading] = useState(false)

    // ── Impact analyzer state ──
    const [targetEndpoint, setTargetEndpoint] = useState(DEMO_ENDPOINTS[0])
    const [proposedChange, setProposedChange] = useState("Change User ID from Integer to String")
    const [impactLoading, setImpactLoading] = useState(false)
    const [impactResult, setImpactResult] = useState<ImpactResult | null>(null)

    const [error, setError] = useState<string | null>(null)

    // ── Scaffold handler ──
    const handleScaffold = useCallback(async () => {
        setScaffoldLoading(true)
        setScaffoldError(null)
        try {
            // Pass the raw input directly - the backend now handles smarter parsing
            const result = await scaffoldProject(jiraInput)
            setScaffoldResult(result)
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Backend unavailable"
            setScaffoldError(msg)
            // Demo fallback deleted as we now have a real backend logic
        } finally {
            setScaffoldLoading(false)
        }
    }, [jiraInput])

    // ── Impact analyzer handler ──
    const handleAnalyzeImpact = useCallback(async () => {
        const activeRepo = getActiveRepo()
        if (!activeRepo) {
            setError("Please select a repository in Librarian first to analyze impact.")
            return
        }

        setImpactLoading(true)
        setError(null)
        try {
            const result = await architectAnalyzeImpact({
                target_endpoint: targetEndpoint,
                proposed_change: proposedChange,
                repo_url: activeRepo.repo_url,
            })
            setImpactResult(result)
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Analysis failed")
        } finally {
            setImpactLoading(false)
        }
    }, [targetEndpoint, proposedChange])

    // ── File select handler ──
    const handleFileSelect = useCallback(async (node: TreeNode) => {
        if (node.type !== "file" || !node.path) return
        setSelectedFile(node)
        setIsContentLoading(true)
        try {
            const content = await getFileContent(node.path)
            setFileContent(content)
        } catch (e) {
            setFileContent(`// Error loading file: ${e instanceof Error ? e.message : String(e)}`)
        } finally {
            setIsContentLoading(false)
        }
    }, [])

    const fileTree = scaffoldResult ? buildTree(scaffoldResult.files, scaffoldResult.project_path) : []

    return (
        <div
            className="h-full overflow-y-auto"
            style={{ background: "linear-gradient(135deg, #060a14 0%, #0a0f1e 50%, #080c18 100%)" }}
        >
            <div className="mx-auto max-w-7xl space-y-6 p-6">

                {/* ══════════════════════════════════════════════════════════════
                                        PAGE HEADER
                   ══════════════════════════════════════════════════════════════ */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-4">
                        <div
                            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-cyan-500/30"
                            style={{
                                background: "radial-gradient(circle at center, rgba(6,182,212,0.15), rgba(6,182,212,0.03))",
                                boxShadow: "0 0 30px rgba(6,182,212,0.12)",
                            }}
                        >
                            <Compass className="h-7 w-7 text-cyan-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-bold tracking-tight text-zinc-100" style={{ fontFamily: "Inter, sans-serif" }}>
                                    The Architect
                                </h1>
                                <span
                                    className="rounded-full border border-cyan-500/40 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-cyan-400"
                                    style={{ background: "rgba(6,182,212,0.08)" }}
                                >
                                    Design &amp; Impact
                                </span>
                                <GlowPulse color="cyan" />
                            </div>
                            <p className="mt-0.5 font-mono text-xs text-zinc-500">
                                Translating Jira Requirements into Scaffolding &amp; Preventing Architectural Disasters
                            </p>
                        </div>
                    </div>
                </div>

                {/* ══════════════════════════════════════════════════════════════
                       SECTION 1: AUTONOMOUS ARCHITECTURE DESIGN (SPLIT PANE)
                   ══════════════════════════════════════════════════════════════ */}
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

                    {/* ── LEFT: Jira Input ── */}
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                            <FileJson className="h-4 w-4 text-zinc-500" />
                            <span className="font-mono text-xs font-semibold uppercase tracking-widest text-zinc-500">
                                Input Jira Ticket (JSON)
                            </span>
                        </div>

                        <div
                            className="flex flex-1 flex-col overflow-hidden rounded-xl border border-zinc-800/80"
                            style={{ background: "rgba(8,10,18,0.95)", minHeight: "320px" }}
                        >
                            {/* Editor header */}
                            <div className="flex items-center gap-2 border-b border-zinc-800/60 px-4 py-2.5">
                                <FileJson className="h-3.5 w-3.5 text-amber-400" />
                                <span className="font-mono text-xs font-semibold text-amber-300">ticket_DEV-202.json</span>
                                <span className="ml-auto rounded-full border border-zinc-800 bg-zinc-900 px-2 py-0.5 font-mono text-[10px] text-zinc-600">
                                    EDITABLE
                                </span>
                            </div>

                            {/* Code textarea */}
                            <div className="flex-1 p-1">
                                <textarea
                                    value={jiraInput}
                                    onChange={(e) => setJiraInput(e.target.value)}
                                    className="h-full w-full resize-none border-none bg-transparent p-3 font-mono text-[11.5px] leading-5 text-emerald-300 outline-none placeholder:text-zinc-700"
                                    spellCheck={false}
                                />
                            </div>
                        </div>

                        {/* Scaffold button */}
                        <button
                            onClick={handleScaffold}
                            disabled={scaffoldLoading}
                            className={`flex items-center justify-center gap-2.5 rounded-xl border px-5 py-3 font-mono text-sm font-semibold transition-all duration-300 ${scaffoldLoading
                                ? "cursor-not-allowed border-cyan-500/20 bg-cyan-950/30 text-cyan-500/50"
                                : "border-cyan-500/40 text-cyan-300 hover:border-cyan-400/60 hover:text-cyan-200"
                                }`}
                            style={!scaffoldLoading ? {
                                background: "radial-gradient(ellipse at center, rgba(6,182,212,0.12), rgba(8,10,18,0.9))",
                                boxShadow: "0 0 20px rgba(6,182,212,0.15), 0 0 60px rgba(6,182,212,0.05)",
                            } : undefined}
                        >
                            {scaffoldLoading ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                                <Sparkles className="h-4 w-4" />
                            )}
                            {scaffoldLoading ? "Generating Blueprint…" : "Generate Blueprint & Scaffold"}
                        </button>
                    </div>

                    {/* ── RIGHT: Generated Scaffolding ── */}
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                            <FolderTree className="h-4 w-4 text-zinc-500" />
                            <span className="font-mono text-xs font-semibold uppercase tracking-widest text-zinc-500">
                                Generated Scaffolding
                            </span>
                            {scaffoldResult && (
                                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/8 px-2 py-0.5 font-mono text-[10px] text-emerald-500">
                                    {scaffoldResult.files.length} files
                                </span>
                            )}
                        </div>

                        <div
                            className="flex flex-1 flex-col overflow-hidden rounded-xl border border-zinc-800/80"
                            style={{ background: "rgba(8,10,18,0.95)", minHeight: "320px" }}
                        >
                            {selectedFile ? (
                                <>
                                    {/* Code Viewer Header */}
                                    <div className="flex items-center gap-2 border-b border-cyan-500/20 bg-cyan-950/20 px-4 py-2.5">
                                        <File className="h-3.5 w-3.5 text-cyan-400" />
                                        <span className="font-mono text-xs font-semibold text-cyan-300 truncate">{selectedFile.name}</span>
                                        <button
                                            onClick={() => setSelectedFile(null)}
                                            className="ml-auto flex items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 font-mono text-[10px] text-zinc-400 hover:text-white"
                                        >
                                            <ChevronRight className="h-3 w-3 rotate-180" />
                                            BACK
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-auto p-4">
                                        {isContentLoading ? (
                                            <div className="flex h-full items-center justify-center">
                                                <Loader2 className="h-6 w-6 animate-spin text-cyan-500/50" />
                                            </div>
                                        ) : (
                                            <pre className="font-mono text-[11.5px] leading-5 text-zinc-300 whitespace-pre">
                                                {fileContent}
                                            </pre>
                                        )}
                                    </div>
                                </>
                            ) : scaffoldResult ? (
                                <>
                                    {/* File tree header */}
                                    <div className="flex items-center gap-2 border-b border-emerald-500/20 bg-emerald-950/20 px-4 py-2.5">
                                        <FolderTree className="h-3.5 w-3.5 text-emerald-400" />
                                        <span className="font-mono text-xs font-semibold text-emerald-300">Project Structure</span>
                                        <span className="ml-auto rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-400">
                                            GENERATED
                                        </span>
                                    </div>

                                    {/* File tree */}
                                    <div className="flex-1 overflow-auto px-2 py-2">
                                        {fileTree.map((node, i) => (
                                            <FileTreeNode key={i} node={node} onSelect={handleFileSelect} />
                                        ))}
                                    </div>

                                    {/* Rationale */}
                                    {scaffoldResult.blueprint_summary && (
                                        <div className="border-t border-zinc-800/60 px-4 py-3">
                                            <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-zinc-600">Rationale</p>
                                            <p className="font-mono text-[11px] leading-relaxed text-zinc-400">
                                                {scaffoldResult.blueprint_summary.slice(0, 300)}
                                                {scaffoldResult.blueprint_summary.length > 300 && "…"}
                                            </p>
                                        </div>
                                    )}
                                </>
                            ) : scaffoldLoading ? (
                                <div className="flex h-full items-center justify-center">
                                    <div className="flex flex-col items-center gap-4">
                                        <Compass className="h-10 w-10 animate-pulse text-cyan-400" />
                                        <p className="font-mono text-xs text-zinc-500">Architect AI is designing the blueprint…</p>
                                        <div className="flex gap-1">
                                            {[0, 1, 2, 3].map((i) => (
                                                <div
                                                    key={i}
                                                    className="h-1 w-6 animate-pulse rounded-full bg-cyan-500/30"
                                                    style={{ animationDelay: `${i * 0.15}s` }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                                    <div
                                        className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-500/20"
                                        style={{ background: "rgba(6,182,212,0.05)" }}
                                    >
                                        <FolderTree className="h-6 w-6 text-cyan-500/40" />
                                    </div>
                                    <p className="font-mono text-xs text-zinc-600">
                                        Click <span className="text-cyan-500">&quot;Generate Blueprint &amp; Scaffold&quot;</span> to produce the project structure.
                                    </p>
                                </div>
                            )}
                        </div>

                        {scaffoldError && (
                            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 font-mono text-[11px] text-amber-400">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                {scaffoldError} — showing demo scaffold.
                            </div>
                        )}
                    </div>
                </div>

                {/* ══════════════════════════════════════════════════════════════
                       SECTION 2: WHAT-IF IMPACT ANALYZER
                   ══════════════════════════════════════════════════════════════ */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-zinc-500" />
                        <span className="font-mono text-xs font-semibold uppercase tracking-widest text-zinc-500">
                            API-Aware &quot;What-If&quot; Impact Analyzer
                        </span>
                        <span className="rounded-full border border-rose-500/30 bg-rose-500/8 px-2 py-0.5 font-mono text-[10px] text-rose-400">
                            Blast Radius
                        </span>
                    </div>

                    <div
                        className="rounded-xl border border-zinc-800/80 p-5"
                        style={{ background: "rgba(10,13,23,0.8)" }}
                    >
                        {/* Controls row */}
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                            {/* Target Endpoint */}
                            <div className="flex-1">
                                <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-zinc-600">
                                    Target Endpoint / File
                                </label>
                                <select
                                    value={targetEndpoint}
                                    onChange={(e) => setTargetEndpoint(e.target.value)}
                                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 font-mono text-xs text-cyan-300 outline-none transition-colors focus:border-cyan-500/40"
                                >
                                    {DEMO_ENDPOINTS.map((ep) => (
                                        <option key={ep} value={ep}>{ep}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Proposed Change */}
                            <div className="flex-1">
                                <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-zinc-600">
                                    Proposed Change
                                </label>
                                <input
                                    type="text"
                                    value={proposedChange}
                                    onChange={(e) => setProposedChange(e.target.value)}
                                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 font-mono text-xs text-zinc-300 outline-none transition-colors focus:border-cyan-500/40"
                                    placeholder="e.g. Change User ID from Integer to String"
                                />
                            </div>

                            {/* Analyze button */}
                            <button
                                onClick={handleAnalyzeImpact}
                                disabled={impactLoading}
                                className={`flex shrink-0 items-center gap-2 rounded-lg border px-4 py-2.5 font-mono text-xs font-semibold transition-all ${impactLoading
                                    ? "cursor-not-allowed border-zinc-800 bg-zinc-900 text-zinc-600"
                                    : "border-rose-500/30 bg-rose-500/8 text-rose-300 hover:border-rose-400/50 hover:bg-rose-500/15"
                                    }`}
                            >
                                {impactLoading ? (
                                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <Activity className="h-3.5 w-3.5" />
                                )}
                                Analyze Blast Radius
                            </button>
                        </div>

                        {/* Results */}
                        {impactResult && (
                            <div className="mt-5 space-y-4">
                                {/* High impact banner */}
                                <div
                                    className="flex items-start gap-3 rounded-xl border border-rose-500/30 px-5 py-4"
                                    style={{
                                        background: "radial-gradient(ellipse at top left, rgba(239,68,68,0.08), rgba(10,13,23,0.95))",
                                        boxShadow: "0 0 40px rgba(239,68,68,0.06) inset",
                                    }}
                                >
                                    <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-rose-500" />
                                    <div className="flex-1">
                                        <p className="font-mono text-base font-bold text-rose-300">
                                            ⚠ High Impact Detected
                                        </p>
                                        <p className="mt-1 font-mono text-xs text-zinc-400">
                                            {impactResult.summary}
                                        </p>
                                    </div>
                                    <span
                                        className="shrink-0 rounded-full border border-rose-500/40 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-rose-400"
                                        style={{ background: "rgba(239,68,68,0.1)" }}
                                    >
                                        {impactResult.severity}
                                    </span>
                                </div>

                                {/* Blast radius list */}
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                    {impactResult.affected_services.map((svc, i) => (
                                        <div
                                            key={i}
                                            className="rounded-lg border border-rose-500/15 p-3"
                                            style={{ background: "rgba(239,68,68,0.03)" }}
                                        >
                                            <div className="flex items-center gap-2">
                                                <XCircle className="h-3.5 w-3.5 text-rose-500" />
                                                <span className="font-mono text-xs font-semibold text-rose-300">{svc.name}</span>
                                            </div>
                                            <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-zinc-500">
                                                {svc.reason}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 font-mono text-[11px] text-amber-400">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                {error}
                            </div>
                        )}
                    </div>
                </div>

                {/* ══════════════════════════════════════════════════════════════
                       SECTION 3: ARCHITECTURE DRIFT & SONARQUBE QUALITY
                   ══════════════════════════════════════════════════════════════ */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <GitMerge className="h-4 w-4 text-zinc-500" />
                        <span className="font-mono text-xs font-semibold uppercase tracking-widest text-zinc-500">
                            Architecture Drift &amp; Clean Architecture Enforcement
                        </span>
                    </div>

                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

                        {/* ── Left: Planned vs Actual ── */}
                        <div
                            className="rounded-xl border border-zinc-800/80 p-5"
                            style={{ background: "rgba(10,13,23,0.8)" }}
                        >
                            <p className="mb-4 font-mono text-xs font-semibold text-zinc-400">Planned Blueprint vs Current Implementation</p>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Planned */}
                                <div>
                                    <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-zinc-600">
                                        <span className="inline-flex items-center gap-1"><Box className="h-3 w-3" /> Planned</span>
                                    </p>
                                    <div className="space-y-1.5">
                                        {PLANNED_SERVICES.map((s, i) => (
                                            <DriftServiceCard key={i} name={s.name} status={s.status} />
                                        ))}
                                    </div>
                                </div>

                                {/* Actual */}
                                <div>
                                    <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-zinc-600">
                                        <span className="inline-flex items-center gap-1"><Zap className="h-3 w-3" /> Actual</span>
                                    </p>
                                    <div className="space-y-1.5">
                                        {ACTUAL_SERVICES.map((s, i) => (
                                            <DriftServiceCard key={i} name={s.name} status={s.status} />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Drift callout */}
                            <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2.5">
                                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                                <p className="font-mono text-[11px] text-amber-400">
                                    <span className="font-bold">Architecture Drift Detected:</span> &quot;analytics-worker&quot; was not in the original blueprint.
                                </p>
                            </div>
                        </div>

                        {/* ── Right: SonarQube Architecture Metrics ── */}
                        <div
                            className="flex flex-col gap-4 rounded-xl border border-zinc-800/80 p-5"
                            style={{ background: "rgba(10,13,23,0.8)" }}
                        >
                            <p className="font-mono text-xs font-semibold text-zinc-400">SonarQube Architectural Health</p>

                            {/* Metric cards */}
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                {/* Code Smells */}
                                <div
                                    className="rounded-xl border border-amber-500/25 p-4"
                                    style={{ background: "rgba(245,158,11,0.04)" }}
                                >
                                    <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-zinc-600">Structural Code Smells</p>
                                    <p className="font-mono text-2xl font-bold text-amber-400">8</p>
                                    <p className="mt-0.5 font-mono text-[10px] text-amber-500/60">Needs attention</p>
                                </div>

                                {/* Duplication */}
                                <div
                                    className="rounded-xl border border-rose-500/25 p-4"
                                    style={{ background: "rgba(239,68,68,0.04)" }}
                                >
                                    <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-zinc-600">Duplication Density</p>
                                    <p className="font-mono text-2xl font-bold text-rose-400">14%</p>
                                    <p className="mt-0.5 font-mono text-[10px] text-rose-500/60">Violates DRY Principle</p>
                                </div>
                            </div>

                            {/* Gate status */}
                            <div className="mt-auto">
                                <div
                                    className="flex items-center gap-3 rounded-xl border border-rose-500/30 px-4 py-3"
                                    style={{ background: "radial-gradient(ellipse at top left, rgba(239,68,68,0.08), rgba(10,13,23,0.95))" }}
                                >
                                    <XCircle className="h-6 w-6 text-rose-500" />
                                    <div>
                                        <p className="font-mono text-[10px] uppercase tracking-widest text-rose-500/70">SonarQube Clean Architecture Gate</p>
                                        <p
                                            className="font-mono text-lg font-black tracking-tight text-rose-400"
                                            style={{ textShadow: "0 0 15px rgba(239,68,68,0.4)" }}
                                        >
                                            FAILED
                                        </p>
                                    </div>
                                    <div className="ml-auto">
                                        <GlowPulse color="rose" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
