"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import {
  GitBranch,
  MessageSquare,
  Activity,
  Plus,
  ShieldAlert,
  GraduationCap,
  Compass,
  Loader2,
  LayoutGrid,
  GitFork,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

// API Call
import { triggerSonarScan, analyzeRepository } from "@/lib/api"

// Dashboard Components
import { GraphView } from "@/components/dashboard/graph-view"
import { HealthPanel } from "@/components/dashboard/health-panel"
import { GuardianView } from "@/components/dashboard/guardian-view"
import { MentorView } from "@/components/dashboard/mentor-view"
import { ArchitectView } from "@/components/dashboard/architect-view"
import { AlertsInbox } from "@/components/dashboard/alerts-inbox"

// Utilities
import { getActiveRepo, setActiveRepoId, getAllRepos, upsertRepo } from "@/lib/repo-store"

type MainView = "graph" | "guardian" | "architect" | "mentor"
type PanelType = "health" | null

export default function DashboardPage() {
  const router = useRouter()
  const params = useParams()
  const repoId = params?.repoId as string | undefined

  // State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [activePanel, setActivePanel] = useState<PanelType>(null)
  const [mainView, setMainView] = useState<MainView>("graph")
  const [mounted, setMounted] = useState(false)
  const [activeRepoName, setActiveRepoName] = useState<string | null>(null)
  const [activeRepoUrl, setActiveRepoUrl] = useState<string | null>(null)
  const [activeRepoBranch, setActiveRepoBranch] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)

  const [loadRepoUrl, setLoadRepoUrl] = useState("")
  const [loadBranch, setLoadBranch] = useState("main")
  const [loadForce, setLoadForce] = useState(false)
  const [isLoadingRepo, setIsLoadingRepo] = useState(false)

  const refreshActiveRepo = useCallback(() => {
    const repo = getActiveRepo()
    setActiveRepoName(repo?.repo_name ?? null)
    setActiveRepoUrl(repo?.repo_url ?? null)
    setActiveRepoBranch(repo?.data.branch ?? "main")
    
    setLoadRepoUrl(repo?.repo_url ?? "")
    setLoadBranch(repo?.data.branch ?? "main")

    setMainView("graph")
    setActivePanel(null)
  }, [])

  useEffect(() => {
    setMounted(true)

    // If there's a repoId in the URL, activate that repo first
    if (repoId) {
      const repos = getAllRepos()
      const match = repos.find((r) => r.id === repoId)
      if (match) {
        setActiveRepoId(repoId)
      } else {
        // If ID not found, redirect to repository home
        router.replace("/repositories")
        return
      }
    }

    refreshActiveRepo()
    window.addEventListener("active-repo-changed", refreshActiveRepo)
    return () => window.removeEventListener("active-repo-changed", refreshActiveRepo)
  }, [repoId, refreshActiveRepo, router])

  const togglePanel = (panel: PanelType) => {
    setActivePanel((prev) => (prev === panel ? null : panel))
  }

  const toggleMainView = (view: MainView) => {
    setMainView((prev) => (prev === view ? "graph" : view))
  }

  const handleTriggerScan = async () => {
    if (!activeRepoUrl) return
    setIsScanning(true)
    try {
      await triggerSonarScan(activeRepoUrl, activeRepoBranch || "main")
    } catch (error) {
      console.error("Failed to trigger scan", error)
    } finally {
      setIsScanning(false)
    }
  }

  const handleLoadRepo = async () => {
    if (!loadRepoUrl) return
    setIsLoadingRepo(true)
    try {
      const data = await analyzeRepository(loadRepoUrl, loadBranch, loadForce)
      const newId = upsertRepo(loadRepoUrl, data)
      setActiveRepoId(newId)
      router.push(`/dashboard/${newId}`)
    } catch (e) {
      console.error(e)
      alert("Error loading repo: " + (e instanceof Error ? e.message : String(e)))
    } finally {
      setIsLoadingRepo(false)
    }
  }

  return (
    <div className={`flex h-screen flex-col bg-background transition-opacity duration-700 ${mounted ? "opacity-100" : "opacity-0"}`}>
      {/* ─── TOP BAR ─── */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4 bg-card/30 backdrop-blur-sm z-20">
        <div className="flex items-center gap-4">
          {/* Logo → Back to Repositories */}
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => router.push("/repositories")}
          >
            <GitBranch className="h-4 w-4 text-primary" />
          </div>
          <h1 className="text-sm m-0 font-semibold tracking-tight hidden md:block">KA-CHOW</h1>

          <Separator orientation="vertical" className="h-6 hidden md:block" />

          {/* INDEX.HTML DASHBOARD INPUTS */}
          <div className="flex items-center gap-2">
            <input 
              type="text"
              value={loadRepoUrl}
              onChange={(e) => setLoadRepoUrl(e.target.value)}
              placeholder="GitHub URL or local path…"
              className="h-8 w-64 rounded-md border border-border bg-card px-3 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
            />
            <input
              type="text"
              value={loadBranch}
              onChange={(e) => setLoadBranch(e.target.value)}
              placeholder="main"
              className="h-8 w-24 rounded-md border border-border bg-card px-3 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
            />
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
              <input 
                type="checkbox" 
                checked={loadForce}
                onChange={(e) => setLoadForce(e.target.checked)}
                className="accent-primary"
              />
              Force rescan
            </label>
            <Button
              size="sm"
              onClick={handleLoadRepo}
              disabled={isLoadingRepo || !loadRepoUrl}
              className="h-8 bg-primary text-black font-semibold hover:bg-primary/90 hidden sm:flex"
            >
              {isLoadingRepo ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : "⚡ "}
              Load
            </Button>
          </div>

          {activeRepoName ? (
            <div className="flex items-center gap-2 hidden lg:flex">
              <Badge variant="outline" className="font-mono text-[10px] py-0 px-2 border-primary/30 text-primary bg-primary/5">
                {activeRepoName}
              </Badge>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {/* Back to All Repos */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => router.push("/repositories")}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>All Repositories</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button
            variant={activePanel === "health" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => togglePanel("health")}
            className={`h-8 gap-2 ${activePanel === "health" ? "text-success bg-success/10" : ""}`}
          >
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Health</span>
          </Button>

          <AlertsInbox />
        </div>
      </header>

      {/* ─── MAIN CONTENT GROUP ─── */}
      <ResizablePanelGroup direction="horizontal" className="flex-1 overflow-hidden">
        {/* Sidebar Panel — AI Agents only, no repo switcher */}
        <ResizablePanel
          defaultSize={18}
          minSize={14}
          maxSize={26}
          collapsible={true}
          onCollapse={() => setSidebarCollapsed(true)}
          onExpand={() => setSidebarCollapsed(false)}
          className={`flex flex-col bg-sidebar border-r border-border transition-all duration-300 ${sidebarCollapsed ? "max-w-[0px]" : ""}`}
        >
          {/* Sidebar Header */}
          <div className="flex shrink-0 items-center border-b border-border px-4 h-10">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground m-0">
              AI Agents
            </h2>
          </div>

          {/* Agent Navigation — fills full sidebar */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <AgentTab
              active={mainView === "graph"}
              onClick={() => setMainView("graph")}
              icon={GitFork}
              title="Knowledge Graph"
              subtitle="Dependency explorer"
              variant="primary"
            />

            <div className="my-2 h-px bg-border" />

            <AgentTab
              active={mainView === "guardian"}
              onClick={() => toggleMainView("guardian")}
              icon={ShieldAlert}
              title="The Guardian"
              subtitle="CI/CD Enforcer"
              variant="destructive"
            />
            <AgentTab
              active={mainView === "architect"}
              onClick={() => toggleMainView("architect")}
              icon={Compass}
              title="The Architect"
              subtitle="Design & Impact"
              variant="primary"
            />
            <AgentTab
              active={mainView === "mentor"}
              onClick={() => toggleMainView("mentor")}
              icon={GraduationCap}
              title="The Mentor"
              subtitle="Onboarding AI"
              variant="accent"
            />
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle className="bg-border opacity-50 hover:opacity-100 transition-opacity" />

        {/* ─── MAIN CANVAS AREA ─── */}
        <ResizablePanel defaultSize={80} className="flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(88,166,255,0.03),transparent_70%)] pointer-events-none" />
            {mainView === "guardian" ? (
              <div className="animate-in fade-in slide-in-from-bottom-2 h-full duration-300">
                <GuardianView />
              </div>
            ) : mainView === "mentor" ? (
              <div className="animate-in fade-in slide-in-from-bottom-2 h-full duration-300">
                <MentorView />
              </div>
            ) : mainView === "architect" ? (
              <div className="animate-in fade-in slide-in-from-bottom-2 h-full duration-300">
                <ArchitectView />
              </div>
            ) : (
              <GraphView />
            )}
          </div>
        </ResizablePanel>

        {/* ─── RIGHT SIDE PANELS ─── */}
        {activePanel && (
          <>
            <ResizableHandle withHandle className="bg-border" />
            <ResizablePanel
              defaultSize={25}
              minSize={20}
              maxSize={40}
              className="bg-card border-l border-border animate-in slide-in-from-right-4 duration-500"
            >
              <HealthPanel onClose={() => setActivePanel(null)} />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  )
}

function AgentTab({
  active,
  onClick,
  icon: Icon,
  title,
  subtitle,
  variant = "primary"
}: {
  active: boolean,
  onClick: () => void,
  icon: React.ElementType,
  title: string,
  subtitle: string,
  variant?: "primary" | "destructive" | "accent"
}) {
  const variantStyles = {
    primary: active ? "border-primary/30 bg-primary/10 text-primary" : "text-muted-foreground",
    destructive: active ? "border-destructive/30 bg-destructive/10 text-destructive" : "text-muted-foreground",
    accent: active ? "border-accent/30 bg-accent/10 text-accent" : "text-muted-foreground",
  }

  const iconStyles = {
    primary: active ? "border-primary/40 bg-primary/15 text-primary" : "border-border bg-card/50",
    destructive: active ? "border-destructive/40 bg-destructive/15 text-destructive" : "border-border bg-card/50",
    accent: active ? "border-accent/40 bg-accent/15 text-accent-foreground" : "border-border bg-card/50",
  }

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 transition-all duration-200 border border-transparent hover:bg-secondary/50 ${variantStyles[variant]}`}
    >
      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors ${iconStyles[variant]}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1 text-left">
        <p className={`truncate text-[11px] font-bold ${active ? "" : "text-foreground"}`}>{title}</p>
        <p className="truncate font-mono text-[9px] opacity-60 uppercase tracking-tighter">{subtitle}</p>
      </div>
    </button>
  )
}
