"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { X, Activity, AlertCircle, CheckCircle, AlertTriangle, Bug, Zap, ShieldCheck, Percent, Loader2, GitCommit, Copy, Flame } from "lucide-react"
import { healthMetrics as demoMetrics, errorLogs as demoLogs, type HealthMetric } from "@/lib/demo-data"
import { useGraphData } from "@/hooks/use-graph-data"
import { getHistory, type CommitInfo } from "@/lib/api"

const statusConfig = {
  healthy: { color: "text-success", bg: "bg-success/10", icon: CheckCircle, label: "Healthy" },
  warning: { color: "text-warning", bg: "bg-warning/10", icon: AlertTriangle, label: "Warning" },
  critical: { color: "text-destructive", bg: "bg-destructive/10", icon: AlertCircle, label: "Critical" },
}

interface SonarHealth {
  bugs: number
  vulnerabilities: number
  code_smells: number
  coverage: number
  security_hotspots: number
  duplications: number
  quality_gate: string
}

interface SystemHealth {
  bugs: number
  vulnerabilities: number
  code_smells: number
  coverage: number
  security_hotspots: number
  duplications: number
  quality_gate: string
}

export function HealthPanel({ onClose }: { onClose: () => void }) {
  const { nodes, graphMeta, isLive } = useGraphData()
  const [history, setHistory] = useState<CommitInfo[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  // Fetch history when a live repo is active
  const fetchHistory = useCallback(() => {
    if (isLive && graphMeta?.repo_url) {
      setIsLoadingHistory(true)
      getHistory(graphMeta.repo_url)
        .then(setHistory)
        .catch((err) => console.error("Failed to fetch history:", err))
        .finally(() => setIsLoadingHistory(false))
    }
  }, [isLive, graphMeta?.repo_url])

  useEffect(() => {
    fetchHistory()
    window.addEventListener("active-repo-changed", fetchHistory)
    return () => window.removeEventListener("active-repo-changed", fetchHistory)
  }, [fetchHistory])

  // Calculate live metrics from nodes
  const liveData = useMemo(() => {
    if (!isLive || !nodes.length) return { metrics: demoMetrics, summary: { bugs: 0, smells: 0, qualityGate: "OK" } }

    // Use type casting to handle the fact that graphMeta.system_health might be an object
    // even if the interface says it's a number (due to runtime behavior)
    const sys = (graphMeta as any)?.system_health as SystemHealth | undefined

    let bugs = 0
    let vulnerabilities = 0
    let code_smells = 0
    let coverage = 0
    let security_hotspots = 0
    let duplications = 0
    let quality_gate = "OK"

    if (sys && typeof sys === "object") {
      bugs = sys.bugs ?? 0
      vulnerabilities = sys.vulnerabilities ?? 0
      code_smells = sys.code_smells ?? 0
      coverage = sys.coverage ?? 0
      security_hotspots = sys.security_hotspots ?? 0
      duplications = sys.duplications ?? 0
      quality_gate = sys.quality_gate ?? "OK"
    } else {
      // Fallback: Aggregate from nodes
      let nodeCount = 0
      let totalCoverage = 0
      let totalDuplications = 0
      let allPassed = true

      nodes.forEach(node => {
        const h = (node as any).sonar_health as SonarHealth
        if (h) {
          bugs += h.bugs ?? 0
          vulnerabilities += h.vulnerabilities ?? 0
          code_smells += h.code_smells ?? 0
          totalCoverage += h.coverage ?? 0
          security_hotspots += h.security_hotspots ?? 0
          totalDuplications += h.duplications ?? 0
          if (h.quality_gate !== "PASSED" && h.quality_gate !== "OK" && h.quality_gate !== "passed") allPassed = false
          nodeCount++
        }
      })

      if (nodeCount > 0) {
        coverage = totalCoverage / nodeCount
        duplications = totalDuplications / nodeCount
        quality_gate = allPassed ? "OK" : "ERROR"
      }
    }

    const metrics: HealthMetric[] = [
      {
        label: "Bugs",
        value: bugs.toString(),
        status: bugs > 5 ? "critical" : bugs > 0 ? "warning" : "healthy",
        detail: "Critical maintenance issues"
      },
      {
        label: "Vulnerabilities",
        value: vulnerabilities.toString(),
        status: vulnerabilities > 0 ? "critical" : "healthy",
        detail: "Security exposure"
      },
      {
        label: "Code Smells",
        value: code_smells.toString(),
        status: code_smells > 50 ? "critical" : code_smells > 20 ? "warning" : "healthy",
        detail: "Technical debt indicator"
      },
      {
        label: "Security Hotspots",
        value: security_hotspots.toString(),
        status: security_hotspots > 10 ? "critical" : security_hotspots > 0 ? "warning" : "healthy",
        detail: "Manual review items"
      },
      {
        label: "Coverage",
        value: `${coverage.toFixed(1)}%`,
        status: coverage > 80 ? "healthy" : coverage > 50 ? "warning" : "critical",
        detail: "Unit test coverage"
      },
      {
        label: "Duplications",
        value: `${duplications.toFixed(1)}%`,
        status: duplications < 3 ? "healthy" : duplications < 10 ? "warning" : "critical",
        detail: "Repeated code density"
      }
    ]

    return { metrics, summary: { bugs, smells: code_smells, qualityGate: quality_gate } }
  }, [isLive, nodes, graphMeta, demoMetrics])

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            {isLive ? "Project Quality Insights" : "System Health"}
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Status Cards */}
        <div className="grid grid-cols-2 gap-3">
          {liveData.metrics.map((metric) => {
            const config = statusConfig[metric.status]
            const StatusIcon = config.icon
            return (
              <div key={metric.label} className="rounded-lg border border-border bg-secondary/30 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground truncate mr-2">{metric.label}</span>
                  <StatusIcon className={`h-3.5 w-3.5 shrink-0 ${config.color}`} />
                </div>
                <div className="mt-1 font-mono text-sm font-semibold text-foreground">{metric.value}</div>
                <div className="mt-0.5 text-[9px] text-muted-foreground leading-tight">{metric.detail}</div>
              </div>
            )
          })}
        </div>

        {/* Overall Status */}
        <div className={`rounded-lg border p-3 ${!isLive ? "border-success/20 bg-success/5" :
          liveData.summary.qualityGate === "ERROR" || liveData.summary.qualityGate === "FAILED" ? "border-destructive/20 bg-destructive/5" :
            liveData.summary.qualityGate === "WARN" || liveData.summary.qualityGate === "WARNING" ? "border-warning/20 bg-warning/5" :
              "border-success/20 bg-success/5"
          }`}>
          <div className="flex items-center gap-2">
            {!isLive || (liveData.summary.qualityGate !== "ERROR" && liveData.summary.qualityGate !== "FAILED") ? (
              <CheckCircle className={`h-4 w-4 ${(!isLive || liveData.summary.qualityGate === "OK" || liveData.summary.qualityGate === "PASSED") ? "text-success" : "text-warning"}`} />
            ) : (
              <AlertCircle className="h-4 w-4 text-destructive" />
            )}
            <span className="text-sm font-medium text-foreground">
              Quality Gate: {isLive ? (liveData.summary.qualityGate || "OK") : "PASSED"}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {isLive
              ? `System metrics finalized with ${liveData.summary.bugs} bugs and ${liveData.summary.smells} smells across ${nodes.length} nodes.`
              : "All system services are operational. Showing demo hardware metrics."}
          </p>
        </div>

        {/* Recent Activity (History) */}
        <div>
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <GitCommit className="h-3 w-3" />
            {isLive ? "Recent Commit History" : "Recent Activity Logs"}
          </h3>

          <div className="flex flex-col gap-2">
            {isLoadingHistory ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/30" />
              </div>
            ) : isLive && history.length > 0 ? (
              history.map((commit, i) => (
                <div key={commit.hash} className="flex items-start gap-2 rounded-md border border-border bg-secondary/20 p-2">
                  <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/40" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-mono text-[11px] text-foreground/80">{commit.message}</p>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[9px] text-muted-foreground italic truncate">{commit.author}</span>
                      <span className="text-[9px] text-muted-foreground shrink-0">{commit.date}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : !isLive ? (
              demoLogs.map((log, i) => (
                <div key={i} className="flex items-start gap-2 rounded-md border border-border bg-secondary/20 p-2 text-[11px]">
                  <div className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${log.level === 'warning' ? 'bg-warning' : log.level === 'info' ? 'bg-primary' : 'bg-muted-foreground'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-foreground/80 font-mono">{log.message}</p>
                    <span className="text-[9px] text-muted-foreground">{log.time}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-md border border-dashed border-border p-4 text-center">
                <p className="text-xs text-muted-foreground font-italic">No history available for this repo.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
