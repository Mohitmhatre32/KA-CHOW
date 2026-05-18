"use client"

import { useState, useCallback, useEffect } from "react"
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
    Monitor,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
    scaffoldProject,
    architectAnalyzeImpact,
    getFileContent,
    syncJiraTicket,
    createJiraTasks,
    getAppTasks,
    type ScaffoldResponse,
    type ImpactResult,
    type AppTask,
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


// ─── Sub-components ──────────────────────────────────────────────────────────

function GlowPulse({ color = "primary" }: { color?: "primary" | "destructive" | "warning" | "success" }) {
    const colorMap = {
        primary: "bg-primary",
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
                className="flex w-full items-center gap-1.5 rounded px-1.5 py-[3px] transition-colors hover:bg-muted/30"
                style={{ paddingLeft: `${depth * 16 + 6}px` }}
                onClick={() => {
                    if (isFolder) setExpanded(!expanded)
                    else onSelect?.(node)
                }}
            >
                {isFolder ? (
                    expanded ? (
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    ) : (
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    )
                ) : (
                    <span className="w-3" />
                )}
                {isFolder ? (
                    <Folder className="h-3.5 w-3.5 text-primary/70" />
                ) : (
                    <File className={`h-3.5 w-3.5 ${nameColor}`} />
                )}
                <span className={`font-mono text-[11px] font-medium leading-none ${nameColor}`}>{node.name}</span>
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
        planned: "border-border bg-card/50 text-muted-foreground opacity-60",
        match: "border-success/30 bg-success/5 text-success",
        drift: "border-warning/30 bg-warning/5 text-warning",
    }
    const icons = {
        planned: <Box className="h-3.5 w-3.5 text-muted-foreground/60" />,
        match: <CheckCircle className="h-3.5 w-3.5 text-success" />,
        drift: <AlertTriangle className="h-3.5 w-3.5 text-warning" />,
    }
    const labels = {
        planned: "Blueprint",
        match: "In Sync",
        drift: "Unplanned",
    }

    return (
        <div className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 ${styles[status]}`}>
            {icons[status]}
            <span className="flex-1 font-mono text-[10px] font-bold uppercase tracking-tight">{name}</span>
            <Badge variant="outline" className={`h-4.5 px-1.5 font-mono text-[8px] uppercase tracking-wider ${status === "drift" ? "border-warning/40 bg-warning/10 text-warning" : status === "match" ? "border-success/40 bg-success/10 text-success" : "border-border bg-muted/20 text-muted-foreground"}`}>
                {labels[status]}
            </Badge>
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
    const [blueprintExpanded, setBlueprintExpanded] = useState(false)

    // ── File viewing state ──
    const [selectedFile, setSelectedFile] = useState<TreeNode | null>(null)
    const [fileContent, setFileContent] = useState<string>("")
    const [isContentLoading, setIsContentLoading] = useState(false)

    // ── Impact analyzer state ──
    const [targetFile, setTargetFile] = useState("")
    const [proposedChange, setProposedChange] = useState("")
    const [impactLoading, setImpactLoading] = useState(false)
    const [impactResult, setImpactResult] = useState<ImpactResult | null>(null)
    const [exportingTasks, setExportingTasks] = useState(false)

    const [error, setError] = useState<string | null>(null)

    // ── Jira Sync ──
    const [jiraKeyInput, setJiraKeyInput] = useState("")
    const [isSyncingJira, setIsSyncingJira] = useState(false)
    // A6 FIX: separate success state per flow so they can never cross-contaminate
    const [jiraSyncSuccess, setJiraSyncSuccess] = useState<string | null>(null)
    const [jiraExportSuccess, setJiraExportSuccess] = useState<string | null>(null)

    const [appTasks, setAppTasks] = useState<AppTask[]>([])
    const [ticketSource, setTicketSource] = useState<"app" | "jira">("app")

    // ── A5 FIX: keep activeRepo in state so repo-switches re-render the component
    const [activeRepo, setActiveRepo] = useState(getActiveRepo)
    useEffect(() => {
        const onRepoChange = () => setActiveRepo(getActiveRepo())
        window.addEventListener("active-repo-changed", onRepoChange)
        return () => window.removeEventListener("active-repo-changed", onRepoChange)
    }, [])

    // A7 FIX: clear stale scaffold/impact when the active repo changes
    useEffect(() => {
        setScaffoldResult(null)
        setSelectedFile(null)
        setFileContent("")
        setImpactResult(null)
        setError(null)
    }, [activeRepo?.repo_url])

    // Fetch local tasks created from mobile app on load + repo switch
    useEffect(() => {
        if (activeRepo?.repo_name) {
            setIsSyncingJira(true)
            getAppTasks(activeRepo.repo_name)
                .then(setAppTasks)
                .catch(console.error)
                .finally(() => setIsSyncingJira(false))
        }
    }, [activeRepo?.repo_name])

    const handleJiraSync = useCallback(async () => {
        if (!jiraKeyInput.trim()) {
            setError("Please enter a Jira ticket key to sync.")
            return
        }
        setIsSyncingJira(true)
        setError(null)
        setJiraSyncSuccess(null)  // A6 FIX: only clear the sync flow's success
        try {
            const ticketData = await syncJiraTicket(jiraKeyInput.trim())
            const formatted = JSON.stringify({
                ticket: ticketData.key,
                summary: ticketData.summary,
                status: ticketData.status,
                description: ticketData.description
            }, null, 2)
            setJiraInput(formatted)
            setJiraSyncSuccess(`Synced ${ticketData.key}: ${ticketData.summary}`)
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Jira sync failed")
        } finally {
            setIsSyncingJira(false)
        }
    }, [jiraKeyInput])

    // ── Create Tasks ──
    const handleCreateJiraTasks = useCallback(async () => {
        if (!jiraKeyInput.trim() || !impactResult) return
        setExportingTasks(true)
        setError(null)
        setJiraExportSuccess(null)  // A6 FIX: only clear the export flow's success
        try {
            const tasks = impactResult.impacted_files.map(s => `Fix/Verify impact in ${s.file_path} [Reason: ${s.reason}]`)
            const res = await createJiraTasks(jiraKeyInput.trim(), tasks)
            setJiraExportSuccess(res.message)
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Task creation failed")
        } finally {
            setExportingTasks(false)
        }
    }, [jiraKeyInput, impactResult])

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
    // A5 FIX: reads activeRepo from state (not getActiveRepo() in closure)
    // Also fixed: targetFile added to deps to prevent stale closure
    const handleAnalyzeImpact = useCallback(async () => {
        if (!activeRepo) {
            setError("Please select a repository in Librarian first to analyze impact.")
            return
        }

        setImpactLoading(true)
        setError(null)
        try {
            const result = await architectAnalyzeImpact({
                target_endpoint: targetFile || "root",
                proposed_change: proposedChange,
                repo_url: activeRepo.repo_url,
            })
            setImpactResult(result)
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Analysis failed")
        } finally {
            setImpactLoading(false)
        }
    }, [activeRepo, proposedChange, targetFile])

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
        <div className="h-full overflow-y-auto bg-background/50">
            <div className="mx-auto max-w-7xl space-y-6 p-6">

                {/* ══════════════════════════════════════════════════════════════
                                        PAGE HEADER
                   ══════════════════════════════════════════════════════════════ */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-4">
                        <div
                            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/5"
                        >
                            <Compass className="h-7 w-7 text-primary" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                                    The Architect
                                </h1>
                                <Badge variant="outline" className="border-primary/40 bg-primary/5 font-mono text-[10px] font-semibold uppercase tracking-widest text-primary">
                                    Design &amp; Impact
                                </Badge>
                                <GlowPulse color="primary" />
                            </div>
                            <p className="mt-0.5 font-mono text-xs text-muted-foreground opacity-70">
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

                        <div className="flex flex-col gap-2 mb-2 rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-3">
                            <div className="flex items-center justify-between">
                                <label className="font-mono text-[10px] uppercase tracking-wider text-zinc-600">
                                    Ticket Source
                                </label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-1.5 cursor-pointer font-mono text-[10px] text-zinc-400">
                                        <input 
                                            type="radio" 
                                            name="ticketSource" 
                                            value="app" 
                                            checked={ticketSource === "app"}
                                            onChange={() => {
                                                setTicketSource("app")
                                                setJiraKeyInput("")
                                                setJiraSyncSuccess(null)
                                                setJiraExportSuccess(null)
                                            }}
                                            className="accent-primary"
                                        />
                                        Local App
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer font-mono text-[10px] text-zinc-400">
                                        <input 
                                            type="radio" 
                                            name="ticketSource" 
                                            value="jira" 
                                            checked={ticketSource === "jira"}
                                            onChange={() => {
                                                setTicketSource("jira")
                                                setJiraKeyInput("")
                                                setJiraSyncSuccess(null)
                                                setJiraExportSuccess(null)
                                            }}
                                            className="accent-primary"
                                        />
                                        Jira Cloud
                                    </label>
                                </div>
                            </div>
                            
                            {ticketSource === "app" ? (
                                <div className="flex gap-2 mt-1">
                                    <select
                                        value={jiraKeyInput}
                                        onChange={(e) => {
                                            const val = e.target.value
                                            setJiraKeyInput(val)
                                            const task = appTasks.find(t => t.id === val)
                                            if (task) {
                                                const formatted = JSON.stringify({
                                                    ticket: task.id,
                                                    summary: task.title,
                                                    status: task.status,
                                                    linked_files: task.linked_nodes
                                                }, null, 2)
                                                setJiraInput(formatted)
                                                setJiraSyncSuccess(`Selected ${task.id}: ${task.title}`)
                                            }
                                        }}
                                        className="flex-1 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 font-mono text-xs text-zinc-300 outline-none focus:border-cyan-500/40"
                                    >
                                        <option value="">-- Select a Ticket --</option>
                                        {appTasks.map(t => (
                                            <option key={t.id} value={t.id}>
                                                {t.id} - {t.title}
                                            </option>
                                        ))}
                                    </select>
                                    <Button
                                        onClick={() => {
                                            if (activeRepo?.repo_name) {
                                                setIsSyncingJira(true)
                                                getAppTasks(activeRepo.repo_name)
                                                    .then(setAppTasks)
                                                    .catch(console.error)
                                                    .finally(() => setIsSyncingJira(false))
                                            }
                                        }}
                                        disabled={isSyncingJira || !activeRepo}
                                        size="sm"
                                        variant="outline"
                                        className="h-8 gap-2 border-primary/30 text-primary hover:bg-primary/10"
                                    >
                                        {isSyncingJira ? <RefreshCw className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                                        Refresh
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex gap-2 mt-1">
                                    <input
                                        type="text"
                                        placeholder="e.g. TICKET-123"
                                        value={jiraKeyInput}
                                        onChange={(e) => setJiraKeyInput(e.target.value)}
                                        className="flex-1 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 font-mono text-xs text-zinc-300 outline-none placeholder:text-zinc-600 focus:border-cyan-500/40"
                                    />
                                    <Button
                                        onClick={handleJiraSync}
                                        disabled={isSyncingJira || !jiraKeyInput.trim()}
                                        size="sm"
                                        variant="outline"
                                        className="h-8 gap-2 border-primary/30 text-primary hover:bg-primary/10"
                                    >
                                        {isSyncingJira ? <RefreshCw className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                                        Sync
                                    </Button>
                                </div>
                            )}
                            
                            {(jiraSyncSuccess || jiraExportSuccess) && (
                                <p className="font-mono text-[10px] text-emerald-400 mt-1">
                                    {jiraSyncSuccess || jiraExportSuccess}
                                </p>
                            )}
                        </div>

                        <div
                            className="flex flex-1 flex-col overflow-hidden rounded-xl border border-zinc-800/80"
                            style={{ background: "rgba(8,10,18,0.95)", minHeight: "320px" }}
                        >
                            {/* Editor header */}
                            <div className="flex items-center gap-2 border-b border-zinc-800/60 px-4 py-2.5">
                                <FileJson className="h-3.5 w-3.5 text-amber-400" />
                                <span className="font-mono text-xs font-semibold text-amber-300">architect_requirements.json</span>
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
                        <Button
                            onClick={handleScaffold}
                            disabled={scaffoldLoading}
                            size="lg"
                            className={`w-full gap-2.5 font-mono text-sm font-bold border-primary/40 text-primary hover:bg-primary/10 transition-all duration-300 ${scaffoldLoading ? "opacity-50" : ""}`}
                            variant="outline"
                        >
                            {scaffoldLoading ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                                <Sparkles className="h-4 w-4" />
                            )}
                            {scaffoldLoading ? "Generating Blueprint…" : "Generate Blueprint & Scaffold"}
                        </Button>
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
                                    <div className="flex items-center gap-2 border-b border-primary/20 bg-primary/5 px-4 py-2.5">
                                        <File className="h-3.5 w-3.5 text-primary" />
                                        <span className="font-mono text-xs font-bold text-primary truncate uppercase tracking-tighter">{selectedFile.name}</span>
                                        <Button
                                            onClick={() => setSelectedFile(null)}
                                            variant="ghost"
                                            size="sm"
                                            className="ml-auto h-7 gap-1 font-mono text-[10px] text-muted-foreground hover:text-foreground"
                                        >
                                            <ChevronRight className="h-3 w-3 rotate-180" />
                                            BACK
                                        </Button>
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
                                    <div className="flex items-center gap-2 border-b border-success/20 bg-success/5 px-4 py-2.5">
                                        <FolderTree className="h-3.5 w-3.5 text-success" />
                                        <span className="font-mono text-xs font-bold text-success uppercase tracking-widest">Project Structure</span>
                                        <Badge variant="outline" className="ml-auto border-success/30 bg-success/10 font-mono text-[9px] text-success">
                                            GENERATED
                                        </Badge>
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
                                                {blueprintExpanded
                                                    ? scaffoldResult.blueprint_summary
                                                    : scaffoldResult.blueprint_summary.slice(0, 300)}
                                                {!blueprintExpanded && scaffoldResult.blueprint_summary.length > 300 && "…"}
                                            </p>
                                            {scaffoldResult.blueprint_summary.length > 300 && (
                                                <button
                                                    onClick={() => setBlueprintExpanded((v) => !v)}
                                                    className="mt-2 font-mono text-[10px] font-bold uppercase tracking-wider text-primary/70 hover:text-primary transition-colors"
                                                >
                                                    {blueprintExpanded ? "↑ Show less" : "↓ Show full rationale"}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </>
                            ) : scaffoldLoading ? (
                                <div className="flex h-full items-center justify-center bg-primary/5">
                                    <div className="flex flex-col items-center gap-4">
                                        <Compass className="h-10 w-10 animate-pulse text-primary" />
                                        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Architect AI is designing the blueprint…</p>
                                        <div className="flex gap-1">
                                            {[0, 1, 2, 3].map((i) => (
                                                <div
                                                    key={i}
                                                    className="h-1 w-6 animate-pulse rounded-full bg-primary/30"
                                                    style={{ animationDelay: `${i * 0.15}s` }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/5">
                                        <FolderTree className="h-6 w-6 text-primary/40" />
                                    </div>
                                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground leading-relaxed">
                                        Click <span className="text-primary font-bold">&quot;Generate Blueprint &amp; Scaffold&quot;</span> to produce the project structure.
                                    </p>
                                </div>
                            )}
                        </div>

                        {scaffoldError && (
                            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 font-mono text-[11px] text-amber-400">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                <span><strong>Scaffold failed:</strong> {scaffoldError} — check that the backend is running and retry.</span>
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
                        className="rounded-xl border border-border p-5 bg-card/30 backdrop-blur-sm"
                    >
                        {/* ── What-If Analyzer Explainer ── */}
                        <div className="mb-5 rounded-xl border border-primary/20 bg-primary/5 p-4">
                            <div className="flex items-start gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
                                    <Monitor className="h-4 w-4 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <p className="font-mono text-xs font-bold uppercase tracking-wider text-primary">
                                            What is the What-If Analyzer?
                                        </p>
                                        <span className="rounded-full border border-rose-500/30 bg-rose-500/8 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-rose-400">
                                            Blast Radius Engine
                                        </span>
                                    </div>
                                    <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
                                        The <span className="text-primary font-semibold">What-If Analyzer</span> is an AI-powered dependency intelligence tool. When you describe a proposed code change, it crawls the project&apos;s live knowledge graph to identify every file, service, or module that will be affected — giving each a <span className="text-rose-400 font-semibold">HIGH</span> / <span className="text-amber-400 font-semibold">MEDIUM</span> / <span className="text-emerald-400 font-semibold">LOW</span> blast-radius severity score.
                                    </p>
                                    <div className="mt-3 grid grid-cols-3 gap-2">
                                        {[
                                            { step: "01", label: "Crawls Graph", desc: "Scans all import / dependency edges" },
                                            { step: "02", label: "Traces Impact", desc: "Finds all files that import the target" },
                                            { step: "03", label: "AI Reasoning", desc: "LLM assigns severity + explanation" },
                                        ].map(({ step, label, desc }) => (
                                            <div key={step} className="rounded-lg border border-border bg-card/60 p-2.5">
                                                <p className="font-mono text-[9px] font-bold text-primary/50 mb-0.5">STEP {step}</p>
                                                <p className="font-mono text-[10px] font-bold text-foreground">{label}</p>
                                                <p className="font-mono text-[9px] text-muted-foreground opacity-70 leading-snug">{desc}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Controls row */}
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                            {/* Target File/Endpoint */}
                            <div className="flex-[0.4]">
                                <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-zinc-600">
                                    Target File / Endpoint (Optional)
                                </label>
                                <select
                                    value={targetFile}
                                    onChange={(e) => setTargetFile(e.target.value)}
                                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 font-mono text-xs text-zinc-300 outline-none transition-colors focus:border-cyan-500/40"
                                >
                                    <option value="">-- Select a File (Optional) --</option>
                                    {activeRepo?.data?.nodes?.filter(n => n.type === "file").sort((a, b) => a.id.localeCompare(b.id)).map(n => (
                                        <option key={n.id} value={n.id}>{n.id}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Proposed Change Scenario */}
                            <div className="flex-1">
                                <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-zinc-600">
                                    What if scenario
                                </label>
                                <input
                                    type="text"
                                    value={proposedChange}
                                    onChange={(e) => setProposedChange(e.target.value)}
                                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 font-mono text-xs text-zinc-300 outline-none transition-colors focus:border-cyan-500/40"
                                    placeholder="e.g. What if I change the datatype from int to string?"
                                />
                            </div>

                            {/* Analyze button */}
                            <Button
                                onClick={handleAnalyzeImpact}
                                disabled={impactLoading || !proposedChange.trim()}
                                className={`h-10 gap-2 font-mono text-xs font-bold transition-all ${impactLoading || !proposedChange.trim() ? "opacity-50" : "border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10"}`}
                                variant="outline"
                            >
                                {impactLoading ? (
                                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <Activity className="h-3.5 w-3.5" />
                                )}
                                Analyze Blast Radius
                            </Button>
                        </div>

                        {/* Results */}
                        {impactResult && (
                            <div className="mt-5 space-y-4">
                                {/* High impact banner */}
                                {impactResult.severity === "high" && impactResult.total_impacted > 0 ? (
                                    <div
                                        className="flex items-start gap-4 rounded-xl border border-rose-500/30 bg-rose-500/5 px-5 py-4 backdrop-blur-md shadow-[inset_0_0_40px_rgba(244,63,94,0.05)]"
                                    >
                                        <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-rose-500" />
                                        <div className="flex-1">
                                            <p className="font-mono text-base font-bold uppercase tracking-tight text-rose-500">
                                                ⚠ High Impact Detected
                                            </p>
                                            <p className="mt-1 font-mono text-[11px] leading-relaxed text-muted-foreground opacity-80">
                                                {impactResult.total_impacted} files affected at depth {impactResult.blast_radius_depth}
                                            </p>
                                        </div>
                                        <Badge variant="outline" className="shrink-0 border-rose-500/40 bg-rose-500/10 font-mono text-[10px] font-bold uppercase tracking-widest text-rose-500">
                                            {impactResult.severity}
                                        </Badge>
                                    </div>
                                ) : (
                                    <div
                                        className="flex items-start gap-4 rounded-xl border border-zinc-700/30 bg-zinc-800/10 px-5 py-4 backdrop-blur-md"
                                    >
                                        <Activity className="mt-0.5 h-6 w-6 shrink-0 text-zinc-400" />
                                        <div className="flex-1">
                                            <p className="font-mono text-base font-bold uppercase tracking-tight text-zinc-300">
                                                Analysis Complete
                                            </p>
                                            <p className="mt-1 font-mono text-[11px] leading-relaxed text-muted-foreground opacity-80">
                                                {impactResult.total_impacted} components analyzed with {impactResult.severity} impact risk.
                                            </p>
                                        </div>
                                        <Badge variant="outline" className={`shrink-0 font-mono text-[10px] font-bold uppercase tracking-widest ${impactResult.severity === "medium" ? "border-amber-500/40 bg-amber-500/10 text-amber-500" : "border-zinc-700 bg-zinc-800 text-zinc-500"}`}>
                                            {impactResult.severity}
                                        </Badge>
                                    </div>
                                )}

                                {/* Scenario Explanation */}
                                {impactResult.scenario_explanation && (
                                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                                        <div className="flex items-start gap-3">
                                            <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                            <div>
                                                <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-primary mb-1">Architectural Insight</p>
                                                <p className="font-mono text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap">
                                                    {impactResult.scenario_explanation}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Blast radius list */}
                                <div className="mt-4">
                                    <p className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest mb-3">IMPACTED FILES</p>
                                    <div className="flex flex-col gap-3">
                                        {impactResult.impacted_files.map((svc, i) => (
                                            <div
                                                key={i}
                                                className="rounded-lg border border-zinc-800/80 bg-[#161b22] p-4 shadow-sm"
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="font-mono text-sm font-semibold tracking-tight text-zinc-200">{svc.file_path}</span>
                                                    <span className={`font-mono text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm ${svc.severity === "high" ? "text-rose-500 bg-rose-500/10" : svc.severity === "medium" ? "text-amber-500 bg-amber-500/10" : "text-emerald-500 bg-emerald-500/10"}`}>
                                                        {svc.severity}
                                                    </span>
                                                </div>
                                                <p className="font-sans text-[13px] leading-relaxed text-zinc-400">
                                                    {svc.reason}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Export to Jira */}
                                <Button
                                    onClick={handleCreateJiraTasks}
                                    disabled={exportingTasks || !jiraKeyInput.trim() || impactResult.impacted_files.length === 0}
                                    className="w-full mt-4 bg-[#0052cc] text-white hover:bg-[#0052cc]/90 gap-2 font-mono text-xs font-bold transition-all"
                                >
                                    {exportingTasks ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <span>➕</span>}
                                    {jiraKeyInput.trim() ? "Export to Jira Sub-tasks" : "Enter a Jira ticket key above to export tasks"}
                                </Button>
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
                       SECTION 3: ARCHITECTURE DRIFT & SONARQUBE QUALITY (A3+A4 FIX)
                       Data is now derived from the live repo graph — no hardcoded values.
                   ══════════════════════════════════════════════════════════════ */}
                {(() => {
                    const repoData = activeRepo?.data
                    const allNodes = repoData?.nodes ?? []

                    // Derive top-level module names (unique first path segment)
                    const moduleNames = Array.from(
                        new Set(
                            allNodes
                                .filter(n => n.id.includes("/"))
                                .map(n => n.id.split("/")[0])
                        )
                    ).slice(0, 8) // cap at 8 for readability

                    // Nodes that have poor sonar gate are "drift" candidates
                    const driftModules = new Set(
                        allNodes
                            .filter(n => {
                                const gate = n.sonar_health?.quality_gate as string | undefined
                                return gate && gate !== "PASSED" && gate !== "OK"
                            })
                            .map(n => n.id.split("/")[0])
                    )

                    // Aggregate sonar metrics across all nodes with data
                    let totalBugs = 0, totalSmells = 0, totalDup = 0, sonarNodeCount = 0
                    allNodes.forEach(n => {
                        if (n.sonar_health && Object.keys(n.sonar_health).length > 0) {
                            totalBugs   += (n.sonar_health.bugs as number) ?? 0
                            totalSmells += (n.sonar_health.code_smells as number) ?? 0
                            totalDup    += (n.sonar_health.duplications as number) ?? 0
                            sonarNodeCount++
                        }
                    })
                    const avgDup = sonarNodeCount > 0 ? (totalDup / sonarNodeCount).toFixed(1) : null
                    const overallGatePass = totalBugs === 0 && totalSmells < 5
                    const hasLiveData = allNodes.length > 0

                    return (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <GitMerge className="h-4 w-4 text-zinc-500" />
                                <span className="font-mono text-xs font-semibold uppercase tracking-widest text-zinc-500">
                                    Architecture Drift &amp; Clean Architecture Enforcement
                                </span>
                                {hasLiveData && (
                                    <span className="rounded-full border border-success/30 bg-success/5 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-success">
                                        Live
                                    </span>
                                )}
                            </div>

                            {!hasLiveData ? (
                                <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card/30 py-12 text-center">
                                    <GitMerge className="h-8 w-8 text-muted-foreground/20" />
                                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">
                                        No repository loaded
                                    </p>
                                    <p className="font-mono text-[9px] text-muted-foreground/40 italic">
                                        Scan a repository in the Librarian tab to see real drift analysis.
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                                    {/* ── Left: Module Drift ── */}
                                    <div className="rounded-xl border border-border p-5 bg-card/30 backdrop-blur-sm">
                                        <p className="mb-4 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-60">
                                            Detected Modules — {activeRepo?.repo_name}
                                        </p>

                                        {moduleNames.length === 0 ? (
                                            <p className="font-mono text-[10px] text-muted-foreground/50 italic">No modules detected in graph.</p>
                                        ) : (
                                            <div className="space-y-1.5">
                                                {moduleNames.map((name, i) => (
                                                    <DriftServiceCard
                                                        key={i}
                                                        name={name}
                                                        status={driftModules.has(name) ? "drift" : "match"}
                                                    />
                                                ))}
                                            </div>
                                        )}

                                        {driftModules.size > 0 && (
                                            <div className="mt-4 flex items-center gap-2 rounded-lg border border-warning/25 bg-warning/5 px-3 py-2.5">
                                                <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                                                <p className="font-mono text-[10px] font-bold uppercase tracking-tight text-warning leading-none">
                                                    Drift Detected:{" "}
                                                    <span className="opacity-70 font-medium">
                                                        {Array.from(driftModules).join(", ")} failed the SonarQube quality gate.
                                                    </span>
                                                </p>
                                            </div>
                                        )}

                                        {driftModules.size === 0 && (
                                            <div className="mt-4 flex items-center gap-2 rounded-lg border border-success/25 bg-success/5 px-3 py-2.5">
                                                <CheckCircle className="h-4 w-4 shrink-0 text-success" />
                                                <p className="font-mono text-[10px] font-bold uppercase tracking-tight text-success leading-none">
                                                    No drift — all modules match quality gates.
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* ── Right: Live SonarQube Aggregate ── */}
                                    <div className="flex flex-col gap-4 rounded-xl border border-border p-5 bg-card/30 backdrop-blur-sm">
                                        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-60">
                                            {sonarNodeCount > 0
                                                ? `SonarQube Architectural Health — ${sonarNodeCount} of ${allNodes.length} nodes analysed`
                                                : "SonarQube Architectural Health — no scan data yet"}
                                        </p>

                                        {sonarNodeCount === 0 ? (
                                            <div className="flex flex-col items-center gap-2 py-6 text-center">
                                                <p className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">Run a Sonar Scan to see real metrics</p>
                                                <p className="font-mono text-[9px] text-muted-foreground/40 italic">Use the “🔍 Sonar Scan” button in the Knowledge Graph toolbar.</p>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                    <div className={`rounded-xl border p-4 ${ totalSmells > 0 ? "border-warning/25 bg-warning/5" : "border-success/25 bg-success/5" }`}>
                                                        <p className="mb-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground opacity-60">Structural Code Smells</p>
                                                        <p className={`font-mono text-2xl font-bold ${ totalSmells > 0 ? "text-warning" : "text-success" }`}>{totalSmells}</p>
                                                        <p className={`mt-0.5 font-mono text-[9px] uppercase tracking-tighter opacity-50 ${ totalSmells > 0 ? "text-warning" : "text-success" }`}>
                                                            {totalSmells > 10 ? "Needs attention" : totalSmells > 0 ? "Minor issues" : "Clean"}
                                                        </p>
                                                    </div>
                                                    <div className={`rounded-xl border p-4 ${ avgDup && parseFloat(avgDup) > 10 ? "border-destructive/25 bg-destructive/5" : "border-success/25 bg-success/5" }`}>
                                                        <p className="mb-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground opacity-60">Avg Duplication Density</p>
                                                        <p className={`font-mono text-2xl font-bold ${ avgDup && parseFloat(avgDup) > 10 ? "text-destructive" : "text-success" }`}>{avgDup ? `${avgDup}%` : "0%"}</p>
                                                        <p className={`mt-0.5 font-mono text-[9px] uppercase tracking-tighter opacity-50 ${ avgDup && parseFloat(avgDup) > 10 ? "text-destructive" : "text-success" }`}>
                                                            {avgDup && parseFloat(avgDup) > 10 ? "Violates DRY Principle" : "Within acceptable range"}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="mt-auto">
                                                    <div className={`flex items-center gap-4 rounded-xl border px-4 py-3 backdrop-blur-md ${ overallGatePass ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5" }`}>
                                                        {overallGatePass
                                                            ? <CheckCircle className="h-6 w-6 text-success" />
                                                            : <XCircle className="h-6 w-6 text-destructive" />}
                                                        <div>
                                                            <p className={`font-mono text-[9px] uppercase tracking-widest ${ overallGatePass ? "text-success/70" : "text-destructive/70" }`}>
                                                                SonarQube Clean Architecture Gate
                                                            </p>
                                                            <p className={`font-mono text-lg font-black tracking-tight ${ overallGatePass ? "text-success" : "text-destructive" }`}>
                                                                {overallGatePass ? "PASSED" : "FAILED"}
                                                            </p>
                                                        </div>
                                                        <div className="ml-auto">
                                                            <GlowPulse color={overallGatePass ? "success" : "destructive"} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })()}
            </div>
        </div>
    )
}

