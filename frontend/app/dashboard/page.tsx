"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  GitBranch,
  MessageSquare,
  Activity,
  PanelLeftClose,
  PanelLeftOpen,
  GripVertical,
  Plus,
  ShieldAlert,
  GraduationCap,
  Compass,
  Loader2,
} from "lucide-react"

// API Call
import { triggerSonarScan } from "@/lib/api"

// Dashboard Components
import { GraphView } from "@/components/dashboard/graph-view"
import { ChatPanel } from "@/components/dashboard/chat-panel"
import { HealthPanel } from "@/components/dashboard/health-panel"
import { RepoSwitcher } from "@/components/dashboard/repo-switcher"
import { GuardianView } from "@/components/dashboard/guardian-view"
import { MentorView } from "@/components/dashboard/mentor-view"
import { ArchitectView } from "@/components/dashboard/architect-view"
import { AlertsInbox } from "@/components/dashboard/alerts-inbox"

// Utilities
import { getActiveRepo } from "@/lib/repo-store"

type MainView = "graph" | "guardian" | "architect" | "mentor"
type PanelType = "chat" | "health" | null

export default function DashboardPage() {
  const router = useRouter()
  const [sidebarWidth, setSidebarWidth] = useState(240)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [activePanel, setActivePanel] = useState<PanelType>(null)
  const [mainView, setMainView] = useState<MainView>("graph")
  const [mounted, setMounted] = useState(false)
  const [activeRepoName, setActiveRepoName] = useState<string | null>(null)
  const [activeRepoUrl, setActiveRepoUrl] = useState<string | null>(null)
  const [activeRepoBranch, setActiveRepoBranch] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)

  const isResizing = useRef(false)
  const maxSidebarWidth = typeof window !== "undefined" ? window.innerWidth * 0.25 : 400

  const refreshActiveRepo = useCallback(() => {
    const repo = getActiveRepo()
    setActiveRepoName(repo?.repo_name ?? null)
    setActiveRepoUrl(repo?.repo_url ?? null)
    setActiveRepoBranch(repo?.data.branch ?? "main")
    setMainView("graph")
    setActivePanel(null)
  }, [])

  useEffect(() => {
    setMounted(true)
    refreshActiveRepo()
    window.addEventListener("active-repo-changed", refreshActiveRepo)
    return () => window.removeEventListener("active-repo-changed", refreshActiveRepo)
  }, [refreshActiveRepo])

  const handleMouseDown = useCallback(() => {
    isResizing.current = true
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return
      const newWidth = Math.max(180, Math.min(e.clientX, maxSidebarWidth))
      setSidebarWidth(newWidth)
    }

    const handleMouseUp = () => {
      isResizing.current = false
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
  }, [maxSidebarWidth])

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
      // An alert will appear in the inbox when done. User can refresh stats to see updates.
    } catch (error) {
      console.error("Failed to trigger scan", error)
    } finally {
      setIsScanning(false)
    }
  }

  return (
    <div className={`flex h-screen flex-col bg-background transition-opacity duration-700 ${mounted ? "opacity-100" : "opacity-0"}`}>
      {/* ─── TOP BAR ─── */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card">
            <GitBranch className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="font-mono text-sm font-medium text-foreground">DevInsight AI</span>

          {activeRepoName ? (
            <div className="flex items-center gap-2">
              <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary">
                {activeRepoName}
              </span>
              <button
                onClick={handleTriggerScan}
                disabled={isScanning}
                className="flex items-center gap-1 rounded-md bg-emerald-600/20 px-2 py-0.5 text-[10px] font-medium text-emerald-500 hover:bg-emerald-600/30 transition-colors disabled:opacity-50"
              >
                {isScanning ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldAlert className="h-3 w-3" />}
                SCAN
              </button>
            </div>
          ) : (
            <span className="rounded-md border border-border bg-secondary px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
              demo
            </span>
          )}

          <button
            onClick={() => router.push("/import-repository")}
            title="Add repository"
            className="flex h-6 w-6 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground transition-all duration-200 hover:border-primary hover:bg-primary/10 hover:text-primary"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => togglePanel("chat")}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-all duration-200 ${activePanel === "chat"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
          >
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">AI Chat</span>
          </button>
          <button
            onClick={() => togglePanel("health")}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-all duration-200 ${activePanel === "health"
              ? "bg-emerald-600 text-white"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
          >
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Health</span>
          </button>
          <AlertsInbox />
        </div>
      </header>

      {/* ─── MAIN LAYOUT ─── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <div
          className="flex shrink-0 flex-col border-r border-border bg-card transition-all duration-300 overflow-hidden"
          style={{ width: sidebarCollapsed ? 0 : sidebarWidth }}
        >
          {!sidebarCollapsed && (
            <>
              {/* Sidebar Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Explorer
                </span>
                <button
                  onClick={() => setSidebarCollapsed(true)}
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <PanelLeftClose className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Sidebar Content (Repo Switcher) */}
              <div className="flex-1 overflow-hidden">
                <RepoSwitcher />
              </div>

              {/* ─── BOTTOM AGENT STACK ─── */}
              <div className="shrink-0 border-t border-border p-2 space-y-1 bg-muted/20">
                {/* Guardian Tab */}
                <button
                  onClick={() => toggleMainView("guardian")}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 transition-all duration-200 ${mainView === "guardian"
                    ? "border border-rose-500/30 bg-rose-500/10 text-rose-300"
                    : "border border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                >
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${mainView === "guardian" ? "border-rose-500/40 bg-rose-500/15" : "border-border bg-card/50"}`}>
                    <ShieldAlert className={`h-3.5 w-3.5 ${mainView === "guardian" ? "text-rose-400" : "text-muted-foreground"}`} />
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate text-xs font-semibold">The Guardian</p>
                    <p className="truncate font-mono text-[10px] text-muted-foreground/60">CI/CD Enforcer</p>
                  </div>
                </button>

                {/* Architect Tab */}
                <button
                  onClick={() => toggleMainView("architect")}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 transition-all duration-200 ${mainView === "architect"
                    ? "border border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                    : "border border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                >
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${mainView === "architect" ? "border-cyan-500/40 bg-cyan-500/15" : "border-border bg-card/50"}`}>
                    <Compass className={`h-3.5 w-3.5 ${mainView === "architect" ? "text-cyan-400" : "text-muted-foreground"}`} />
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate text-xs font-semibold">The Architect</p>
                    <p className="truncate font-mono text-[10px] text-muted-foreground/60">Design & Impact</p>
                  </div>
                </button>

                {/* Mentor Tab */}
                <button
                  onClick={() => toggleMainView("mentor")}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 transition-all duration-200 ${mainView === "mentor"
                    ? "border border-indigo-500/30 bg-indigo-500/10 text-indigo-300"
                    : "border border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                >
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${mainView === "mentor" ? "border-indigo-500/40 bg-indigo-500/15" : "border-border bg-card/50"}`}>
                    <GraduationCap className={`h-3.5 w-3.5 ${mainView === "mentor" ? "text-indigo-400" : "text-muted-foreground"}`} />
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate text-xs font-semibold">The Mentor</p>
                    <p className="truncate font-mono text-[10px] text-muted-foreground/60">Onboarding AI</p>
                  </div>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Sidebar Resize Handle */}
        {!sidebarCollapsed && (
          <div
            className="group flex w-1 cursor-col-resize items-center justify-center hover:bg-primary/20"
            onMouseDown={handleMouseDown}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground/30 opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
        )}

        {/* Collapsed Sidebar Toggle */}
        {sidebarCollapsed && (
          <div className="flex shrink-0 flex-col items-center border-r border-border bg-card py-2 w-10">
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ─── MAIN CANVAS AREA ─── */}
        <div className="flex-1 overflow-hidden">
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

        {/* ─── RIGHT SIDE PANELS ─── */}
        {activePanel && (
          <div
            className="shrink-0 border-l border-border animate-in slide-in-from-right-4 duration-300"
            style={{ width: "min(400px, 40vw)" }}
          >
            {activePanel === "chat" ? (
              <ChatPanel onClose={() => setActivePanel(null)} />
            ) : (
              <HealthPanel onClose={() => setActivePanel(null)} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}